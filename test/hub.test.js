// The integration end to end: the SDK's fake Gladys, the wiring of
// src/app.js and the fake Homebox built on real answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MemoryStore } from '../src/store.js';
import { TRIGGERS, WIDGET_KEY } from '../src/hub.js';
import { EMAIL, HOST, NOW, PASSWORD, createHomebox, settle } from './helpers/fakeHomebox.js';
import {
  DAY,
  createAll,
  createWorld,
  homeboxDevice,
  homeboxFeature,
  locationDevice,
} from './helpers/world.js';

test('one Homebox device, its states once added to Gladys', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(device.external_id, homeboxDevice());
  assert.equal(device.should_poll, false);
  assert.equal(world.fake.states.length, 0, 'nothing before the device is added');
  assert.equal(world.fake.connectionStatus.connected, true);

  await createAll(world.fake);
  const last = (key) => world.fake.lastState(homeboxFeature(key));
  assert.equal(last('items'), 6);
  assert.equal(last('locations'), 9);
  assert.equal(last('value'), 1255.89);
  assert.equal(last('warranties_expiring'), 2);
  assert.equal(last('maintenance_overdue'), 1);
  assert.equal(last('maintenance_upcoming'), 1);
  assert.equal(last('next_maintenance'), 'Oil the chuck · Cordless drill · 13/10/2026');
  assert.equal(last('next_warranty'), 'Cordless drill · 29/10/2026');
  assert.ok(world.fake.widgetRefreshes.includes(WIDGET_KEY));
});

test('the value feature: a Gladys unit, or the currency in its name', async (t) => {
  const server = createHomebox();
  server.setGroup({ currency: 'CHF' });
  const world = await createWorld({
    server,
    config: { url: HOST, api_key: 'hb_test-key', language: 'en' },
  });
  t.after(() => world.app.stop());
  const value = world.fake.discoveredDevices[0].features.find((f) =>
    f.external_id.endsWith(':value'),
  );
  assert.equal(value.name, 'Total value (CHF)');
  assert.equal(value.unit, undefined);
  const usd = await createWorld();
  t.after(() => usd.app.stop());
  assert.equal(
    usd.fake.discoveredDevices[0].features.find((f) => f.external_id.endsWith(':value')).unit,
    'dollar',
  );
});

test('location devices: top-level locations, their items and value', async (t) => {
  const world = await createWorld({
    config: { url: HOST, username: EMAIL, password: PASSWORD, location_devices: true },
  });
  t.after(() => world.app.stop());
  const devices = world.fake.discoveredDevices;
  assert.equal(devices.length, 9, 'the Homebox device and eight locations');
  const garage = devices.find((d) => d.name === 'Homebox Garage');
  await world.fake.deviceCreated(garage);
  await settle();
  assert.equal(world.fake.lastState(`${garage.external_id}:items`), 2);
  assert.equal(world.fake.lastState(`${garage.external_id}:value`), 548.9);
  assert.ok(garage.external_id.startsWith(locationDevice('')));
});

test('triggers: a silent baseline, then each warranty and maintenance once', async (t) => {
  const store = new MemoryStore();
  const clock = { now: NOW };
  const world = await createWorld({ store, clock });
  t.after(() => world.app.stop());
  assert.equal(world.fake.sceneEvents.length, 0, 'what is pending at install is not announced');
  assert.equal(store.data.warranty.length, 2);

  // Three days later: the brushes are due; the lawn mower is not in the window yet.
  clock.now = NOW + 3 * DAY;
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data]),
    [
      [
        TRIGGERS.maintenance,
        {
          maintenance: 'Replace brushes',
          item: 'Cordless drill',
          scheduled: '20/10/2026',
          days_late: 0,
        },
      ],
    ],
  );
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 1, 'once');

  // 17/12: the lawn mower's warranty (15/01/2027) enters the 30-day window.
  clock.now = NOW + 61 * DAY;
  await world.hub.refresh();
  // The kettle's descaling (26/11) fell due meanwhile.
  assert.deepEqual(
    world.fake.sceneEvents.slice(1).map((e) => [e.key, e.data.maintenance ?? e.data.item]),
    [
      [TRIGGERS.warranty, 'Lawn mower'],
      [TRIGGERS.maintenance, 'Descale'],
    ],
  );
  const warranty = world.fake.sceneEvents[1];
  assert.deepEqual(warranty.data, {
    item: 'Lawn mower',
    location: 'Garage',
    expires: '15/01/2027',
    days_left: 29,
  });
  const count = world.fake.sceneEvents.length;

  // A restart keeps what was announced (the store under /data).
  await world.app.stop();
  const again = await createWorld({ store, clock });
  t.after(() => again.app.stop());
  assert.equal(again.fake.sceneEvents.length, 0);
  assert.equal(world.fake.sceneEvents.length, count);
});

test('a new warranty entering the window fires; a postponed date fires again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.editCsv((csv) => csv.replace('2027-01-15', '2026-11-01'));
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.item, e.data.days_left]),
    [[TRIGGERS.warranty, 'Lawn mower', 15]],
  );
});

