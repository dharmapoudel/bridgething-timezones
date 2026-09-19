import { BridgethingClient } from '@bridgething/client';
import { daemonUrl } from '@bridgething/webapp-shared/daemon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_ZONES_CONFIG,
  HOUR_MS,
  MAX_RANGE_MS,
  VISIBLE_COLS,
  dateLabel,
  dayLabel,
  diffLabel,
  displayAbbr,
  hourLabel,
  isOverlapHour,
  nextHourFormat,
  normalizeHourFormat,
  offsetMinutesAt,
  parseZonesConfig,
  resolveZones,
  timeLabel,
  tintFor,
  wallParts,
  withUtcRow,
  type HourFormat,
  type RowZone,
} from './model';

const CONFIG_TIMEOUT_MS = 1500;
const FORMAT_OVERRIDE_KEY = 'timezones.hourFormat.v1';
const TICK_MS = 15_000;
const LABEL_COL_PX = 168;

type View = { cursorMs: number; windowStart: number };

function makeClient(): BridgethingClient | null {
  try {
    const url = daemonUrl();
    if (!/^wss?:\/\/[^/]+/.test(url)) return null;
    return new BridgethingClient({ url });
  } catch {
    return null;
  }
}

async function readConfig(client: BridgethingClient | null, key: string): Promise<string | null> {
  if (!client) return null;
  try {
    const r = await client.config.get({ key }, { timeoutMs: CONFIG_TIMEOUT_MS });
    if (r.ok) {
      const v = (r.response as { value?: unknown }).value;
      if (typeof v === 'string') return v;
      if (v == null) return null;
      return String(v);
    }
  } catch {
    // daemon unreachable: fall back to defaults
  }
  return null;
}

function readFormatOverride(): HourFormat | null {
  try {
    const raw = localStorage.getItem(FORMAT_OVERRIDE_KEY);
    return raw ? normalizeHourFormat(raw) : null;
  } catch {
    return null;
  }
}

const TINT_CLASS: Record<string, string> = {
  work: 'bg-white/[0.10]',
  day: 'bg-white/[0.035]',
  night: 'bg-black/40 text-white/35',
};

