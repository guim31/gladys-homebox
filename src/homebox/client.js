// -----------------------------------------------------------------------------
// The REST API of Homebox (`<base>/api/v1/...`), the few calls the integration
// needs. Read only: the integration never writes to Homebox.
//
// Facts checked on real servers, Homebox 0.26.2 and 0.21.0
// (ghcr.io/sysadminsmedia/homebox), see test/fixtures/homebox/:
// - `POST /users/login` answers `{ token: "Bearer XXX", expiresAt }`: the
//   token carries its scheme. A wrong password is a 401 on 0.26, but a 500
//   with the JSON string "invalid username or password" on 0.21;
// - 0.26 adds API keys (`hb_...`, sent as `Authorization: Bearer hb_...`);
// - 0.26 merged items and locations into "entities": `/items/export` and
//   `/locations/tree` became `/entities/export` and `/entities/tree` (404 on
//   the other version). `/groups`, `/groups/statistics` and
//   `/maintenance?status=scheduled` are the same on both, except
//   `totalLabels` renamed `totalTags`;
// - the CSV export is the only list that carries the warranty of every item
//   in one request (the item summaries do not).
// -----------------------------------------------------------------------------

export const DEFAULT_TIMEOUT = 15_000;

export class HomeboxError extends Error {
  /**
   * @param {'unreachable' | 'unauthorized' | 'not_found' | 'timeout' | 'http' | 'invalid'} kind
   * @param {string} message never carries a credential
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'HomeboxError';
    this.kind = kind;
    this.status = status;
  }
}

export class HomeboxClient {
  /**
   * @param {object} options
   * @param {string} options.url normalized base URL (see normalizeUrl)
   * @param {string} [options.apiKey]
   * @param {string} [options.username]
   * @param {string} [options.password]
   * @param {typeof fetch} [options.fetch]
   * @param {number} [options.timeout]
   */
  constructor({ url, apiKey = '', username = '', password = '', fetch: fetchImpl, timeout }) {
    this.url = url;
    this.apiKey = apiKey;
    this.username = username;
    this.password = password;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
    this.token = null;
    this.logging = null;
    /** 'entities' (0.26+) or 'items' (older), found on the first export */
    this.flavor = null;
  }

  get apiUrl() {
    return `${this.url}/api/v1`;
  }

