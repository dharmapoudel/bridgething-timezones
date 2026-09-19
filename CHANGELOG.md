# Changelog

## 0.1.0 — 2026-09-18

- Initial release. Worldtimebuddy-style hour grid ported from
  sspaeti/omarchy-timezones-plugin (MIT).
- Knob moves the amber time line; the window slides when the line reaches
  the screen edge (±1h per detent, ±30 day range).
- Row headers show every zone's local time at the selected moment.
- Business-hour tints, midnight day-boundary markers, now-line, and green
  "good for all zones" overlap columns.
- Knob press recenters on now; back button cycles 24h → 12h → UTC
  (UTC pins a reference row under home).
- Zones configurable via companion settings (`Label=Zone;...` or JSON);
  blank zone = this device (home row).
- No network: all math on the device's tzdata via `Intl`.
