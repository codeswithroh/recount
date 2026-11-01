import type { Recount } from "@/lib/types";
import { claimLabel, gapLabel, gapOf, OUTCOMES, outcomeOf, shortNumber } from "./ui";

export function Ring({
  segments,
  center,
  caption,
  size = 148,
}: {
  segments: { value: number; color: string }[];
  center: string;
  caption: string;
  size?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const length = 2 * Math.PI * 48;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="shrink-0" role="img" aria-label={`${center} ${caption}`}>
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--none-soft)" strokeWidth="11" />
      {total > 0 &&
        segments
          .filter((segment) => segment.value > 0)
          .map((segment, index) => {
            const arc = (segment.value / total) * length;
            const circle = (
              <circle
                key={index}
                cx="60"
                cy="60"
                r="48"
                fill="none"
                stroke={segment.color}
                strokeWidth="11"
                strokeDasharray={`${Math.max(arc - 1.5, 0.5)} ${length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += arc;
            return circle;
          })}
      <text x="60" y="61" textAnchor="middle" fontSize="23" fontWeight="700" fill="var(--ink)">
        {center}
      </text>
      <text x="60" y="76" textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        {caption}
      </text>
    </svg>
  );
}

export function StackBar({ segments }: { segments: { value: number; color: string }[] }) {
  return (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-none-soft">
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment, index) => (
          <div key={index} style={{ flexGrow: segment.value, background: segment.color }} />
        ))}
    </div>
  );
}

// Claims on a log scale around the source figure, so 20× too high and 2% off fit on one chart.
export function GapPlot({ recounts, onOpen }: { recounts: Recount[]; onOpen?: (recount: Recount) => void }) {
  const rows = recounts
    .flatMap((recount) => {
      const gap = gapOf(recount);
      return gap ? [{ recount, ...gap, shift: Math.log2(gap.ratio) }] : [];
    })
    .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift));
  if (!rows.length) return <p className="px-5 py-10 text-center text-sm text-muted">No recounted claims yet.</p>;
  const reach = Math.max(1, ...rows.map((row) => Math.abs(row.shift))) * 1.08;
  return (
    <div className="px-5 pb-4 pt-3">
      <div className="mb-1 grid grid-cols-[minmax(0,108px)_1fr_64px] gap-3 text-[11px] text-faint sm:grid-cols-[minmax(0,190px)_1fr_72px]">
        <span />
        <div className="flex justify-between">
          <span>Too low</span>
          <span className="font-semibold text-muted">Source</span>
          <span>Too high</span>
        </div>
        <span />
      </div>
      <ul>
        {rows.map(({ recount, ratio, shift }) => {
          const outcome = OUTCOMES[outcomeOf(recount)];
          const position = 50 + (shift / reach) * 50;
          const body = (
            <>
              <span className="truncate text-left text-[13px] text-ink/80">{claimLabel(recount)}</span>
              <span className="relative h-7">
                <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                <span className="absolute inset-y-0 left-1/2 w-px bg-faint/50" />
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2"
                  style={{
                    left: `${Math.min(position, 50)}%`,
                    width: `${Math.abs(position - 50)}%`,
                    background: outcome.color,
                    opacity: 0.45,
                  }}
                />
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                  style={{ left: `${position}%`, background: outcome.color }}
                />
              </span>
              <span className="num text-right text-xs font-semibold" style={{ color: outcome.color }}>
                {gapLabel(ratio)}
              </span>
            </>
          );
          const grid = "grid w-full grid-cols-[minmax(0,108px)_1fr_64px] items-center gap-3 rounded-lg py-0.5 sm:grid-cols-[minmax(0,190px)_1fr_72px]";
          return (
            <li key={recount.id}>
              {onOpen ? (
                <button onClick={() => onOpen(recount)} className={`${grid} hover:bg-bg`}>
                  {body}
                </button>
              ) : (
                <div className={grid}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ScaleBars({
  rows,
  format,
}: {
  rows: { label: string; value: number; color: string; strong?: boolean }[];
  format?: (value: number) => string;
}) {
  const top = Math.max(...rows.map((row) => Math.abs(row.value)), 0.0001);
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className={`truncate ${row.strong ? "font-semibold" : "text-muted"}`}>{row.label}</span>
            <span className="num shrink-0 font-semibold">{format ? format(row.value) : shortNumber(row.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-none-soft">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((Math.abs(row.value) / top) * 100, 1)}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
