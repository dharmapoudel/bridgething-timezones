# Changelog

## 0.2.0 — 2026-09-19

- **Day flick**: spinning the knob fast now jumps a day per detent instead of
  an hour, so reaching next week doesn't take 168 clicks.
- **Overlap hop**: pressing the knob while already at "now" jumps straight to
  the next hour where every zone is in 9:00–17:00 (the next all-green column);
  a "✓ overlap" badge marks the selected moment when it qualifies. When no
  hour works for all zones (e.g. New York ↔ Kathmandu), the press is a no-op.
- Test seam: `?zones=` URL param overrides the companion config (headless
  testing only, not user-facing).

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
