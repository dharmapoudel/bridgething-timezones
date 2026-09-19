import { useMemo } from 'react';
import {
  prettyZoneLabel,
  timeLabel,
  zoneRegions,
  zonesInRegion,
  type HourFormat,
} from './model';

export type PickerStage = { region: string | null };

type Props = {
  allZones: string[];
  stage: PickerStage;
  highlight: number;
  /** IANA names already on the grid — shown with a check, not selectable. */
  added: Set<string>;
  labelMode: HourFormat;
  nowMs: number;
  hasDeviceZones: boolean;
  onPickRegion: (region: string) => void;
  onPickZone: (iana: string) => void;
  onClose: () => void;
  onReset: () => void;
};

export default function ZonePicker(p: Props) {
  const { regions, counts } = useMemo(() => {
    const rs = zoneRegions(p.allZones);
    const cs = new Map<string, number>();
    for (const r of rs) cs.set(r, zonesInRegion(p.allZones, r).length);
    return { regions: rs, counts: cs };
  }, [p.allZones]);

  const regionZones = useMemo(
    () => (p.stage.region == null ? [] : zonesInRegion(p.allZones, p.stage.region)),
    [p.allZones, p.stage.region],
  );

  const items: Array<{ key: string; iana?: string; region?: string }> =
    p.stage.region == null
      ? regions.map(region => ({ key: region, region }))
      : regionZones.map(z => ({ key: z, iana: z }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={p.onClose}
      data-picker="open"
    >
      <div
        className="flex h-[400px] w-[620px] flex-col border border-rule bg-[#14171b] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-rule px-5">
          <span className="font-mono text-row tracking-[0.18em] text-near uppercase">
            Add timezone
            {p.stage.region != null && (
              <span className="text-dim"> · {p.stage.region}</span>
            )}
          </span>
          <button
            className="px-3 py-2 font-mono text-xl text-dim"
            onClick={p.onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {items.map((it, i) => {
            const isZone = it.iana != null;
            const isAdded = isZone && p.added.has(it.iana!);
            const hl = i === p.highlight;
            return (
              <button
                key={it.key}
                data-phl={hl ? 'true' : 'false'}
                {...(isZone ? { 'data-iana': it.iana } : {})}
                disabled={isAdded}
                onClick={() => {
                  if (isAdded) return;
                  if (isZone) p.onPickZone(it.iana!);
                  else p.onPickRegion(it.region!);
                }}
                className={`flex w-full items-center gap-3 px-5 py-2 text-left ${
                  hl ? 'bg-amber-300/15' : ''
                } ${isAdded ? 'opacity-40' : ''}`}
              >
                <span
                  className={`font-mono text-row ${hl ? 'text-amber-200' : 'text-near'}`}
                >
                  {isZone ? prettyZoneLabel(it.iana!) : it.region}
                </span>
                {isAdded && (
                  <span className="font-mono text-row text-emerald-300">✓</span>
                )}
                {!isZone && (
                  <span className="font-mono text-hint text-dim">
                    {counts.get(it.region!) ?? 0}
                  </span>
                )}
                {isZone && (
                  <span className="ml-auto font-mono text-row text-dim tabular-nums">
                    {timeLabel(p.nowMs, it.iana!, p.labelMode)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div className="flex h-10 shrink-0 items-center justify-between border-t border-rule px-5">
          <span className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
            knob · move&ensp;&ensp;press · select&ensp;&ensp;back
          </span>
          {p.hasDeviceZones && (
            <button
              className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase underline"
              onClick={p.onReset}
            >
              reset to companion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
