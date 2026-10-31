import type { Verdict } from "@/lib/types";

export const VERDICTS: Record<Verdict, { label: string; color: string; bg: string }> = {
  reproduced: { label: "Reproduced", color: "var(--good)", bg: "#e4f3ec" },
  misleading: { label: "Misleading", color: "var(--warn)", bg: "#faf0d9" },
  wrong: { label: "Wrong", color: "var(--bad)", bg: "#fae5e7" },
  unverifiable: { label: "Unverifiable", color: "var(--none)", bg: "#eeeeec" },
};

export function VerdictChip({ verdict }: { verdict: Verdict | null }) {
  const style = verdict ? VERDICTS[verdict] : { label: "No verdict", color: "var(--none)", bg: "#eeeeec" };
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: style.color, background: style.bg }}
    >
      <span className="size-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}

export const shortNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "n/a" : String(Number(value.toPrecision(4)));

export const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

export function Donut({
  segments,
  center,
  caption,
}: {
  segments: { value: number; color: string }[];
  center: string;
  caption: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="size-36" role="img" aria-label={`${center} ${caption}`}>
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="13" />
      {total > 0 &&
        segments.map((segment, index) => {
          const length = (segment.value / total) * 301.6;
          const circle = (
            <circle
              key={index}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={segment.color}
              strokeWidth="13"
              strokeDasharray={`${length} ${301.6 - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += length;
          return circle;
        })}
      <text x="60" y="60" textAnchor="middle" fontSize="24" fontWeight="700" fill="var(--ink)">
        {center}
      </text>
      <text x="60" y="76" textAnchor="middle" fontSize="9" fill="var(--muted)">
        {caption}
      </text>
    </svg>
  );
}
