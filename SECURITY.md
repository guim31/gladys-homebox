# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration holds: the Homebox address, an API key or the e-mail and
password of a Homebox user, all kept by Gladys in the integration
configuration (never logged, never written to `/data`); the login token Homebox
returns, in memory only. `/data` holds a small JSON file listing the
warranties and maintenance already announced by the scene triggers (Homebox
ids and dates). The container only talks to the Homebox address, over HTTP or
HTTPS, and only reads: it never writes to Homebox.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Homebox itself (see the
[Homebox repository](https://github.com/sysadminsmedia/homebox)).
