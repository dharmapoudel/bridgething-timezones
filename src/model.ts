// Timezone math for the Timezones app.
//
// Ported from sspaeti/omarchy-timezones-plugin (MIT) Model.js and reimplemented
// on Intl: the device's own tzdata supplies offsets and DST rules, so no
// network and no offset probing are needed. Every cell is rendered from the
// zone-local wall clock of an absolute instant, which keeps DST transitions
// correct automatically.

export const HOUR_MS = 3600_000;
/** Hours visible in the sliding window. */
export const VISIBLE_COLS = 10;
/** How far the cursor may travel from "now" in either direction. */
export const MAX_RANGE_MS = 30 * 24 * HOUR_MS;

export type HourFormat = '24h' | '12h' | 'utc';
export const HOUR_FORMATS: HourFormat[] = ['24h', '12h', 'utc'];

export type Zone = {
  label: string;
  shortLabel: string;
  /** IANA name, or '' for the device's own timezone. */
  zone: string;
  abbr?: string;
  home?: boolean;
};

export type RowZone = Zone & { iana: string };

export const DEFAULT_ZONES_CONFIG =
  'Home=;New York (NY)=America/New_York;San Francisco (SF)=America/Los_Angeles;Kathmandu (KTM)=Asia/Kathmandu';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function validTimeZone(iana: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: iana });
    return true;
  } catch {
    return false;
  }
}

function deriveShort(label: string): string {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (initials || label.slice(0, 3).toUpperCase()).slice(0, 4);
}

/** "New York" from "America/New_York". */
export function prettyZoneLabel(iana: string): string {
  const parts = iana.split('/');
  return (parts[parts.length - 1] ?? iana).replace(/_/g, ' ');
}

/** Short badge ("NY") for an IANA name. */
export function shortForIana(iana: string): string {
  return deriveShort(prettyZoneLabel(iana));
}

/** "America" from "America/New_York"; zoneless names land in "Other". */
export function zoneRegion(iana: string): string {
  const i = iana.indexOf('/');
  return i < 0 ? 'Other' : iana.slice(0, i);
}

/** Sorted unique region list for the picker. */
export function zoneRegions(allZones: string[]): string[] {
  return [...new Set(allZones.map(zoneRegion))].sort((a, b) => a.localeCompare(b));
}

/** Zones of one region, in allZones order. */
export function zonesInRegion(allZones: string[], region: string): string[] {
  return allZones.filter(z => zoneRegion(z) === region);
}

function defaultZones(): Zone[] {
  return parseZonesConfig(DEFAULT_ZONES_CONFIG);
}

/**
 * Parse the `zones` config. Accepts either a JSON array
 *   [{"label":"New York","shortLabel":"NY","zone":"America/New_York"}, ...]
 * or a compact phone-friendly string
 *   "Home=;New York (NY)=America/New_York;Kathmandu (KTM)=Asia/Kathmandu"
 * where a blank zone means "this device" (the home row).
 */
export function parseZonesConfig(raw: string | null | undefined): Zone[] {
  const text = (raw ?? '').trim();
  if (!text) return defaultZones();

  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text) as Array<{
        label?: unknown;
        shortLabel?: unknown;
        zone?: unknown;
        abbr?: unknown;
        home?: unknown;
      }>;
      const zones: Zone[] = [];
      for (const z of arr) {
        if (!z || typeof z.label !== 'string' || !z.label.trim()) continue;
        const label = z.label.trim();
        const zone = typeof z.zone === 'string' ? z.zone.trim() : '';
        zones.push({
          label,
          shortLabel:
            (typeof z.shortLabel === 'string' && z.shortLabel.trim()) || deriveShort(label),
          zone,
          abbr: typeof z.abbr === 'string' && z.abbr.trim() ? z.abbr.trim() : undefined,
          home: zone === '' ? true : z.home === true ? true : undefined,
        });
      }
      if (zones.length > 0) return zones;
    } catch {
      // fall through to defaults
    }
    return defaultZones();
  }

  const zones: Zone[] = [];
  for (const chunk of text.split(';')) {
    const eq = chunk.indexOf('=');
    if (eq < 0) continue;
    let label = chunk.slice(0, eq).trim();
    const zone = chunk.slice(eq + 1).trim();
    if (!label) continue;
    let short: string | undefined;
    const m = /^(.*?)\s*\(([A-Za-z0-9]{1,5})\)\s*$/.exec(label);
    if (m) {
      label = m[1].trim();
      short = m[2].toUpperCase();
    }
    if (!label) continue;
    zones.push({
      label,
      shortLabel: short ?? deriveShort(label),
      zone,
      home: zone === '' ? true : undefined,
    });
  }
  return zones.length > 0 ? zones : defaultZones();
}

