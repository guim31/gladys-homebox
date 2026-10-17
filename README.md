# Homebox for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for
[Homebox](https://github.com/sysadminsmedia/homebox), the self-hosted home
inventory: follow your items, their total value, the warranties ending soon
and the maintenance due, and react to them in scenes. Local only, read only.

Tested against real Homebox servers, 0.26.2 and 0.21.0 (official Docker image).

## Features

- **A Homebox device**: number of items and locations, total value (in the
  currency of the Homebox group), warranties ending within a window you set,
  overdue and upcoming maintenance, the next maintenance and the next warranty
  end as texts.
- **One device per location** (option): items and value of each top-level
  location, sub-locations included.
- **Dashboard widget** "Home inventory": four tiles and the list of what comes
  next, the soonest first.
- **Scene triggers**: "Warranty ending soon" and "Maintenance due", once each,
  remembered across restarts.
- **Scene action** "Find an item in Homebox": where an item is stored and how
  many there are, for a stock check or a message.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.1 or later.
- Homebox reachable from Gladys (port 7745 by default). An API key on Homebox
  0.26 or later, or the e-mail and password of a Homebox user on older
  versions (both API generations are supported: `/items` and `/entities`).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-homebox` (or find **Homebox** in the
   catalog).
2. In **Configuration**, enter the address of Homebox (`192.168.1.50`, port
   7745 by default) and an API key, or an e-mail and password. Save.
3. Add the devices from the **Discover** tab.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

Homebox pushes nothing: the container reads it every 15 minutes by default
(5 to 60), with five requests — group, statistics, scheduled maintenance, the
CSV export of the inventory (the only list carrying every warranty in one
request) and, for the location devices, the location tree. The devices are
published with `should_poll: false`; only changed states are sent to Gladys.

## Limitations

- Read only: nothing is ever written to Homebox.
- One Homebox group, the one of the API key or user.
- The triggers fire at the first read after the change; the first read after
  the installation announces nothing already pending.
- On a very large inventory, prefer a long read interval (the CSV export lists
  every item).

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Homebox answering with
bodies recorded on real Homebox 0.26.2 and 0.21.0 servers
(`test/fixtures/homebox/`).

## Credits

- [Homebox](https://github.com/sysadminsmedia/homebox), maintained by
  sysadminsmedia and contributors after the original project by hay-kot
  (AGPL-3.0): this integration only talks to its REST API and contains none of
  its code.
- The cover is a generic drawing made for this project.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the Homebox
project.

## License

Apache-2.0, see [`LICENSE`](LICENSE).
