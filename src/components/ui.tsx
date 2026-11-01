import type { LucideIcon } from "lucide-react";
import type { Recount, Verdict } from "@/lib/types";

export type Outcome = Verdict | "blocked" | "failed";

export const OUTCOMES: Record<Outcome, { label: string; color: string; soft: string }> = {
  reproduced: { label: "Reproduced", color: "var(--good)", soft: "var(--good-soft)" },
  misleading: { label: "Misleading", color: "var(--warn)", soft: "var(--warn-soft)" },
  wrong: { label: "Wrong", color: "var(--bad)", soft: "var(--bad-soft)" },
  unverifiable: { label: "Unverifiable", color: "var(--none)", soft: "var(--none-soft)" },
  blocked: { label: "Blocked", color: "var(--accent)", soft: "var(--accent-soft)" },
  failed: { label: "No verdict", color: "var(--none)", soft: "var(--none-soft)" },
};

export const VERDICT_ORDER: Verdict[] = ["reproduced", "misleading", "wrong", "unverifiable"];

export const outcomeOf = (recount: Recount): Outcome =>
  recount.verdict ?? (recount.status === "blocked" ? "blocked" : "failed");

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const style = OUTCOMES[outcome];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: style.color, background: style.soft }}
    >
      <span className="size-1.5 rounded-full" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}

export const shortNumber = (value: number | null | undefined) =>
  value === null || value === undefined ? "n/a" : Number(value.toPrecision(4)).toLocaleString("en-US");

export const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

// Units arrive as the model wrote them, so "USD", "billion USD" and "%" all need to read as money or percent.
export function withUnit(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "n/a";
  const number = shortNumber(value);
  if (/%|percent/i.test(unit)) return `${number}%`;
  if (/billion/i.test(unit)) return `$${number}bn`;
  if (/usd|dollar|\$/i.test(unit)) return `$${number}`;
  return number;
}

export const claimLabel = (recount: Recount) => recount.claim?.statement ?? recount.input;

export const placeLabel = (recount: Recount) =>
  [recount.claim?.geography, recount.claim?.period].filter(Boolean).join(" · ");

// How far the claim sits from the data. A ratio of 2 means the claim is twice the source figure.
export function gapOf(recount: Recount) {
  const claimed = recount.claim?.claimed_value;
  const found = recount.analysis?.value;
  if (!claimed || !found || claimed * found < 0) return null;
  return { ratio: claimed / found, percent: ((claimed - found) / found) * 100 };
}

export function gapLabel(ratio: number) {
  if (ratio >= 2) return `${ratio.toFixed(1)}× high`;
  if (ratio <= 0.5) return `${(1 / ratio).toFixed(1)}× low`;
  const percent = (ratio - 1) * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

export function sourceOf(recount: Recount) {
  const url = recount.analysis?.data_url;
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    if (host.includes("worldbank")) return "World Bank";
    if (host.includes("europa.eu")) return "Eurostat";
    if (host.includes("imf.org")) return "IMF";
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// Every figure in a report on one scale: the claim, the recount, the replay, then the skeptic's readings.
export function readingsOf(recount: Recount) {
  const rows: { label: string; value: number; color: string; strong?: boolean }[] = [];
  const add = (label: string, value: number | null | undefined, color: string, strong?: boolean) => {
    if (value !== null && value !== undefined) rows.push({ label, value, color, strong });
  };
  add("Claimed", recount.claim?.claimed_value, "var(--ink)", true);
  add("Recounted", recount.analysis?.value, OUTCOMES[outcomeOf(recount)].color, true);
  for (const { label, value } of recount.challenge?.alternatives ?? []) add(label.replaceAll("_", " "), value, "var(--faint)");
  return rows;
}

export function Card({
  title,
  icon: Icon,
  action,
  className = "",
  children,
}: {
  title?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card min-w-0 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {Icon && <Icon className="size-4 text-faint" aria-hidden />}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Three solid shapes for the three models that check each other: stem, bowl and leg.
export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="10 6 44 52" className={className} aria-hidden>
      <rect x="15" y="10" width="13" height="44" rx="1.5" fill="#101828" />
      <path d="M31 10h6.5a11.5 11.5 0 0 1 0 23H31z" fill="#2563eb" />
      <path d="M31 36a18 18 0 0 1 18 18H31z" fill="#101828" />
    </svg>
  );
}
