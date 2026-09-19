# Changelog

## 0.3.2 — 2026-09-19

- Fixed the app icon: back to the SVG Orbit icon. The 0.3.1 PNG rasterization
  didn't display; the SVG is what shipped (and worked) in 0.2.0/0.3.0.

## 0.3.1 — 2026-09-19

- Code cleanup: extracted the shared zone-record parser used by JSON config
  and device storage; simplified the base-format ref.
- Performance: grid cells and column headers are memoized — cursor moves and
  the 15s clock tick no longer redo the wall-clock lookup for every cell;
  timezone offsets are cached; the picker's per-zone times quantize to the
  minute.
- Store assets: 800×480 screenshots (grid, overlap state, timezone picker)
  and a 1024×1024 PNG of the Orbit icon.

## 0.3.0 — 2026-09-19

- **Timezone picker**: long-press any row label (550ms, same gesture as Radio
  Atlas) to open a region → zone picker with every IANA timezone, grouped by
  region and showing each zone's current local time. Knob scrolls the list,
  press selects, back steps out. Zones already on the grid are dimmed with a
  checkmark and can't be added twice. Additions persist on the device
  (localStorage) and take precedence over the companion config; a "reset to
  companion" option in the picker footer clears them.
- **Muted first column**: row-label cells now sit on a translucent black wash
  so the timeline grid carries the visual weight.
- **New app icon**: "Orbit" — a minimal amber dot on a thin tick ring,
  hand-drawn as a sharp-cornered square SVG.
- Test seams: `?zones=` URL param overrides the companion config (headless
  testing only, not user-facing).

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
