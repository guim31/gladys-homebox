// The Homebox answers recorded on real servers (0.26.2 and 0.21.0) -> plain
// values, and the summary every consumer reads, on 2026-10-17.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  currencyUnit,
  daysBetween,
  findItems,
  localDay,
  parseCsv,
  parseDay,
  parseExport,
  parseLocations,
  parseMaintenance,
  summarize,
} from '../src/homebox/model.js';

const read = async (version, name) =>
  readFile(new URL(`./fixtures/homebox/${version}/${name}`, import.meta.url), 'utf8');
const json = async (version, name) => JSON.parse(await read(version, name));

async function load(version) {
  return {
    group: await json(version, 'group.json'),
    statistics: await json(version, 'statistics.json'),
    items: parseExport(await read(version, 'export.csv')),
    maintenance: parseMaintenance(await json(version, 'maintenance-scheduled.json')),
    locations: parseLocations(await json(version, 'tree.json')),
  };
}

const OPTIONS = { today: '2026-10-17', warrantyDays: 30, maintenanceDays: 7 };

test('CSV: quotes, doubled quotes, line breaks inside a field, CRLF, BOM', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, ""y""","line\none"\n'), [
    ['a', 'b'],
    ['x, "y"', 'line\none'],
  ]);
  assert.deepEqual(parseCsv('﻿a,b\n1,'), [
    ['a', 'b'],
    ['1', ''],
  ]);
  assert.deepEqual(parseCsv(''), []);
});

test('dates: calendar days, the local day, whole days between', () => {
  assert.equal(parseDay('2026-10-29'), '2026-10-29');
  assert.equal(parseDay('2026-10-29T00:00:00Z'), '2026-10-29');
  assert.equal(parseDay('0001-01-01T00:00:00Z'), null);
  assert.equal(parseDay(''), null);
  assert.equal(localDay(new Date(2026, 9, 17, 23, 59).getTime()), '2026-10-17');
  assert.equal(daysBetween('2026-10-17', '2026-10-29'), 12);
  // Across the switch to winter time (25/10/2026 in Europe): still whole days.
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  assert.equal(daysBetween('2026-10-17', '2026-10-13'), -4);
});

for (const version of ['0.26.2', '0.21.0']) {
  test(`the export of Homebox ${version}: items only, every column read`, async () => {
    const items = parseExport(await read(version, 'export.csv'));
    assert.equal(items.length, 7, 'the locations of 0.26 are left out');
    const drill = items.find((item) => item.name === 'Cordless drill');
    assert.match(drill.id, /^[0-9a-f-]{36}$/);
    assert.equal(drill.location, 'Garage / Workbench shelf');
    assert.equal(drill.price, 149.9);
    assert.equal(drill.warranty, '2026-10-29');
    assert.equal(drill.lifetime, false);
    const kettle = items.find((item) => item.name.startsWith('Electric kettle'));
    assert.equal(kettle.name, 'Electric kettle, "glass"');
    assert.equal(items.find((item) => item.name === 'Cast iron pan').lifetime, true);
    assert.equal(items.find((item) => item.name === 'Batteries AA').quantity, 24);
    assert.equal(items.find((item) => item.name === 'Broken toaster').archived, true);
  });

  test(`the summary of Homebox ${version} on 2026-10-17`, async () => {
    const summary = summarize(await load(version), OPTIONS);
    assert.equal(summary.items, 6);
    assert.equal(summary.locations, 9);
    assert.equal(summary.value, 1255.89);
    assert.equal(summary.currency, 'USD');
    // Drill (12 days) and dishwasher (30 days, the last day of the window);
    // not the mower (90), the kettle (ended), the pan (lifetime), the toaster (archived).
    assert.deepEqual(
      summary.warranties.map((item) => [item.name, item.daysLeft]),
      [
        ['Cordless drill', 12],
        ['Dishwasher', 30],
      ],
    );
    assert.deepEqual(
      summary.overdue.map((entry) => [entry.name, entry.daysLeft]),
      [['Oil the chuck', -4]],
    );
    assert.deepEqual(
      summary.upcoming.map((entry) => [entry.name, entry.daysLeft]),
      [['Replace brushes', 3]],
    );
    assert.equal(summary.nextMaintenance.name, 'Oil the chuck');
    assert.deepEqual(
      summary.due.map((entry) => entry.name),
      ['Oil the chuck'],
    );
    // Top-level locations, sub-locations included, archived items left out.
    const totals = Object.fromEntries(
      summary.locationTotals.map((location) => [location.name, [location.items, location.value]]),
    );
    assert.deepEqual(totals.Garage, [2, 548.9]);
    assert.deepEqual(totals.Kitchen, [4, 706.99]);
    assert.deepEqual(totals.Attic, [0, 0]);
  });
}

test('the windows of the configuration move the counts', async () => {
  const data = await load('0.26.2');
  const narrow = summarize(data, { today: '2026-10-17', warrantyDays: 10, maintenanceDays: 0 });
  assert.equal(narrow.warranties.length, 0);
  assert.equal(narrow.upcoming.length, 0);
  // The day the drill's warranty ends, it still counts (0 day left).
  const last = summarize(data, { ...OPTIONS, today: '2026-10-29' });
  assert.deepEqual(
    last.warranties.map((item) => [item.name, item.daysLeft]),
    [
      ['Cordless drill', 0],
      ['Dishwasher', 18],
    ],
  );
  assert.equal(summarize(data, { ...OPTIONS, today: '2026-10-30' }).warranties.length, 1);
});

test('maintenance of an archived item, or completed, is left out', () => {
  const entries = parseMaintenance([
    { id: 'a', name: 'Clean', itemID: 'x', itemName: 'Toaster', scheduledDate: '2026-10-10' },
    {
      id: 'b',
      name: 'Done',
      itemID: 'y',
      itemName: 'Pan',
      scheduledDate: '2026-10-10',
      completedDate: '2026-10-11',
    },
    { id: 'c', name: 'No date', itemID: 'y', itemName: 'Pan', scheduledDate: '' },
  ]);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['a'],
  );
  const summary = summarize(
    {
      group: { id: 'g', currency: 'EUR' },
      statistics: { totalItems: 0, totalLocations: 0, totalItemPrice: 0 },
      items: [{ id: 'x', name: 'Toaster', location: '', archived: true, quantity: 1, price: 1 }],
      maintenance: entries,
      locations: [],
    },
    OPTIONS,
  );
  assert.equal(summary.overdue.length, 0);
  assert.equal(parseMaintenance(null).length, 0);
});

test('item search: exact name first, then partial, archived left out', async () => {
  const { items } = await load('0.26.2');
  assert.deepEqual(
    findItems(items, 'batteries aa').map((item) => item.name),
    ['Batteries AA'],
  );
  assert.deepEqual(
    findItems(items, 'Batter').map((item) => [item.location, item.quantity]),
    [['Kitchen', 24]],
  );
  assert.deepEqual(findItems(items, 'toaster'), []);
  assert.deepEqual(findItems(items, '  '), []);
});

test('currencies Gladys has a unit for', () => {
  assert.equal(currencyUnit('EUR'), 'euro');
  assert.equal(currencyUnit('usd'), 'dollar');
  assert.equal(currencyUnit('GBP'), 'pound-sterling');
  assert.equal(currencyUnit('CHF'), null);
});
