// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (a real GladysIntegration on an
// in-memory transport), the integration wired on it by registerHandlers, and
// a fake Homebox.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { API_KEY, HOST, NOW, createHomebox, settle } from './fakeHomebox.js';

export const FAST_TIMINGS = { widgetGap: 0, requestTimeout: 200 };

export async function createWorld({
  server = createHomebox(),
  config = { url: HOST, api_key: API_KEY },
  devices = [],
  connect = true,
  store = new MemoryStore(),
  clock = { now: NOW },
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: server.fetch,
    timings: FAST_TIMINGS,
    now: () => clock.now,
    store,
  });
  if (connect) {
    await gladys.connect();
    await settle(20);
  }
  return { gladys, app, hub: app.hub, server, store, clock, fake: gladys.fake };
}

// The Homebox group of the 0.26.2 fixtures.
export const GROUP = '7e3b9dd7-f28e-45db-b241-01910e7dd1d8';
export const homeboxDevice = (group = GROUP) => `ext:test-integration:homebox:${group}`;
export const homeboxFeature = (key, group = GROUP) => `${homeboxDevice(group)}:${key}`;
export const locationDevice = (id) => `ext:test-integration:location:${id}`;

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(fake) {
  for (const device of fake.discoveredDevices) {
    await fake.deviceCreated(device);
  }
  await settle();
}

export const DAY = 86_400_000;
