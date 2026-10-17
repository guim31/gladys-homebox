// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// The port Homebox listens on out of the box (its Docker image exposes 7745).
export const DEFAULT_PORT = 7745;

export const REFRESH_MINUTES = ['5', '15', '30', '60'];
export const WARRANTY_DAYS = { min: 1, max: 365, default: 30 };
export const MAINTENANCE_DAYS = { min: 0, max: 90, default: 7 };

export const DEFAULT_CONFIG = {
  url: '',
  api_key: '',
  username: '',
  password: '',
  warranty_days: WARRANTY_DAYS.default,
  maintenance_days: MAINTENANCE_DAYS.default,
  location_devices: false,
  refresh_minutes: '15',
  language: 'fr',
};

/**
 * Turn what the user typed into the base URL of Homebox, without `/api/v1`:
 * - `192.0.2.10` or `homebox.local` (no scheme, no port): port 7745;
 * - `192.0.2.10:3100`: that port;
 * - `https://example.org/homebox/`: exactly that address (reverse proxy).
 * A pasted `/api/v1` suffix is dropped. Returns null when it is not usable.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeUrl(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const text = raw.trim();
  if (text === '') {
    return null;
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  let url;
  try {
    url = new URL(hasScheme ? text : `http://${text}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname === '') {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) {
    // Credentials in the URL would end up in logs and error messages.
    return null;
  }
  if (!hasScheme && url.port === '') {
    url.port = String(DEFAULT_PORT);
  }
  const path = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/api(\/v1)?$/i, '')
    .replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${path}`;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function integer(value, { min, max, default: fallback }) {
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const typed = text(source.url);
  const url = normalizeUrl(typed);
  // An API key pasted with its scheme ("Bearer hb_...") works as well.
  const apiKey = text(source.api_key).replace(/^bearer\s+/i, '');
  const username = text(source.username);
  // A password may legitimately start or end with a space: kept as typed.
  const password = typeof source.password === 'string' ? source.password : '';
  const locations = source.location_devices;
  const refresh = String(source.refresh_minutes ?? '');
  return {
    url,
    urlInvalid: typed !== '' && url === null,
    apiKey,
    username,
    password,
    // An API key wins: it needs no login and survives a password change.
    hasCredentials: apiKey !== '' || (username !== '' && password !== ''),
    warrantyDays: integer(source.warranty_days, WARRANTY_DAYS),
    maintenanceDays: integer(source.maintenance_days, MAINTENANCE_DAYS),
    locationDevices: locations === true || locations === 'true',
    refreshMinutes: Number(
      REFRESH_MINUTES.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_minutes,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
