// -----------------------------------------------------------------------------
// The Homebox inventory -> Gladys devices, and their states.
//
// - one "Homebox" device per Homebox group (`homebox:<group id>`): counts,
//   total value, warranties ending soon, maintenance overdue and upcoming,
//   the next maintenance and the next warranty end as texts;
// - optionally one device per top-level location (`location:<location id>`):
//   number of items and their value, sub-locations included.
// Counts are counter-sensor/integer, values currency/decimal (Gladys knows
// euro, dollar and pound sterling; another currency goes into the name).
// Everything is read only: the integration never writes to Homebox.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPE,
} from '@gladysassistant/integration-sdk';
import { currencyUnit } from './homebox/model.js';
import { NAMES, NONE, formatDay } from './texts.js';

export const HOMEBOX_TYPE = 'homebox';
export const LOCATION_TYPE = 'location';

const MAX_COUNT = 1_000_000;
const MAX_VALUE = 1_000_000_000;

export const homeboxIds = (gladys, groupId) => gladys.externalIds(HOMEBOX_TYPE, groupId);
export const locationIds = (gladys, id) => gladys.externalIds(LOCATION_TYPE, id);

const readOnly = (ids, key, name, fields) => ({
  name,
  external_id: ids.feature(key),
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...fields,
});

const count = { category: CAT.COUNTER_SENSOR, type: TYPE.SENSOR.INTEGER, min: 0, max: MAX_COUNT };
const text = { category: CAT.TEXT, type: TYPE.TEXT.TEXT, min: 0, max: 0, keep_history: false };

function money(name, currency) {
  const unit = currencyUnit(currency);
  return [
    unit || !currency ? name : `${name} (${currency})`,
    {
      category: CAT.CURRENCY,
      type: TYPE.CURRENCY.DECIMAL,
      ...(unit ? { unit } : {}),
      min: 0,
      max: MAX_VALUE,
    },
  ];
}

/**
 * @param {object} gladys
 * @param {object} summary summarize()
 * @param {string} language
 * @param {string} url Homebox base URL (a device param, shown in Gladys)
 */
export function buildHomeboxDevice(gladys, summary, language, url) {
  const names = NAMES[language] ?? NAMES.en;
  const ids = homeboxIds(gladys, summary.groupId);
  const [valueName, valueFields] = money(names.value, summary.currency);
  return {
    name: 'Homebox',
    external_id: ids.device,
    model: (summary.groupName || 'Homebox').slice(0, 60),
    should_poll: false,
    features: [
      readOnly(ids, 'items', names.items, count),
      readOnly(ids, 'locations', names.locations, count),
      readOnly(ids, 'value', valueName, valueFields),
      readOnly(ids, 'warranties_expiring', names.warranties, count),
      readOnly(ids, 'maintenance_overdue', names.overdue, count),
      readOnly(ids, 'maintenance_upcoming', names.upcoming, count),
      readOnly(ids, 'next_maintenance', names.next_maintenance, text),
      readOnly(ids, 'next_warranty', names.next_warranty, text),
    ],
    params: [
      { name: 'HOMEBOX_URL', value: url },
      { name: 'HOMEBOX_GROUP', value: (summary.groupName || summary.groupId).slice(0, 100) },
    ],
  };
}

const cut = (value) => String(value).slice(0, 200);

export function buildHomeboxStates(gladys, summary, language) {
  const ids = homeboxIds(gladys, summary.groupId);
  const none = NONE[language] ?? NONE.en;
  const next = summary.nextMaintenance;
  const warranty = summary.warranties[0];
  const state = (key, value) => ({ device_feature_external_id: ids.feature(key), state: value });
  const words = (key, value) => ({
    device_feature_external_id: ids.feature(key),
    text: cut(value),
  });
  return [
    state('items', summary.items),
    state('locations', summary.locations),
    state('value', summary.value),
    state('warranties_expiring', summary.warranties.length),
    state('maintenance_overdue', summary.overdue.length),
    state('maintenance_upcoming', summary.upcoming.length),
    words(
      'next_maintenance',
      next ? `${next.name} · ${next.item} · ${formatDay(next.day, language)}` : none,
    ),
    words(
      'next_warranty',
      warranty ? `${warranty.name} · ${formatDay(warranty.warranty, language)}` : none,
    ),
  ];
}

/** @param {{ id: string, name: string }} location */
export function buildLocationDevice(gladys, location, summary, language, url) {
  const names = NAMES[language] ?? NAMES.en;
  const ids = locationIds(gladys, location.id);
  const [valueName, valueFields] = money(names.location_value, summary.currency);
  return {
    name: `Homebox ${location.name}`.slice(0, 60),
    external_id: ids.device,
    model: 'Homebox',
    should_poll: false,
    features: [
      readOnly(ids, 'items', names.location_items, count),
      readOnly(ids, 'value', valueName, valueFields),
    ],
    params: [{ name: 'HOMEBOX_URL', value: url }],
  };
}

export function buildLocationStates(gladys, location) {
  const ids = locationIds(gladys, location.id);
  return [
    { device_feature_external_id: ids.feature('items'), state: location.items },
    { device_feature_external_id: ids.feature('value'), state: location.value },
  ];
}

/** `ext:...:location:abc` -> { type: 'location', id: 'abc' }, or null when not ours. */
export function parseDeviceId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  for (const type of [HOMEBOX_TYPE, LOCATION_TYPE]) {
    const prefix = gladys.externalId(`${type}:`);
    if (externalId.startsWith(prefix)) {
      const id = externalId.slice(prefix.length).split(':')[0];
      return id === '' ? null : { type, id };
    }
  }
  return null;
}
