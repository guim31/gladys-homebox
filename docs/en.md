# Homebox

Follow your home inventory in Gladys through
[Homebox](https://github.com/sysadminsmedia/homebox), the self-hosted
inventory and organization system: how many items you own, what they are
worth, the warranties ending soon and the maintenance to do. Everything stays
on your local network: Gladys talks directly to Homebox, and only reads it.

Tested against real Homebox servers, 0.26.2 and 0.21.0 (the official Docker
image). Feedback welcome on the Gladys forum.

## Prerequisites

- Gladys Assistant 5.1 or later.
- A Homebox server reachable from the Gladys machine, on port 7745 by
  default, or through a reverse proxy.
- On Homebox 0.26 or later: an API key (Homebox → your profile → API keys).
  On an older Homebox: the e-mail and password of a Homebox user. The
  integration sees the inventory (the "group") of that user.

## Configuration

1. Open the **Configuration** tab of the integration.
2. In **Homebox address**, enter the IP address of the server, for example
   `192.168.1.50`: the integration then uses port 7745. Add a port if yours
   differs (`192.168.1.50:3100`). Behind a reverse proxy, enter the full
   address (`https://example.org/homebox`).
3. Paste an **API key**, or fill in **E-mail** and **Password**. An API key
   wins when both are filled in.
4. **Warranty ending within (days)**: a warranty counts as ending soon this
   many days before its end date (30 by default).
5. **Upcoming maintenance within (days)**: how far ahead a scheduled
   maintenance counts as upcoming (7 by default).
6. **One device per location** (off by default) adds a device for each
   top-level location of Homebox.
7. **Read Homebox every**: 5, 15 (default), 30 or 60 minutes.
8. **Language of names and messages** sets the feature names (fixed when the
   device is added), the texts and the dates of the scene variables. French by
   default.
9. Save, then use **Test the connection**: it shows the Homebox version and
   the number of items and locations.
10. In the **Discovery** tab, add the devices you want to follow.

## Devices

**Homebox** (one device for your inventory):

| Feature                  | Value                                                          |
| ------------------------ | -------------------------------------------------------------- |
| Items                    | number of items, archived ones left out                        |
| Locations                | number of locations                                            |
| Total value              | purchase price × quantity of every item, in the group currency |
| Warranties expiring soon | items whose warranty ends within the configured window         |
| Overdue maintenance      | scheduled maintenance whose date has passed                    |
| Upcoming maintenance     | scheduled maintenance within the configured window             |
| Next maintenance         | name, item and date of the next maintenance, or "None"         |
| Next warranty end        | item and date of the next warranty ending soon, or "None"      |

Gladys has a unit for the euro, the dollar and the pound sterling; another
currency appears in the feature name, for example "Total value (CHF)".
Lifetime warranties never end; warranties already over are not counted.

**A location** (option): **Items** (number of items stored there,
sub-locations included) and **Value**. Only the top-level locations get a
device.

## Dashboard widget

**Home inventory**: four tiles (items, value, warranties, maintenance due) and
the list of what comes next, the soonest first: overdue maintenance (red),
upcoming maintenance, warranties ending. Read only.

## Scene triggers

- **Warranty ending soon**: the warranty of an item enters the configured
  window. Once per item and end date. Variables: item, location, end date,
  days left.
- **Maintenance due**: a scheduled maintenance reaches its date without being
  completed. Once per maintenance. Variables: maintenance, item, scheduled
  date, days late.

The first read after the installation is silent: what is already pending is
shown on the device, not announced. The triggers fire at the first read after
the change (after midnight, within the configured interval).

## Scene actions

**Find an item in Homebox**: give a name (`AA batteries`); the action reads
Homebox and returns **Found**, **Matching items**, **Item**, **Location** (the
full path, `Garage / Shelf`) and **Quantity**. The exact name wins, then the
names containing it; archived items are left out.

## Scene examples

- **Maintenance reminder**: trigger "Maintenance due" → send a message
  "Time for {{triggerEvent.data.maintenance}} on {{triggerEvent.data.item}}".
- **Warranty**: trigger "Warranty ending soon" → message "The warranty of
  {{triggerEvent.data.item}} ends on {{triggerEvent.data.expires}}".
- **Stock check**: every Sunday at 10:00 → "Find an item in Homebox"
  (`AA batteries`) → continue only if the quantity is below 4 → message "Only
  a few AA batteries left (stored in …)".

## Troubleshooting

- **"Access refused"**: check the API key (it may have expired, or been
  deleted in Homebox), or the e-mail and password. API keys exist from Homebox
  0.26 only: on an older version, use the e-mail and password.
- **"Homebox does not answer"**: check the address and the port from the
  Gladys machine. The container uses a bridge network: `localhost` is the
  container itself, enter the IP address of the server instead.
- **"This address does not answer like Homebox"**: a proxy login page answers
  instead of Homebox. Enter the address of Homebox itself, or let the proxy
  through for the Gladys machine.
- To see more in the logs of the integration, set `LOG_LEVEL=debug`.

## Limits

- Read only: the integration never changes your inventory.
- Each read is about five requests (the CSV export of the whole inventory
  included): keep a long interval on a very large inventory.
- One Homebox group, the one of the API key or user.
- Not affiliated with the Homebox project.
