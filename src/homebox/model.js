// -----------------------------------------------------------------------------
// Homebox answers -> plain values: the inventory from the CSV export, the
// scheduled maintenance, the top-level locations, and the summary the devices,
// the widget and the scene triggers share.
//
// Dates: Homebox stores warranty and maintenance dates as calendar days
// ("2026-10-29"). They are compared with the local day of Gladys (the
// supervisor sets TZ), never with an instant: a warranty "expiring today"
// stays valid until midnight.
// -----------------------------------------------------------------------------

/**
 * RFC 4180 CSV: quoted fields, doubled quotes, line breaks inside quotes.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-10-29" (or an ISO instant) -> "2026-10-29"; null for empty or year 1. */
export function parseDay(value) {
  const match = typeof value === 'string' ? value.match(DAY) : null;
  if (!match || Number(match[1]) < 1900) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** The local calendar day of an instant, in the TZ of the process. */
export function localDay(now) {
  const date = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from `from` to `to` (two "YYYY-MM-DD"). */
export function daysBetween(from, to) {
  const utc = (day) =>
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

const number = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * The items of a CSV export (0.26 also lists its locations: left out).
 * @returns {{ id: string, name: string, location: string, archived: boolean,
 *   quantity: number, price: number, lifetime: boolean, warranty: string | null }[]}
 */
export function parseExport(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) {
    return [];
  }
  const column = Object.fromEntries(header.map((name, index) => [name.trim(), index]));
  const get = (row, name) => (column[name] === undefined ? '' : (row[column[name]] ?? ''));
  const items = [];
  for (const row of rows) {
    const url = get(row, 'HB.url');
    if (url.startsWith('/location/')) {
      continue;
    }
    const name = get(row, 'HB.name').trim();
    if (name === '') {
      continue;
    }
    const location = get(row, 'HB.location').trim();
    const match = url.match(/^\/item\/([^/?#]+)/);
    items.push({
      // The url carries the item id; an export without it keys on the name.
      id: match ? match[1] : `${location}/${name}`,
      name,
      location,
      archived: get(row, 'HB.archived') === 'true',
      quantity: number(get(row, 'HB.quantity')),
      price: number(get(row, 'HB.purchase_price')),
      lifetime: get(row, 'HB.lifetime_warranty') === 'true',
      warranty: parseDay(get(row, 'HB.warranty_expires')),
    });
  }
  return items;
}

/** `/maintenance?status=scheduled` -> entries with a scheduled day. */
export function parseMaintenance(list) {
  return (Array.isArray(list) ? list : [])
    .map((entry) => ({
      id: typeof entry?.id === 'string' ? entry.id : '',
      name: typeof entry?.name === 'string' ? entry.name.trim() : '',
      itemId: typeof entry?.itemID === 'string' ? entry.itemID : '',
      item: typeof entry?.itemName === 'string' ? entry.itemName.trim() : '',
      day: parseDay(entry?.scheduledDate),
      completed: parseDay(entry?.completedDate) !== null,
    }))
    .filter((entry) => entry.id && entry.day && !entry.completed);
}

/**
 * The top-level locations, each with the ids of every item below it
 * (sub-locations included).
 * @returns {{ id: string, name: string, itemIds: Set<string> }[]}
 */
export function parseLocations(tree) {
  const collect = (node, ids) => {
    for (const child of node?.children ?? []) {
      if (child?.type === 'item' && typeof child.id === 'string') {
        ids.add(child.id);
      }
      collect(child, ids);
    }
    return ids;
  };
  return (Array.isArray(tree) ? tree : [])
    .filter((node) => node?.type === 'location' && typeof node.id === 'string')
    .map((node) => ({
      id: node.id,
      name: String(node.name ?? '').trim() || node.id,
      itemIds: collect(node, new Set()),
    }));
}

// Homebox currency codes -> Gladys units (the others have none).
const CURRENCY_UNITS = { EUR: 'euro', USD: 'dollar', GBP: 'pound-sterling' };

export function currencyUnit(code) {
  return CURRENCY_UNITS[String(code ?? '').toUpperCase()] ?? null;
}

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * What every consumer reads.
 * @param {object} data { group, statistics, items, maintenance, locations }
 * @param {{ today: string, warrantyDays: number, maintenanceDays: number }} options
 */
export function summarize(data, { today, warrantyDays, maintenanceDays }) {
  const { group, statistics, items, maintenance, locations } = data;
  const active = items.filter((item) => !item.archived);
  const archivedIds = new Set(items.filter((item) => item.archived).map((item) => item.id));

  const warranties = active
    .filter((item) => !item.lifetime && item.warranty)
    .map((item) => ({ ...item, daysLeft: daysBetween(today, item.warranty) }))
    .filter((item) => item.daysLeft >= 0 && item.daysLeft <= warrantyDays)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));

  const scheduled = maintenance
    .filter((entry) => !archivedIds.has(entry.itemId))
    .map((entry) => ({ ...entry, daysLeft: daysBetween(today, entry.day) }))
    .sort((a, b) => a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
  const overdue = scheduled.filter((entry) => entry.daysLeft < 0);
  const upcoming = scheduled.filter(
    (entry) => entry.daysLeft >= 0 && entry.daysLeft <= maintenanceDays,
  );

  const value = (list) => round2(list.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const byId = new Map(active.map((item) => [item.id, item]));

  return {
    groupId: group.id,
    groupName: String(group.name ?? ''),
    currency: String(group.currency ?? '').toUpperCase(),
    items: Number.isFinite(statistics.totalItems) ? statistics.totalItems : active.length,
    locations: Number.isFinite(statistics.totalLocations) ? statistics.totalLocations : 0,
    value: Number.isFinite(statistics.totalItemPrice)
      ? round2(statistics.totalItemPrice)
      : value(active),
    warranties,
    overdue,
    upcoming,
    // Due today or earlier: what the "maintenance due" trigger announces.
    due: scheduled.filter((entry) => entry.daysLeft <= 0),
    nextMaintenance: scheduled[0] ?? null,
    activeItems: active,
    locationTotals: (locations ?? []).map((location) => {
      const inside = [...location.itemIds].map((id) => byId.get(id)).filter(Boolean);
      return { id: location.id, name: location.name, items: inside.length, value: value(inside) };
    }),
  };
}

/**
 * The items whose name matches `query`: the exact name (any case) first, then
 * the names containing it. Archived items are left out.
 */
export function findItems(items, query) {
  const wanted = String(query ?? '')
    .trim()
    .toLocaleLowerCase();
  if (wanted === '') {
    return [];
  }
  const active = items.filter((item) => !item.archived);
  const exact = active.filter((item) => item.name.toLocaleLowerCase() === wanted);
  const partial = active.filter(
    (item) =>
      item.name.toLocaleLowerCase() !== wanted && item.name.toLocaleLowerCase().includes(wanted),
  );
  const byName = (a, b) => a.name.localeCompare(b.name) || a.location.localeCompare(b.location);
  return [...exact.sort(byName), ...partial.sort(byName)];
}
