# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- A Homebox device: number of items and locations, total value in the currency
  of the Homebox group, warranties ending soon, overdue and upcoming
  maintenance, the next maintenance and the next warranty end.
- An optional device per top-level location: its items and their value.
- The "Home inventory" dashboard widget: four tiles and what comes next.
- Scene triggers "Warranty ending soon" and "Maintenance due", announced once,
  remembered across restarts.
- Scene action "Find an item in Homebox": location and quantity of an item.
- API key (Homebox 0.26+) or e-mail and password; Homebox 0.21 to 0.26.
- Texts and documentation in English, French, German and Spanish.
