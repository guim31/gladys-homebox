// -----------------------------------------------------------------------------
// The hub: the link to one Homebox and everything Gladys sees of it — devices,
// states, connection status, scene events, the item search.
//
// Homebox pushes nothing: the inventory is read every `refresh_minutes`
// (15 by default) by a timer of the container (should_poll: false, the
// interval being beyond the core's 60 s list). A read is five requests:
// status (once), group, statistics, the CSV export, the scheduled maintenance,
// plus the location tree when the location devices are on.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  HOMEBOX_TYPE,
  LOCATION_TYPE,
  buildHomeboxDevice,
  buildHomeboxStates,
  buildLocationDevice,
  buildLocationStates,
  homeboxIds,
  locationIds,
  parseDeviceId,
} from './devices.js';
import { HomeboxClient, HomeboxError } from './homebox/client.js';
import {
  findItems,
  localDay,
  parseExport,
  parseLocations,
  parseMaintenance,
  summarize,
} from './homebox/model.js';
import { MemoryStore } from './store.js';
import { STATUS_TEXT, TEST_TEXT, commandMessage, formatDay } from './texts.js';

const logger = createLogger({ name: 'homebox-hub' });

export const WIDGET_KEY = 'summary';
export const TRIGGERS = { warranty: 'warranty_expiring', maintenance: 'maintenance_due' };

export const DEFAULT_TIMINGS = {
  // requestWidgetRefresh is dropped by the core beyond one call per 10 s.
  widgetGap: 10_500,
  // An unchanged value is sent again before Gladys calls it stale (48 h).
  heartbeat: 6 * 3_600_000,
  requestTimeout: 15_000,
};

// A CSV import can bring hundreds of items at once: past that many events in
// one read, the rest is recorded as announced without firing.
export const MAX_EVENTS_PER_READ = 10;

/** An Error carrying a coded, multi-language message. */
export class CommandError extends Error {
  constructor(code, language) {
    const messages = commandMessage(code);
    super(messages[language] ?? messages.en);
    this.code = code;
    this.messages = messages;
  }
}

const linkOf = (config) =>
  JSON.stringify([config.url, config.apiKey, config.username, config.password]);

export class Hub {
  constructor({ gladys, fetch, timings, now = Date.now, store }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.now = now;
    this.store = store ?? new MemoryStore();
    this.config = {
      url: null,
      urlInvalid: false,
      hasCredentials: false,
      warrantyDays: 30,
      maintenanceDays: 7,
      locationDevices: false,
      refreshMinutes: 15,
      language: 'fr',
    };
    this.client = null;
    this.version = null;
    /** the last raw read: { group, statistics, items, maintenance, locations } */
    this.data = null;
    this.summary = null;
    /** null (fine), or the kind of the last failure */
    this.failure = null;
    this.announced = false;
    this.lastStatus = '';
    /** what the triggers already announced: { groupId, warranty: [], maintenance: [] } */
    this.notified = null;
    this.configuring = Promise.resolve();
    this.refreshTimer = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.widgetRefreshAt = 0;
    this.widgetTimer = null;
    this.publishFailing = false;
    this.stopped = false;
  }

  get language() {
    return this.config.language;
  }

  get loaded() {
    return this.summary !== null;
  }

  async start(config) {
    const saved = await this.store.load();
    this.notified = typeof saved.groupId === 'string' ? saved : null;
    await this.reconfigure(config);
  }

  /** One configuration change at a time: a second one waits for the first. */
  reconfigure(config) {
    const run = this.configuring.then(() => this.#reconfigure(config));
    this.configuring = run.catch(() => {});
    return run;
  }

  async #reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const linkChanged = linkOf(previous) !== linkOf(config) || !this.client;
    if (linkChanged || previous.refreshMinutes !== config.refreshMinutes) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (linkChanged) {
      this.client = null;
      this.version = null;
      this.data = null;
      this.summary = null;
      this.failure = null;
      this.announced = false;
      if (config.url && config.hasCredentials) {
        this.client = new HomeboxClient({
          url: config.url,
          apiKey: config.apiKey,
          username: config.username,
          password: config.password,
          fetch: this.fetch,
          timeout: this.timings.requestTimeout,
        });
      }
    }
    if (this.client && !this.refreshTimer) {
      this.refreshTimer = setInterval(() => this.refresh(), config.refreshMinutes * 60_000);
      this.refreshTimer.unref?.();
    }
    if (linkChanged || previous.locationDevices !== config.locationDevices) {
      // A first read, or the location tree is now needed.
      await this.refresh();
    } else {
      // Language or windows only: same data, new names, texts and counts.
      this.gladys.forgetPublishedStates?.();
      await this.#update();
    }
    await this.updateConnectionStatus();
  }