/** Resolve IANA names (home -> system timezone), dropping invalid zones. */
export function resolveZones(zones: Zone[]): RowZone[] {
  const sys = systemTimeZone();
  const out: RowZone[] = [];
  for (const z of zones) {
    const iana = z.home || !z.zone ? sys : z.zone;
    if (!validTimeZone(iana)) continue;
    out.push({ ...z, iana, home: z.home || !z.zone ? true : undefined });
  }
  if (out.length > 0) return out;
  return defaultZones().map(z => ({ ...z, iana: sys }));
}

/** The reference row "utc" mode pins right under the home row. */
export function withUtcRow(zones: RowZone[]): RowZone[] {
  const out = zones.slice();
  let at = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i].home) {
      at = i + 1;
      break;
    }
  }
  out.splice(at, 0, { label: 'UTC', shortLabel: 'UTC', zone: 'UTC', iana: 'UTC' });
  return out;
}

export type WallParts = {
  hour: number;
  minute: number;
  weekday: number;
  day: number;
  month: number;
};

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(iana: string): Intl.DateTimeFormat {
  let f = dtfCache.get(iana);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    dtfCache.set(iana, f);
  }
  return f;
}

/** Zone-local wall-clock fields of an absolute instant. */
export function wallParts(iana: string, utcMs: number): WallParts {
  let hour = 0;
  let minute = 0;
  let weekday = 0;
  let day = 1;
  let month = 0;
  for (const p of dtf(iana).formatToParts(new Date(utcMs))) {
    if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
    else if (p.type === 'day') day = Number(p.value);
    else if (p.type === 'month') month = Number(p.value) - 1;
    else if (p.type === 'weekday') {
      const i = WEEKDAYS.indexOf(p.value);
      weekday = i < 0 ? 0 : i;
    }
  }
  return { hour, minute, weekday, day, month };
}

/** Signed minutes east of UTC for a zone at an instant (DST-aware). */
export function offsetMinutesAt(iana: string, utcMs: number): number {
  const d = new Date(utcMs);
  const loc = new Date(d.toLocaleString('en-US', { timeZone: iana }));
  const utc = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  return Math.round((loc.getTime() - utc.getTime()) / 60000);
}

export type Tint = 'work' | 'day' | 'night';

/** Visual band for an hour: business hours pop, waking hours mid, night dark. */
export function tintFor(hour: number): Tint {
  if (hour >= 8 && hour < 18) return 'work';
  if (hour >= 6 && hour < 23) return 'day';
  return 'night';
}

/** Core overlap hours: every zone in 9:00-17:00 local. */
export function isOverlapHour(hour: number): boolean {
  return hour >= 9 && hour < 17;
}

/**
 * True when every given zone's local wall-clock hour at an instant is a core
 * overlap hour. Mirrors the green column-header highlight exactly (pass the
 * same row list the grid renders, so the UTC reference row counts in utc mode).
 */
export function isOverlapAt(zones: RowZone[], utcMs: number): boolean {
  return zones.every(z => isOverlapHour(wallParts(z.iana, utcMs).hour));
}

/**
 * Next hour strictly after `fromMs` where every zone is in core overlap hours.
 * Returns the absolute ms of that hour, or null when nothing overlaps within
 * `maxDays` (possible with zones spread across the globe).
 */
export function nextOverlapMs(zones: RowZone[], fromMs: number, maxDays = 14): number | null {
  const fromHour = Math.floor(fromMs / HOUR_MS);
  const end = fromHour + maxDays * 24;
  for (let h = fromHour + 1; h <= end; h++) {
    if (isOverlapAt(zones, h * HOUR_MS)) return h * HOUR_MS;
  }
  return null;
}