test('the language of the configuration: names, texts and event dates', async (t) => {
  const world = await createWorld({
    config: { url: HOST, api_key: 'hb_test-key', language: 'de' },
  });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices[0].features.map((f) => f.name);
  assert.ok(names.includes('Überfällige Wartungen'), names.join(', '));
  await createAll(world.fake);
  assert.equal(
    world.fake.lastState(homeboxFeature('next_warranty')),
    'Cordless drill · 29.10.2026',
  );
});

test('connection status: address, credentials, refused, unreachable, back', async (t) => {
  const none = await createWorld({ config: {} });
  t.after(() => none.app.stop());
  assert.equal(none.fake.connectionStatus.connected, false);
  assert.match(none.fake.connectionStatus.message.en, /address of Homebox/);

  const noAuth = await createWorld({ config: { url: HOST } });
  t.after(() => noAuth.app.stop());
  assert.match(noAuth.fake.connectionStatus.message.fr, /clé d'API/);

  const refused = await createWorld({ config: { url: HOST, username: EMAIL, password: 'nope' } });
  t.after(() => refused.app.stop());
  assert.match(refused.fake.connectionStatus.message.en, /Access refused/);

  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.goDown();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.es, /no responde/);
  world.server.goUp();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('"Test the connection" reports the version and the counts', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.action('test_connection', {});
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.message.fr, 'Homebox 0.26.2 répond : 6 objet(s) dans 9 emplacement(s).');
  assert.equal(ack.data.message.en, 'Homebox 0.26.2 answers: 6 item(s) in 9 location(s).');
});

test('find_item: found with its location and quantity, or not found', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const found = await world.fake.sceneAction('find_item', { name: 'batteries aa' });
  assert.equal(found.success, true, found.error);
  assert.deepEqual(found.data.outputs, {
    found: true,
    matches: 1,
    item: 'Batteries AA',
    location: 'Kitchen',
    quantity: 24,
  });
  const none = await world.fake.sceneAction('find_item', { name: 'Toaster' });
  assert.deepEqual(none.data.outputs, {
    found: false,
    matches: 0,
    item: '',
    location: '',
    quantity: 0,
  });
  world.server.goDown();
  const down = await world.fake.sceneAction('find_item', { name: 'pan' });
  assert.equal(down.success, false);
  assert.match(down.error, /Homebox ne répond pas/);
});

test('the widget: tiles, the soonest events, within the core budget', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language });
    assert.equal(ack.success, true, ack.error);
    assert.deepEqual(validateWidgetContent(ack.data.content), [], language);
  }
  const { content } = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' }))
    .data;
  const [items, value, warranties, maintenance, list] = content.components;
  assert.deepEqual([items.value, value.value, value.unit], [6, 1256, '$']);
  assert.equal(warranties.value, 2);
  assert.equal(maintenance.value, 2);
  assert.equal(maintenance.color, 'danger');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle]),
    [
      ['Oil the chuck · Cordless drill', '4 day(s) late'],
      ['Replace brushes · Cordless drill', 'In 3 day(s)'],
      ['Warranty ends · Cordless drill', 'In 12 day(s)'],
      ['Warranty ends · Dishwasher', 'In 30 day(s)'],
    ],
  );
  world.server.setMaintenance([]);
  world.server.editCsv((csv) => csv.replace(/2026-1[01]-\d\d/g, '2030-01-01'));
  await world.hub.refresh();
  const empty = (await world.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'fr' })).data
    .content;
  assert.equal(empty.components.at(-1).type, 'text');
  assert.deepEqual(validateWidgetContent(empty), []);

  const waiting = await createWorld({ config: {} });
  t.after(() => waiting.app.stop());
  const wait = (await waiting.fake.widgetGet(WIDGET_KEY, { settings: {}, language: 'en' })).data
    .content;
  assert.match(wait.components[0].text, /Waiting for Homebox/);
});

test('the container reads Homebox on its own timer (no Gladys poll needed)', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const world = await createWorld({
    config: { url: HOST, api_key: 'hb_test-key', refresh_minutes: '5' },
  });
  t.after(() => world.app.stop());
  const before = world.server.state.requests.length;
  t.mock.timers.tick(5 * 60_000);
  await settle(20);
  assert.ok(world.server.state.requests.length > before, 'a read every 5 minutes');
});

test('a configuration change: new names without a new read; a new address reads again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const reads = world.server.state.requests.length;
  await world.fake.configUpdated({ url: HOST, api_key: 'hb_test-key', language: 'en' });
  await settle();
  assert.equal(world.server.state.requests.length, reads);
  assert.ok(world.fake.discoveredDevices[0].features.some((f) => f.name === 'Overdue maintenance'));
  await world.fake.configUpdated({ url: HOST, username: EMAIL, password: PASSWORD });
  await settle();
  assert.ok(world.server.state.requests.length > reads);
  assert.equal(world.server.state.logins, 1);
});

test('onPoll answers; onDeviceCreated publishes every state again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const count = world.fake.states.length;
  assert.equal((await world.fake.poll(world.fake.discoveredDevices[0])).success, true);
  assert.equal(world.fake.states.length, count, 'only the changes are published');
  await createAll(world.fake);
  assert.equal(world.fake.states.length, count * 2);
});