  /** Gladys reconnected (it may have restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.lastStatus = '';
    await this.reconfigure(config);
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer);
    clearTimeout(this.widgetTimer);
    this.refreshTimer = null;
    await this.store.flush();
  }

  // --- Reading Homebox ------------------------------------------------------

  /** Read the inventory (one read at a time; a request during it runs once after). */
  refresh() {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        await this.#refreshOnce();
      } while (this.refreshAgain && !this.stopped);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async #refreshOnce() {
    const client = this.client;
    if (this.stopped) {
      return;
    }
    if (!client) {
      await this.publishDevices();
      return;
    }
    let data;
    try {
      if (!this.version) {
        this.version = String((await client.status())?.build?.version ?? '?').replace(/^v/, '');
      }
      const group = await client.group();
      const [statistics, csv, maintenance, tree] = await Promise.all([
        client.statistics(),
        client.exportCsv(),
        client.scheduledMaintenance(),
        this.config.locationDevices ? client.tree() : Promise.resolve(null),
      ]);
      data = {
        group,
        statistics,
        items: parseExport(csv),
        maintenance: parseMaintenance(maintenance),
        locations: tree ? parseLocations(tree) : [],
      };
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.#fail(err);
      await this.updateConnectionStatus();
      return;
    }
    if (client !== this.client || this.stopped) {
      return;
    }
    this.data = data;
    this.#recover();
    await this.#update();
    await this.#announce();
    await this.updateConnectionStatus();
  }

  /** Summary, devices, states and widget from the last read. */
  async #update() {
    if (this.data) {
      this.summary = summarize(this.data, {
        today: localDay(this.now()),
        warrantyDays: this.config.warrantyDays,
        maintenanceDays: this.config.maintenanceDays,
      });
    }
    await this.publishDevices();
    await this.publishStates();
    this.refreshWidget();
  }

  #fail(err) {
    const kind = err instanceof HomeboxError ? err.kind : 'unreachable';
    if (this.failure === null) {
      logger.warn(`Homebox: ${err.message}`);
    } else {
      logger.debug(`Homebox still failing: ${err.message}`);
    }
    this.failure = kind;
    if (kind === 'invalid') {
      this.version = null;
    }
  }

  #recover() {
    const count = this.data.statistics.totalItems;
    if (this.failure !== null) {
      logger.info(`Homebox answers again (${count} items)`);
    } else if (!this.announced) {
      logger.info(`Connected to Homebox ${this.version} (${count} items)`);
    }
    this.announced = true;
    this.failure = null;
  }

  // --- Scene events ---------------------------------------------------------

  /**
   * Fire the warranties that entered the window and the maintenance that fell
   * due since the last read. The first read of a Homebox group is a silent
   * baseline: installing the integration announces nothing already pending.
   */
  async #announce() {
    const summary = this.summary;
    const warranty = new Map(
      summary.warranties.map((item) => [`${item.id}|${item.warranty}`, item]),
    );
    const maintenance = new Map(summary.due.map((entry) => [`${entry.id}|${entry.day}`, entry]));
    const known = this.notified?.groupId === summary.groupId ? this.notified : null;
    const fresh = (map, done) => [...map].filter(([key]) => !done.includes(key));
    const events = known
      ? [
          ...fresh(warranty, known.warranty).map(([, item]) => this.#warrantyEvent(item)),
          ...fresh(maintenance, known.maintenance).map(([, entry]) =>
            this.#maintenanceEvent(entry),
          ),
        ]
      : [];
    if (events.length > MAX_EVENTS_PER_READ) {
      logger.info(
        `${events.length} warranties or maintenance due at once: ${MAX_EVENTS_PER_READ} announced`,
      );
    }
    for (const [key, data] of events.slice(0, MAX_EVENTS_PER_READ)) {
      try {
        await this.gladys.publishSceneEvent(key, data);
      } catch (err) {
        logger.warn(`Cannot fire ${key}: ${err.message}`);
      }
    }
    const next = {
      groupId: summary.groupId,
      warranty: [...warranty.keys()].sort(),
      maintenance: [...maintenance.keys()].sort(),
    };
    if (JSON.stringify(next) !== JSON.stringify(this.notified)) {
      this.notified = next;
      await this.store.save(next);
    }
  }

  #warrantyEvent(item) {
    logger.debug(`Warranty of ${item.id} ends in ${item.daysLeft} day(s)`);
    return [
      TRIGGERS.warranty,
      {
        item: item.name,
        location: item.location,
        expires: formatDay(item.warranty, this.language),
        days_left: item.daysLeft,
      },
    ];
  }

  #maintenanceEvent(entry) {
    logger.debug(`Maintenance ${entry.id} due`);
    return [
      TRIGGERS.maintenance,
      {
        maintenance: entry.name,
        item: entry.item,
        scheduled: formatDay(entry.day, this.language),
        days_late: Math.max(0, -entry.daysLeft),
      },
    ];
  }

  // --- Devices and states -------------------------------------------------

  #isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  buildDevices() {
    if (!this.summary) {
      return [];
    }
    const url = this.config.url ?? '';
    const summary = this.summary;
    return [
      buildHomeboxDevice(this.gladys, summary, this.language, url),
      ...(this.config.locationDevices ? summary.locationTotals : []).map((location) =>
        buildLocationDevice(this.gladys, location, summary, this.language, url),
      ),
    ];
  }

  async publishDevices() {
    if (this.stopped) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(this.buildDevices());
    } catch (err) {
      logger.error('Cannot publish the devices', err);
    }
  }

  /**
   * The states of the devices the user added (Gladys drops the others).
   * @param {string} [only] one device external id
   */
  async publishStates(only) {
    if (!this.summary || this.stopped) {
      return;
    }
    const wanted = (id) => (only ? id === only : this.#isCreated(id));
    const summary = this.summary;
    const states = [];
    if (wanted(homeboxIds(this.gladys, summary.groupId).device)) {
      states.push(...buildHomeboxStates(this.gladys, summary, this.language));
    }
    if (this.config.locationDevices) {
      for (const location of summary.locationTotals) {
        if (wanted(locationIds(this.gladys, location.id).device)) {
          states.push(...buildLocationStates(this.gladys, location));
        }
      }
    }
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeat });
    } catch (err) {
      if (this.publishFailing) {
        logger.debug(`Cannot publish the states: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the states: ${err.message}`);
      }
      this.publishFailing = true;
      return;
    }
    if (this.publishFailing) {
      logger.info('States published again');
    }
    this.publishFailing = false;
  }

  /** The user added a device: states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    const parsed = parseDeviceId(this.gladys, device?.external_id);
    if (!parsed || ![HOMEBOX_TYPE, LOCATION_TYPE].includes(parsed.type)) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    await this.publishStates(device.external_id);
    this.refreshWidget();
  }

  /** onPoll (the devices are not polled: the container reads on its timer). */
  async poll(device) {
    if (parseDeviceId(this.gladys, device?.external_id)) {
      await this.publishStates(device.external_id);
    }
  }

  // --- Widget ---------------------------------------------------------------

  /** Nudge the open dashboards, with a trailing call inside the core's 10 s gap. */
  refreshWidget() {
    if (this.stopped) {
      return;
    }
    const wait = this.widgetRefreshAt + this.timings.widgetGap - this.now();
    if (wait <= 0) {
      this.widgetRefreshAt = this.now();
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
      return;
    }
    if (!this.widgetTimer) {
      this.widgetTimer = setTimeout(() => {
        this.widgetTimer = null;
        this.refreshWidget();
      }, wait);
      this.widgetTimer.unref?.();
    }
  }

  // --- Connection status ----------------------------------------------------

  statusKey() {
    if (this.config.urlInvalid) {
      return 'invalid';
    }
    if (!this.config.url) {
      return 'none';
    }
    if (!this.config.hasCredentials) {
      return 'credentials';
    }
    if (this.failure) {
      return (
        { unauthorized: 'unauthorized', invalid: 'invalid_answer', not_found: 'invalid_answer' }[
          this.failure
        ] ?? 'unreachable'
      );
    }
    return null;
  }

  statusMessage() {
    const key = this.statusKey();
    if (!key) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(STATUS_TEXT).map(([language, table]) => [language, table[key]]),
    );
  }

  async updateConnectionStatus() {
    if (this.stopped) {
      return;
    }
    // Nothing to say before the first answer or failure.
    if (this.client && !this.loaded && this.failure === null) {
      return;
    }
    const message = this.statusMessage();
    const connected = Boolean(this.client) && this.loaded && this.failure === null;
    const fingerprint = JSON.stringify({ connected, message });
    if (fingerprint === this.lastStatus) {
      return;
    }
    this.lastStatus = fingerprint;
    try {
      await this.gladys.setConnectionStatus(connected, message ?? undefined);
    } catch (err) {
      logger.warn(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Actions ----------------------------------------------------------------

  /** "Test the connection": a fresh read, then its outcome. */
  async testReport() {
    if (!this.client) {
      return this.statusMessage();
    }
    await this.refresh();
    const message = this.statusMessage();
    if (message) {
      return message;
    }
    const { items, locations } = this.summary;
    return Object.fromEntries(
      Object.entries(TEST_TEXT).map(([language, render]) => [
        language,
        render(this.version, items, locations),
      ]),
    );
  }

  /**
   * The scene action: where is an item, and how many are there? Reads
   * Homebox first, so a quantity changed a minute ago is seen.
   */
  async findItem(query) {
    if (typeof query !== 'string' || query.trim() === '') {
      throw new CommandError('name', this.language);
    }
    if (this.client) {
      await this.refresh();
    }
    if (!this.client || this.failure !== null || !this.data) {
      throw new CommandError('unreachable', this.language);
    }
    const matches = findItems(this.data.items, query);
    const first = matches[0];
    logger.info(`Item search: ${matches.length} match(es)`);
    return {
      found: Boolean(first),
      matches: matches.length,
      item: first?.name ?? '',
      location: first?.location ?? '',
      quantity: first?.quantity ?? 0,
    };
  }
}