/** One grid cell's hour label. 12h stays short like worldtimebuddy: "1p", "11a". */
export function hourLabel(hour: number, mode: HourFormat): string {
  if (mode !== '12h') return String(hour);
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

/** "14:23" for a zone at an instant, or "2:23 PM" in 12-hour mode. */
export function timeLabel(utcMs: number, iana: string, mode: HourFormat): string {
  const p = wallParts(iana, utcMs);
  const mm = String(p.minute).padStart(2, '0');
  if (mode === '12h') {
    const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
    return `${h}:${mm} ${p.hour < 12 ? 'AM' : 'PM'}`;
  }
  return `${String(p.hour).padStart(2, '0')}:${mm}`;
}

/** "Fri 19 Sep" style date for a zone at an instant. */
export function dateLabel(utcMs: number, iana: string): string {
  const p = wallParts(iana, utcMs);
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

/** "Sat 20" day-boundary label for a midnight cell. */
export function dayLabel(weekday: number, day: number): string {
  return `${WEEKDAYS[weekday]} ${day}`;
}

/** Offset relative to home: "+6h", "−9h", "+5:30", "" for home itself. */
export function diffLabel(offsetMin: number, homeOffsetMin: number): string {
  const diff = offsetMin - homeOffsetMin;
  if (diff === 0) return '';
  const sign = diff < 0 ? '−' : '+';
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}h` : `${sign}${h}:${String(m).padStart(2, '0')}`;
}

const abbrCache = new Map<string, Intl.DateTimeFormat>();
function tzAbbr(iana: string, utcMs: number): string {
  let f = abbrCache.get(iana);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' });
    abbrCache.set(iana, f);
  }
  const part = f.formatToParts(new Date(utcMs)).find(p => p.type === 'timeZoneName');
  return part?.value ?? '';
}

/**
 * Abbreviation for the row header. tzdata/Intl often report numeric offsets
 * ("+0545") where no abbreviation exists — those read wrong next to real
 * abbreviations, so they are dropped in favor of the +H:MM diff label.
 */
export function displayAbbr(zone: RowZone, utcMs: number): string {
  if (zone.abbr) return zone.abbr;
  if (zone.iana === 'UTC') return '';
  const a = tzAbbr(zone.iana, utcMs);
  return /^[A-Za-z]{2,5}$/.test(a) ? a : '';
}

export function normalizeHourFormat(value: unknown): HourFormat {
  const s = String(value ?? '').trim().toLowerCase();
  return (HOUR_FORMATS as string[]).includes(s) ? (s as HourFormat) : '24h';
}

export function nextHourFormat(mode: HourFormat): HourFormat {
  const i = HOUR_FORMATS.indexOf(normalizeHourFormat(mode));
  return HOUR_FORMATS[(i + 1) % HOUR_FORMATS.length];
}

const DEVICE_ZONES_KEY = 'timezones.zones.v1';

/**
 * Zones the user added on-device via the timezone picker. The companion
 * config API is read-only, so device-side edits live here (like the hour
 * format override) and take precedence over the companion `zones` value.
 * Clearing them hands control back to the companion settings.
 */
export function readDeviceZones(): Zone[] | null {
  try {
    const raw = localStorage.getItem(DEVICE_ZONES_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return null;
    const zones: Zone[] = [];
    for (const z of arr) {
      if (!z || typeof z !== 'object') continue;
      const rec = z as Record<string, unknown>;
      if (typeof rec.label !== 'string' || !rec.label.trim()) continue;
      const label = rec.label.trim();
      const zone = typeof rec.zone === 'string' ? rec.zone.trim() : '';
      zones.push({
        label,
        shortLabel:
          (typeof rec.shortLabel === 'string' && rec.shortLabel.trim()) ||
          deriveShort(label),
        zone,
        abbr:
          typeof rec.abbr === 'string' && rec.abbr.trim() ? rec.abbr.trim() : undefined,
        home: zone === '' ? true : rec.home === true ? true : undefined,
      });
    }
    return zones.length > 0 ? zones : null;
  } catch {
    return null;
  }
}

export function writeDeviceZones(zones: Zone[]): void {
  try {
    localStorage.setItem(DEVICE_ZONES_KEY, JSON.stringify(zones));
  } catch {
    // storage unavailable; the add just won't persist
  }
}

export function clearDeviceZones(): void {
  try {
    localStorage.removeItem(DEVICE_ZONES_KEY);
  } catch {
    // ignore
  }
}

/** All IANA names, from the device's own tzdata when available. */
export function allTimeZones(): string[] {
  try {
    const zs = Intl.supportedValuesOf('timeZone');
    if (zs.length > 0) return zs.slice().sort();
  } catch {
    // fall through to the curated list
  }
  return FALLBACK_ZONES.slice().sort();
}

/** Curated fallback for runtimes without Intl.supportedValuesOf. */
const FALLBACK_ZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Toronto', 'America/Vancouver',
  'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires', 'America/Bogota',
  'Atlantic/Azores', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
  'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Stockholm',
  'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow', 'Africa/Cairo',
  'Africa/Johannesburg', 'Africa/Nairobi', 'Asia/Dubai', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Perth', 'Australia/Sydney', 'Pacific/Auckland', 'Pacific/Fiji',
];
