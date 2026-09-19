# Bridgething Timezones

A world clock for the Spotify Car Thing, ported from
[sspaeti/omarchy-timezones-plugin](https://github.com/sspaeti/omarchy-timezones-plugin)
(MIT) — the worldtimebuddy-style hour grid, reimagined for the knob.

## What it does

One 24-hour strip per timezone, all columns aligned on the same absolute
moment. Business hours pop, night fades, day boundaries are marked, and a thin
line shows *now*. Turn the knob and the amber **time line** glides across the
grid — every row's header instantly shows that exact moment in its zone, so
"10am in New York is what in Kathmandu?" is answered in one glance. When the
line reaches the edge of the screen, the whole window slides over like a
sliding window, so you can scrub days into the future or past.

- **Knob** — move the time line (±1 hour per detent, ±30 days range)
- **Knob press / Space** — jump back to now
- **Back button / Esc** — cycle 24h → 12h → UTC (UTC pins a reference row)
- Green hour labels mark columns where *every* zone is in 9:00–17:00 —
  the "good for everyone" meeting windows

No network, no API: offsets come from the device's own tzdata via `Intl`,
so DST is always correct, offline.

## Configure

In the companion app settings, or `zones` in the app config:

```
Home=;New York (NY)=America/New_York;San Francisco (SF)=America/Los_Angeles;Kathmandu (KTM)=Asia/Kathmandu
```

- `Label=Zone` pairs separated by `;`. A blank zone means "this device" —
  the home row, marked with a dot.
- `(SHORT)` after a label sets the row badge; otherwise it's derived.
- A JSON array of `{label, shortLabel, zone, abbr, home}` also works.

`hourFormat` picks the starting display mode (`24h`, `12h`, `utc`).

## Build

```sh
bun install
bun run typecheck
bun run build
```

## Notes

- App ID `6aadfb91-01a0-7063-888b-e551ca7b4771` is permanent — never change it.
- Not tested on physical hardware.
