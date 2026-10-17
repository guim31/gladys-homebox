// -----------------------------------------------------------------------------
// A fake Homebox behind a `fetch` function, answering the bodies recorded on
// real servers (test/fixtures/homebox/<version>/): 0.26.2 (entities, API keys)
// and 0.21.0 (items, a wrong password answered in 500).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const HOST = 'http://192.0.2.30:7745';
export const EMAIL = 'demo@example.org';
export const PASSWORD = 'Demo-passw0rd!';
export const API_KEY = 'hb_test-key';
// 2026-10-17, noon local time: the day the fixtures were recorded.
export const NOW = new Date(2026, 9, 17, 12).getTime();

const fixture = (version, name) =>
  readFileSync(new URL(`../fixtures/homebox/${version}/${name}`, import.meta.url), 'utf8');

export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

export function createHomebox({ version = '0.26.2' } = {}) {
  const modern = version === '0.26.2';
  const state = {
    status: fixture(version, 'status.json'),
    group: fixture(version, 'group.json'),
    statistics: fixture(version, 'statistics.json'),
    csv: fixture(version, 'export.csv'),
    maintenance: fixture(version, 'maintenance-scheduled.json'),
    tree: fixture(version, 'tree.json'),
    tokens: new Set(),
    down: false,
    html: false,
    logins: 0,
    requests: [],
  };
  const answer = (status, body, type = 'application/json; charset=utf-8') =>
    new Response(body, { status, headers: { 'content-type': type } });

  async function fetch(url, init = {}) {
    const { pathname, search } = new URL(url);
    const path = pathname.replace(/^\/api\/v1/, '') + search;
    state.requests.push(`${init.method ?? 'GET'} ${path}`);
    if (state.down) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (state.html) {
      return answer(200, '<html>Login</html>', 'text/html');
    }
    if (path === '/status') {
      return answer(200, state.status);
    }
    if (path === '/users/login' && init.method === 'POST') {
      state.logins += 1;
      const body = JSON.parse(init.body);
      if (body.username !== EMAIL || body.password !== PASSWORD) {
        return modern
          ? answer(401, fixture(version, 'login-401.json'))
          : answer(500, fixture(version, 'login-500.json'));
      }
      const token = `Bearer TOKEN${state.logins}`;
      state.tokens.add(token);
      return answer(200, JSON.stringify({ token, expiresAt: '2026-11-14T10:56:34Z' }));
    }
    const auth = init.headers?.Authorization;
    const authorized = state.tokens.has(auth) || (modern && auth === `Bearer ${API_KEY}`);
    if (!authorized) {
      return answer(401, fixture(version, 'unauthorized.json'));
    }
    const routes = {
      '/groups': () => answer(200, state.group),
      '/groups/statistics': () => answer(200, state.statistics),
      '/maintenance?status=scheduled': () => answer(200, state.maintenance),
      [modern ? '/entities/export' : '/items/export']: () => answer(200, state.csv, 'text/csv'),
      [modern ? '/entities/tree?withItems=true' : '/locations/tree?withItems=true']: () =>
        answer(200, state.tree),
    };
    const route = routes[path];
    return route ? route() : answer(404, '404 page not found\n', 'text/plain; charset=utf-8');
  }

  return {
    fetch,
    state,
    goDown: () => {
      state.down = true;
    },
    goUp: () => {
      state.down = false;
    },
    /** Every login token stops working (expired). */
    expireTokens: () => state.tokens.clear(),
    /** Edit the CSV export: `edit(text) -> text`. */
    editCsv: (edit) => {
      state.csv = edit(state.csv);
    },
    setMaintenance: (list) => {
      state.maintenance = JSON.stringify(list);
    },
    setGroup: (patch) => {
      state.group = JSON.stringify({ ...JSON.parse(state.group), ...patch });
    },
  };
}