export default function App() {
  const client = useMemo(makeClient, []);
  const [zonesRaw, setZonesRaw] = useState<string | null>(null);
  const [baseFormat, setBaseFormat] = useState<HourFormat>('24h');
  const [fmtOverride, setFmtOverride] = useState<HourFormat | null>(readFormatOverride);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [view, setView] = useState<View>(() => {
    const n = Date.now();
    return { cursorMs: n, windowStart: Math.floor(n / HOUR_MS) - 2 };
  });

  const mode: HourFormat = fmtOverride ?? baseFormat;
  const labelMode: HourFormat = mode === '12h' ? '12h' : '24h';

  // companion config: zones + hour format, with live updates
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [zones, fmt] = await Promise.all([
        readConfig(client, 'zones'),
        readConfig(client, 'hourFormat'),
      ]);
      if (cancelled) return;
      setZonesRaw(zones ?? DEFAULT_ZONES_CONFIG);
      if (fmt) setBaseFormat(normalizeHourFormat(fmt));
    };
    load();
    const off = client?.config.onChanged(msg => {
      if (msg.key === 'zones' || msg.key === 'hourFormat') load();
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [client]);

  // clock tick keeps the now-line and header times live
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, []);

  const zones: RowZone[] = useMemo(
    () => resolveZones(parseZonesConfig(zonesRaw ?? DEFAULT_ZONES_CONFIG)),
    [zonesRaw],
  );
  const rows: RowZone[] = useMemo(
    () => (mode === 'utc' ? withUtcRow(zones) : zones),
    [zones, mode],
  );
  const home: RowZone = useMemo(
    () => rows.find(z => z.home) ?? rows[0],
    [rows],
  );

  const move = useCallback((dir: 1 | -1) => {
    setView(v => {
      const now = Date.now();
      const cursorMs = Math.min(
        now + MAX_RANGE_MS,
        Math.max(now - MAX_RANGE_MS, v.cursorMs + dir * HOUR_MS),
      );
      // sliding window: the cursor moves freely inside the window; when it
      // reaches the edge, the whole window slides so the cursor stays put.
      let windowStart = v.windowStart;
      let col = (cursorMs - windowStart * HOUR_MS) / HOUR_MS;
      while (col >= VISIBLE_COLS) {
        windowStart += 1;
        col -= 1;
      }
      while (col < 0) {
        windowStart -= 1;
        col += 1;
      }
      return { cursorMs, windowStart };
    });
  }, []);

  const recenter = useCallback(() => {
    const n = Date.now();
    setView({ cursorMs: n, windowStart: Math.floor(n / HOUR_MS) - 2 });
    setNowMs(n);
  }, []);

  const cycleFormat = useCallback(() => {
    setFmtOverride(cur => {
      const next = nextHourFormat(cur ?? baseFormatRef.current);
      try {
        localStorage.setItem(FORMAT_OVERRIDE_KEY, next);
      } catch {
        // storage unavailable; the override just won't persist
      }
      return next;
    });
  }, []);

  const baseFormatRef = useMemo(() => ({ current: baseFormat }), []);
  useEffect(() => {
    baseFormatRef.current = baseFormat;
  }, [baseFormat, baseFormatRef]);

  // knob: horizontal wheel moves the time line. knob press: back to now.
  // back button: cycle 24h -> 12h -> utc.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      move(e.deltaX > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        recenter();
      } else if (e.key === 'Escape') {
        cycleFormat();
      } else if (e.key === 'n' || e.key === 'N') {
        recenter();
      } else if (e.key === 't' || e.key === 'T') {
        cycleFormat();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [move, recenter, cycleFormat]);

  const cursorCol = (view.cursorMs - view.windowStart * HOUR_MS) / HOUR_MS;
  const nowCol = (nowMs - view.windowStart * HOUR_MS) / HOUR_MS;
  const gridLeft = (frac: number) => `calc(${LABEL_COL_PX}px + (100% - ${LABEL_COL_PX}px) * ${frac / VISIBLE_COLS})`;

  const homeOffset = offsetMinutesAt(home.iana, view.cursorMs);

  return (
    <div className="flex h-full w-full flex-col bg-bg text-off-white select-none">
      {/* title bar */}
      <div className="flex h-14 shrink-0 items-center justify-between px-6">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-eyebrow tracking-[0.22em] text-dim uppercase">
            timezones
          </span>
          <span className="font-mono text-row text-near">{dateLabel(view.cursorMs, home.iana)}</span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-hint tracking-[0.14em] text-dim uppercase">
            {home.shortLabel} now
          </span>
          <span className="font-display text-3xl font-medium tabular-nums">
            {timeLabel(nowMs, home.iana, labelMode)}
          </span>
        </div>
      </div>

      {/* column headers */}
      <div
        className="grid shrink-0 border-y border-rule"
        style={{ gridTemplateColumns: `${LABEL_COL_PX}px repeat(${VISIBLE_COLS}, 1fr)` }}
      >
        <div className="h-9" />
        {Array.from({ length: VISIBLE_COLS }, (_, c) => {
          const colMs = (view.windowStart + c) * HOUR_MS;
          const p = wallParts(home.iana, colMs);
          const midnight = p.hour === 0;
          const overlap = rows.every(z => isOverlapHour(wallParts(z.iana, colMs).hour));
          return (
            <div
              key={c}
              className={`flex h-9 flex-col items-center justify-center border-l border-rule/60 ${
                midnight ? 'border-l-2 border-l-amber-200/70' : ''
              }`}
            >
              <span
                className={`font-mono text-row tabular-nums ${
                  overlap ? 'text-emerald-300' : midnight ? 'text-amber-100' : 'text-near'
                }`}
              >
                {hourLabel(p.hour, labelMode)}
              </span>
              {midnight && (
                <span className="font-mono text-[9px] tracking-[0.12em] text-dim uppercase">
                  {dayLabel(p.weekday, p.day)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* zone rows */}
      <div
        className="relative flex-1"
        data-cursor-hour={Math.round(view.cursorMs / HOUR_MS)}
        data-window-start={view.windowStart}
      >
        <div className="flex h-full flex-col">
          {rows.map(z => {
            const abbr = displayAbbr(z, view.cursorMs);
            const diff = z.home ? '' : diffLabel(offsetMinutesAt(z.iana, view.cursorMs), homeOffset);
            return (
              <div
                key={z.iana + z.label}
                className="grid min-h-0 flex-1 border-b border-rule/60"
                style={{ gridTemplateColumns: `${LABEL_COL_PX}px repeat(${VISIBLE_COLS}, 1fr)` }}
              >
                <div className="flex flex-col justify-center gap-0.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-row font-semibold tracking-[0.08em] uppercase">
                      {z.shortLabel}
                    </span>
                    {z.home && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                  </div>
                  <div className="font-display text-2xl leading-none font-medium tabular-nums">
                    {timeLabel(view.cursorMs, z.iana, labelMode)}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim uppercase">
                    {[abbr, diff].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {Array.from({ length: VISIBLE_COLS }, (_, c) => {
                  const colMs = (view.windowStart + c) * HOUR_MS;
                  const cp = wallParts(z.iana, colMs);
                  const midnight = cp.hour === 0;
                  return (
                    <div
                      key={c}
                      className={`flex items-center justify-center border-l border-rule/40 ${TINT_CLASS[tintFor(cp.hour)]} ${
                        midnight ? 'border-l-2 border-l-amber-200/50' : ''
                      }`}
                    >
                      <span className="font-mono text-hint tabular-nums opacity-80">
                        {hourLabel(cp.hour, labelMode)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* now line */}
        {nowCol >= 0 && nowCol < VISIBLE_COLS && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: gridLeft(nowCol) }}
          />
        )}
        {/* cursor (selected moment) line */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-[3px] bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]"
          style={{ left: gridLeft(cursorCol) }}
        >
          <div className="absolute -top-0 -translate-x-1/2 rounded-sm bg-amber-300 px-2 py-0.5 font-mono text-[11px] font-semibold text-black tabular-nums">
            {timeLabel(view.cursorMs, home.iana, labelMode)}
          </div>
        </div>
      </div>

      {/* footer hints */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-rule px-6">
        <span className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          knob · move line&ensp;&ensp;press · now&ensp;&ensp;back · format
        </span>
        <span className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          {mode}
          <span className="text-emerald-300/80"> · green = good for all</span>
        </span>
      </div>
    </div>
  );
}
