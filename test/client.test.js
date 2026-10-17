// The Homebox client against the fake server built on the real answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HomeboxClient } from '../src/homebox/client.js';
import { API_KEY, EMAIL, HOST, PASSWORD, createHomebox } from './helpers/fakeHomebox.js';

const client = (server, options) =>
  new HomeboxClient({ url: HOST, fetch: server.fetch, timeout: 200, ...options });

test('an API key (0.26): no login, the 0.26 paths found once', async () => {
  const server = createHomebox();
  const hb = client(server, { apiKey: API_KEY });
  assert.equal((await hb.status()).build.version, 'v0.26.2');
  assert.equal((await hb.group()).currency, 'USD');
  assert.equal((await hb.statistics()).totalTags, 7);
  assert.match(await hb.exportCsv(), /^HB\.import_ref/);
  assert.equal((await hb.tree()).length, 8);
  assert.equal((await hb.scheduledMaintenance()).length, 3);
  assert.equal(hb.flavor, 'entities');
  assert.equal(server.state.logins, 0);
});

test('e-mail and password on 0.21: a login, then the older paths', async () => {
  const server = createHomebox({ version: '0.21.0' });
  const hb = client(server, { username: EMAIL, password: PASSWORD });
  assert.equal((await hb.statistics()).totalLabels, 7);
  assert.match(await hb.exportCsv(), /^HB\.import_ref,HB\.location/);
  assert.equal(hb.flavor, 'items');
  assert.equal(server.state.logins, 1);
  await hb.tree();
  assert.ok(server.state.requests.includes('GET /locations/tree?withItems=true'));
  assert.ok(!server.state.requests.includes('GET /entities/tree?withItems=true'));
});

test('an expired login token: one more login, then the request again', async () => {
  const server = createHomebox();
  const hb = client(server, { username: EMAIL, password: PASSWORD });
  await hb.group();
  server.expireTokens();
  assert.equal((await hb.group()).currency, 'USD');
  assert.equal(server.state.logins, 2);
});

test('a wrong password is "unauthorized": 401 on 0.26, 500 on 0.21', async () => {
  for (const version of ['0.26.2', '0.21.0']) {
    const hb = client(createHomebox({ version }), { username: EMAIL, password: 'wrong' });
    await assert.rejects(hb.group(), { kind: 'unauthorized' }, version);
  }
  const hb = client(createHomebox(), { apiKey: 'hb_wrong' });
  await assert.rejects(hb.statistics(), { kind: 'unauthorized' });
  // An API key on a Homebox older than 0.26: refused too.
  const old = client(createHomebox({ version: '0.21.0' }), { apiKey: API_KEY });
  await assert.rejects(old.statistics(), { kind: 'unauthorized' });
});

test('unreachable, a proxy page instead of Homebox', async () => {
  const server = createHomebox();
  server.goDown();
  await assert.rejects(client(server, { apiKey: API_KEY }).status(), {
    kind: 'unreachable',
    message: 'Homebox unreachable (ECONNREFUSED)',
  });
  server.goUp();
  server.state.html = true;
  await assert.rejects(client(server, { apiKey: API_KEY }).status(), { kind: 'invalid' });
});

test('no credential in an error message', async () => {
  const server = createHomebox();
  const hb = client(server, { username: EMAIL, password: 'hunter2' });
  const error = await hb.group().catch((err) => err);
  assert.ok(!error.message.includes('hunter2'));
  assert.ok(!error.message.includes(EMAIL));
});

test('Homebox upgraded from 0.21 to 0.26 while running: the 0.26 paths are found again', async () => {
  const old = createHomebox({ version: '0.21.0' });
  const modern = createHomebox();
  let current = old;
  const hb = new HomeboxClient({
    url: HOST,
    username: EMAIL,
    password: PASSWORD,
    fetch: (...args) => current.fetch(...args),
    timeout: 200,
  });
  await hb.exportCsv();
  assert.equal(hb.flavor, 'items');
  current = modern;
  assert.match(await hb.exportCsv(), /HB\.parent_import_ref/);
  assert.equal(hb.flavor, 'entities');
});

test('two requests refused at once: a single new login, both succeed', async () => {
  const server = createHomebox();
  const hb = client(server, { username: EMAIL, password: PASSWORD });
  await hb.group();
  server.expireTokens();
  const [stats, group] = await Promise.all([hb.statistics(), hb.group()]);
  assert.equal(stats.totalItems, 6);
  assert.equal(group.currency, 'USD');
  assert.equal(server.state.logins, 2);
});