  async #send(method, path, { body, auth } = {}) {
    const headers = { Accept: 'application/json, text/csv' };
    if (auth) {
      headers.Authorization = auth;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await this.fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new HomeboxError('timeout', `No answer from Homebox within ${this.timeout} ms`);
      }
      const cause = err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'error';
      throw new HomeboxError('unreachable', `Homebox unreachable (${cause})`);
    }
    const raw = await response.text().catch(() => '');
    return {
      status: response.status,
      ok: response.ok,
      raw,
      type: response.headers?.get?.('content-type') ?? '',
    };
  }

  static #fail(path, { status, raw }) {
    let detail = `HTTP ${status}`;
    try {
      const data = JSON.parse(raw);
      if (typeof data === 'string') {
        detail = data;
      } else if (typeof data?.error === 'string') {
        detail = data.error;
      }
    } catch {
      // not JSON: keep the status
    }
    const kind =
      status === 401 || status === 403 ? 'unauthorized' : status === 404 ? 'not_found' : 'http';
    return new HomeboxError(kind, `${path}: ${detail.slice(0, 120)}`, status);
  }

  static #json(path, answer) {
    if (answer.raw === '') {
      return null;
    }
    try {
      return JSON.parse(answer.raw);
    } catch {
      // A proxy login page answering 200 in HTML, for instance.
      throw new HomeboxError('invalid', `${path}: the answer is not JSON (is this Homebox?)`);
    }
  }

  /** Log in with the e-mail and password (one login at a time). */
  login() {
    if (!this.logging) {
      this.logging = (async () => {
        const answer = await this.#send('POST', '/users/login', {
          body: { username: this.username, password: this.password, stayLoggedIn: true },
        });
        if (!answer.ok) {
          const error = HomeboxClient.#fail('/users/login', answer);
          // Homebox 0.21 answers a wrong password with a 500.
          if (/invalid username or password/i.test(error.message)) {
            error.kind = 'unauthorized';
          }
          throw error;
        }
        const token = HomeboxClient.#json('/users/login', answer)?.token;
        if (typeof token !== 'string' || token === '') {
          throw new HomeboxError('invalid', 'Homebox answered the login without a token');
        }
        this.token = /^bearer /i.test(token) ? token : `Bearer ${token}`;
      })().finally(() => {
        this.logging = null;
      });
    }
    return this.logging;
  }

  /** An authenticated request; a login token refused (expired) logs in once more. */
  async #get(path) {
    if (this.apiKey) {
      const answer = await this.#send('GET', path, { auth: `Bearer ${this.apiKey}` });
      if (!answer.ok) {
        throw HomeboxClient.#fail(path, answer);
      }
      return answer;
    }
    if (!this.username || !this.password) {
      throw new HomeboxError('unauthorized', 'No API key nor e-mail and password');
    }
    const fresh = !this.token;
    if (fresh) {
      await this.login();
    }
    let answer = await this.#send('GET', path, { auth: this.token });
    if (answer.status === 401 && !fresh) {
      this.token = null;
      await this.login();
      answer = await this.#send('GET', path, { auth: this.token });
    }
    if (!answer.ok) {
      throw HomeboxClient.#fail(path, answer);
    }
    return answer;
  }

  async #getJson(path) {
    return HomeboxClient.#json(path, await this.#get(path));
  }

  /** `{ build: { version } }`, no authentication needed. */
  async status() {
    const answer = await this.#send('GET', '/status');
    if (!answer.ok) {
      throw HomeboxClient.#fail('/status', answer);
    }
    const data = HomeboxClient.#json('/status', answer);
    if (!data || typeof data !== 'object' || typeof data.health !== 'boolean') {
      throw new HomeboxError('invalid', 'This address does not answer like Homebox');
    }
    return data;
  }

  /** The group of the user: `{ id, name, currency }`. */
  async group() {
    const data = await this.#getJson('/groups');
    if (!data || typeof data.id !== 'string') {
      throw new HomeboxError('invalid', 'Homebox did not answer its group');
    }
    return data;
  }

  /** `{ totalItems, totalLocations, totalItemPrice, totalWithWarranty, ... }` */
  async statistics() {
    const data = await this.#getJson('/groups/statistics');
    if (!data || typeof data !== 'object' || typeof data.totalItems !== 'number') {
      throw new HomeboxError('invalid', 'Homebox did not answer its statistics');
    }
    return data;
  }

  /** The maintenance entries not completed yet, of every item. */
  async scheduledMaintenance() {
    const data = await this.#getJson('/maintenance?status=scheduled');
    // An inventory without maintenance may answer null.
    return Array.isArray(data) ? data : [];
  }

  /** Try the 0.26 path, then the older one (remembered once found). */
  async #either(entities, items) {
    if (this.flavor) {
      return this.#get(this.flavor === 'entities' ? entities : items);
    }
    try {
      const answer = await this.#get(entities);
      this.flavor = 'entities';
      return answer;
    } catch (err) {
      if (err instanceof HomeboxError && err.kind === 'not_found') {
        const answer = await this.#get(items);
        this.flavor = 'items';
        return answer;
      }
      throw err;
    }
  }

  /** The CSV export of the whole inventory (text). */
  async exportCsv() {
    const answer = await this.#either('/entities/export', '/items/export');
    if (!answer.raw.startsWith('HB.') && !answer.raw.startsWith('﻿HB.')) {
      throw new HomeboxError('invalid', 'Homebox did not answer a CSV export');
    }
    return answer.raw;
  }

  /** The location tree, with the items under each location. */
  async tree() {
    const answer = await this.#either(
      '/entities/tree?withItems=true',
      '/locations/tree?withItems=true',
    );
    const data = HomeboxClient.#json('/tree', answer);
    return Array.isArray(data) ? data : [];
  }
}
