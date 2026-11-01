"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  Clock,
  Database,
  Files,
  Globe,
  PieChart,
  Plus,
  Repeat,
  Search,
  ShieldCheck,
  Target,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { Recount, StageName, StageRun } from "@/lib/types";
import { GapPlot, Ring, ScaleBars, StackBar } from "./charts";
import {
  Card,
  claimLabel,
  gapLabel,
  gapOf,
  type Outcome,
  OUTCOMES,
  OutcomeChip,
  outcomeOf,
  placeLabel,
  sourceOf,
  usd,
  VERDICT_ORDER,
  withUnit,
} from "./ui";

export type Config = {
  models: { extractor: string; analyst: string; skeptic: string };
  budgetUsd: number;
  canRun: boolean;
  needsCode: boolean;
  guardrail: boolean;
  mcp: boolean;
  web: boolean;
};

export type Live = { active: StageName | null; done: StageRun[]; model: string; seconds: number };

export const STAGES: { name: StageName; label: string; job: string; role: keyof Config["models"] }[] = [
  { name: "extract", label: "Extract", job: "Pulls out the number, unit, place and period", role: "extractor" },
  { name: "recompute", label: "Recompute", job: "Downloads the source and computes it, blind to the claim", role: "analyst" },
  { name: "replay", label: "Replay", job: "Runs the same script in a fresh sandbox", role: "extractor" },
  { name: "challenge", label: "Challenge", job: "Tries other series and base years", role: "skeptic" },
];

type Open = (recount: Recount) => void;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

const countOf = (recounts: Recount[], outcome: Outcome) => recounts.filter((recount) => outcomeOf(recount) === outcome).length;

function EmptyState({ onNew, text }: { onNew?: () => void; text: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm text-muted">{text}</p>
      {onNew && (
        <button onClick={onNew} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white">
          <Plus className="size-4" aria-hidden />
          New recount
        </button>
      )}
    </div>
  );
}

function Tile({ recount }: { recount: Recount }) {
  const style = OUTCOMES[outcomeOf(recount)];
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg text-[11px] font-bold" style={{ background: style.soft, color: style.color }}>
      {(recount.claim?.geography || "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function ValueGap({ recount }: { recount: Recount }) {
  const unit = recount.claim?.unit;
  const gap = gapOf(recount);
  return (
    <span className="num inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <span className="text-muted">{withUnit(recount.claim?.claimed_value, unit)}</span>
      <ArrowRight className="size-3 text-faint" aria-hidden />
      <span className="font-semibold">{withUnit(recount.analysis?.value, unit)}</span>
      {gap && Math.abs(gap.percent) >= 0.05 && (
        <span className="text-xs font-semibold" style={{ color: OUTCOMES[outcomeOf(recount)].color }}>
          {gapLabel(gap.ratio)}
        </span>
      )}
    </span>
  );
}

function ClaimRows({ recounts, onOpen }: { recounts: Recount[]; onOpen: Open }) {
  return (
    <>
      <table className="hidden w-full text-sm md:table">
        <thead className="bg-bg/60 text-left text-xs text-muted">
          <tr>
            <th className="w-full px-5 py-2.5 font-medium">Claim</th>
            <th className="whitespace-nowrap px-3 py-2.5 font-medium">Claimed → recounted</th>
            <th className="px-3 py-2.5 font-medium">Source</th>
            <th className="px-3 py-2.5 text-right font-medium">Cost</th>
            <th className="px-5 py-2.5 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {recounts.map((recount) => (
            <tr
              key={recount.id}
              tabIndex={0}
              onClick={() => onOpen(recount)}
              onKeyDown={(event) => event.key === "Enter" && onOpen(recount)}
              className="cursor-pointer border-t border-line transition-colors hover:bg-bg/70 focus:bg-bg/70 focus:outline-none"
            >
              <td className="w-full max-w-0 px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <Tile recount={recount} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{claimLabel(recount)}</p>
                    <p className="truncate text-xs text-muted">{placeLabel(recount) || when(recount.createdAt)}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">{recount.claim ? <ValueGap recount={recount} /> : <span className="text-faint">–</span>}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted">{sourceOf(recount) ?? "–"}</td>
              <td className="num px-3 py-2.5 text-right text-muted">{usd(recount.costUsd)}</td>
              <td className="px-5 py-2.5">
                <OutcomeChip outcome={outcomeOf(recount)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-line border-t border-line md:hidden">
        {recounts.map((recount) => (
          <li key={recount.id}>
            <button onClick={() => onOpen(recount)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <Tile recount={recount} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{claimLabel(recount)}</span>
                {recount.claim && <ValueGap recount={recount} />}
              </span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: OUTCOMES[outcomeOf(recount)].color }} aria-label={OUTCOMES[outcomeOf(recount)].label} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Overview({ recounts, onOpen, onViewAll, onNew }: { recounts: Recount[]; onOpen: Open; onViewAll: () => void; onNew: () => void }) {
  const verdicts = VERDICT_ORDER.map((verdict) => ({ verdict, value: countOf(recounts, verdict), color: OUTCOMES[verdict].color }));
  const decided = verdicts.reduce((sum, row) => sum + row.value, 0);
  const held = countOf(recounts, "reproduced");
  const spend = recounts.reduce((sum, recount) => sum + recount.costUsd, 0);
  const miss = recounts
    .filter((recount) => outcomeOf(recount) === "wrong" && gapOf(recount))
    .sort((a, b) => Math.abs(Math.log(gapOf(b)!.ratio)) - Math.abs(Math.log(gapOf(a)!.ratio)))[0];
  const replays = recounts.filter((recount) => recount.challenge);
  const identical = replays.filter((recount) => recount.challenge?.rerun_identical).length;
  const blocked = countOf(recounts, "blocked");

  const strip: { label: string; value: string; outcome?: Outcome; note?: string }[] = [
    { label: "Recounts", value: String(recounts.length), note: `${usd(spend)} total` },
    { label: "Reproduced", value: String(held), outcome: "reproduced" },
    { label: "Wrong", value: String(countOf(recounts, "wrong")), outcome: "wrong" },
    { label: "Misleading", value: String(countOf(recounts, "misleading")), outcome: "misleading" },
    { label: "Blocked", value: String(blocked), outcome: "blocked" },
  ];

  if (!recounts.length)
    return (
      <div className="card">
        <EmptyState onNew={onNew} text="No recounts yet. Paste a claim to run the first one." />
      </div>
    );

  return (
    <div className="space-y-4">
      <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        {strip.map(({ label, value, outcome, note }) => (
          <div key={label} className="p-4 lg:px-5">
            <p className="flex items-center justify-between gap-2 text-[13px] text-muted">
              {label}
              {outcome && <span className="size-2 rounded-full" style={{ background: OUTCOMES[outcome].color }} />}
            </p>
            <p className="num mt-1 text-3xl font-bold">{value}</p>
            <p className="mt-0.5 h-4 text-xs text-muted">{note ?? (decided && outcome !== "blocked" ? `${Math.round((Number(value) / decided) * 100)}% of verdicts` : outcome === "blocked" ? "Refused before any model" : "")}</p>
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="How far off" icon={Target} action={<span className="text-xs text-muted">Log scale</span>}>
          <GapPlot recounts={recounts} onOpen={onOpen} />
        </Card>

        <div className="space-y-4">
          <Card title="Verdicts" icon={PieChart}>
            <div className="flex items-center gap-4 px-5 py-4">
              <Ring
                size={124}
                center={decided ? `${Math.round((held / decided) * 100)}%` : "–"}
                caption="held up"
                segments={verdicts}
              />
              <ul className="min-w-0 flex-1 space-y-2 text-[13px]">
                {verdicts.map(({ verdict, value, color }) => (
                  <li key={verdict} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="truncate text-muted">{OUTCOMES[verdict].label}</span>
                    <span className="num ml-auto font-semibold">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          {miss && (
            <Card>
              <button onClick={() => onOpen(miss)} className="block w-full p-5 text-left">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <TriangleAlert className="size-4 text-bad" aria-hidden />
                  Biggest miss
                </p>
                <p className="num mt-2 text-4xl font-bold text-bad">{gapLabel(gapOf(miss)!.ratio).replace(" high", "").replace(" low", "")}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {withUnit(miss.claim?.claimed_value, miss.claim?.unit)} claimed, {withUnit(miss.analysis?.value, miss.claim?.unit)} in the data. {miss.claim?.geography} {miss.claim?.period}.
                </p>
                <span className="mt-3 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold">
                  Open report <ArrowRight className="size-3" aria-hidden />
                </span>
              </button>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card
          title="Recent claims"
          icon={Files}
          action={
            <button onClick={onViewAll} className="flex items-center gap-1 text-xs font-semibold text-accent">
              View all <ArrowRight className="size-3" aria-hidden />
            </button>
          }
        >
          <div className="mt-3 overflow-hidden rounded-b-2xl">
            <ClaimRows recounts={recounts.slice(0, 6)} onOpen={onOpen} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Checks passed" icon={ShieldCheck}>
            <ul className="space-y-3 px-5 py-4 text-[13px]">
              <li>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted">Replays identical</span>
                  <span className="num font-semibold">
                    {identical} of {replays.length}
                  </span>
                </div>
                <StackBar segments={[{ value: identical, color: "var(--good)" }, { value: replays.length - identical, color: "var(--line)" }]} />
              </li>
              <li>
                <div className="mb-1 flex justify-between">
                  <span className="text-muted">Injections stopped</span>
                  <span className="num font-semibold">{blocked}</span>
                </div>
                <StackBar segments={[{ value: blocked, color: "var(--accent)" }]} />
              </li>
            </ul>
          </Card>
          <Card title="Latest runs" icon={Clock}>
            <ol className="px-5 py-3">
              {recounts.slice(0, 4).map((recount) => (
                <li key={recount.id} className="relative border-l border-line pb-3 pl-4 last:border-transparent last:pb-0">
                  <span className="absolute -left-1 top-1 size-2 rounded-full" style={{ background: OUTCOMES[outcomeOf(recount)].color }} />
                  <button onClick={() => onOpen(recount)} className="block w-full text-left">
                    <span className="block truncate text-[13px] font-medium">{claimLabel(recount)}</span>
                    <span className="num block text-xs text-muted">{when(recount.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

const FILTERS: (Outcome | "all")[] = ["all", ...VERDICT_ORDER, "blocked"];
const PAGE = 10;

export function Claims({ recounts, query, onQuery, onOpen, onNew }: { recounts: Recount[]; query: string; onQuery: (value: string) => void; onOpen: Open; onNew: () => void }) {
  const [filter, setFilter] = useState<Outcome | "all">("all");
  const [page, setPage] = useState(0);
  const needle = query.trim().toLowerCase();
  const rows = recounts.filter(
    (recount) =>
      (filter === "all" || outcomeOf(recount) === filter) &&
      (!needle || [claimLabel(recount), placeLabel(recount), sourceOf(recount)].join(" ").toLowerCase().includes(needle)),
  );
  const pages = Math.max(Math.ceil(rows.length / PAGE), 1);
  const current = Math.min(page, pages - 1);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex gap-1 overflow-x-auto">
          {FILTERS.map((item) => {
            const count = item === "all" ? recounts.length : countOf(recounts, item);
            return (
              <button
                key={item}
                onClick={() => {
                  setFilter(item);
                  setPage(0);
                }}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${filter === item ? "bg-ink text-white" : "text-muted hover:bg-bg"}`}
              >
                {item === "all" ? "All" : OUTCOMES[item].label} <span className="num opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-lg border border-line px-3 text-sm focus-within:border-accent sm:w-52 lg:hidden">
          <Search className="size-4 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search claims"
            aria-label="Search claims"
            className="min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </div>
      {rows.length ? (
        <ClaimRows recounts={rows.slice(current * PAGE, (current + 1) * PAGE)} onOpen={onOpen} />
      ) : (
        <EmptyState onNew={recounts.length ? undefined : onNew} text={recounts.length ? "Nothing matches that filter." : "No recounts yet."} />
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
          <span className="num text-muted">
            Page {current + 1} of {pages}
          </span>
          <span className="flex gap-1">
            <button disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page" className="rounded-lg border border-line p-1.5 disabled:opacity-40">
              <ChevronLeft className="size-4" />
            </button>
            <button disabled={current === pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page" className="rounded-lg border border-line p-1.5 disabled:opacity-40">
              <ChevronRight className="size-4" />
            </button>
          </span>
        </div>
      )}
    </Card>
  );
}

export function Sources({ recounts, onOpen }: { recounts: Recount[]; onOpen: Open }) {
  const groups = useMemo(() => {
    const map = new Map<string, Recount[]>();
    for (const recount of recounts) {
      const source = sourceOf(recount);
      if (source) map.set(source, [...(map.get(source) ?? []), recount]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [recounts]);
  const places = useMemo(() => {
    const map = new Map<string, Recount[]>();
    for (const recount of recounts) {
      const place = recount.claim?.geography;
      if (place) map.set(place, [...(map.get(place) ?? []), recount]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [recounts]);

  if (!groups.length)
    return (
      <div className="card">
        <EmptyState text="No sources yet. They appear after the first recount." />
      </div>
    );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2">
        {groups.map(([source, rows]) => {
          const links = [...new Map(rows.map((recount) => [recount.analysis?.dataset_title || source, recount])).entries()].slice(0, 4);
          return (
            <Card key={source} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="size-4 text-faint" aria-hidden />
                    {source}
                  </p>
                  <p className="num mt-2 text-3xl font-bold">{rows.length}</p>
                  <p className="text-xs text-muted">{rows.length === 1 ? "claim recounted" : "claims recounted"}</p>
                </div>
              </div>
              <div className="mt-4">
                <StackBar segments={VERDICT_ORDER.map((verdict) => ({ value: countOf(rows, verdict), color: OUTCOMES[verdict].color }))} />
              </div>
              <ul className="mt-3 divide-y divide-line">
                {links.map(([title, recount]) => (
                  <li key={title}>
                    <button onClick={() => onOpen(recount)} className="w-full truncate py-2 text-left text-[13px] text-muted hover:text-ink">
                      {title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      <Card title="Places checked" icon={Globe}>
        <ul className="space-y-3 px-5 py-4">
          {places.map(([place, rows]) => (
            <li key={place}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="font-medium">{place}</span>
                <span className="num text-muted">{rows.length}</span>
              </div>
              <StackBar segments={VERDICT_ORDER.map((verdict) => ({ value: countOf(rows, verdict), color: OUTCOMES[verdict].color }))} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function Spend({ recounts, budget, onOpen }: { recounts: Recount[]; budget: number; onOpen: Open }) {
  const total = recounts.reduce((sum, recount) => sum + recount.costUsd, 0);
  const runs = recounts.filter((recount) => recount.stages.length);
  const avg = runs.length ? total / runs.length : 0;
  const peak = Math.max(0, ...runs.map((recount) => recount.costUsd));
  const stages = recounts.flatMap((recount) => recount.stages);
  const byStage = STAGES.map(({ name, label }, index) => ({
    label,
    value: stages.filter((run) => run.stage === name).reduce((sum, run) => sum + run.costUsd, 0),
    color: ["var(--accent)", "#6d5ae6", "#22b8cf", "#f2a33a"][index],
  }));
  const models = [...new Set(stages.map((run) => run.servedModel))]
    .map((model) => ({
      label: model.split("/").pop() ?? model,
      value: stages.filter((run) => run.servedModel === model).reduce((sum, run) => sum + run.costUsd, 0),
      color: "var(--accent)",
    }))
    .sort((a, b) => b.value - a.value);
  const ordered = [...runs].reverse();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Total spend", usd(total), `${runs.length} runs`],
          ["Average run", usd(avg), "Per recount"],
          ["Priciest run", usd(peak), `${Math.round((peak / budget) * 100)}% of the cap`],
          ["Cap per run", usd(budget), "Stops itself here"],
        ].map(([label, value, note]) => (
          <Card key={label} className="p-4">
            <p className="text-[13px] text-muted">{label}</p>
            <p className="num mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{note}</p>
          </Card>
        ))}
      </div>
      <Card title="Each run against the cap" icon={Wallet} action={<span className="num text-xs text-muted">Top line = {usd(budget)}</span>}>
        <div className="px-5 pb-4 pt-5">
          <div className="relative flex h-44 items-end gap-1.5 border-t border-dashed border-bad/50 sm:gap-2.5">
            {ordered.map((recount) => (
              <button
                key={recount.id}
                onClick={() => onOpen(recount)}
                title={`${claimLabel(recount)}: ${usd(recount.costUsd)}`}
                aria-label={`${claimLabel(recount)}: ${usd(recount.costUsd)}`}
                className="group relative h-full flex-1"
              >
                <span
                  className="absolute inset-x-0 bottom-0 rounded-t-md transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max((recount.costUsd / budget) * 100, 1)}%`, background: OUTCOMES[outcomeOf(recount)].color }}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Oldest to newest, coloured by verdict. Some runs read low when Otari closes a stream with no cost figure.</p>
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="By stage" icon={PieChart}>
          <div className="flex items-center gap-5 px-5 py-4">
            <Ring size={124} center={usd(total)} caption="total" segments={byStage} />
            <ul className="min-w-0 flex-1 space-y-2 text-[13px]">
              {byStage.map((row) => (
                <li key={row.label} className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                  <span className="text-muted">{row.label}</span>
                  <span className="num ml-auto font-semibold">{usd(row.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card title="By model" icon={Bot}>
          <div className="px-5 py-4">{models.length ? <ScaleBars rows={models} format={usd} /> : <p className="text-sm text-muted">No model calls yet.</p>}</div>
        </Card>
      </div>
    </div>
  );
}

export function Pipeline({ recounts, config }: { recounts: Recount[]; config: Config | null }) {
  const runs = recounts.flatMap((recount) => recount.stages);
  const fallbacks = runs.filter((run) => run.fallback).length;
  const features: [string, boolean, string][] = [
    ["Code execution", true, "Every number comes from here"],
    ["MCP data server", Boolean(config?.mcp), "World Bank and Eurostat"],
    ["Web search and fetch", Boolean(config?.web), "URLs, and series the tools lack"],
    ["Injection guardrail", Boolean(config?.guardrail), "Otari answers 403"],
    ["Analyst fallback policy", config?.models.analyst === "recount-analyst", "DeepSeek, then Kimi"],
    ["Cap per recount", true, usd(config?.budgetUsd ?? 0.25)],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAGES.map(({ name, label, job, role }, index) => {
          const rows = runs.filter((run) => run.stage === name);
          const seconds = rows.length ? rows.reduce((sum, run) => sum + run.durationMs, 0) / rows.length / 1000 : 0;
          const cost = rows.length ? rows.reduce((sum, run) => sum + run.costUsd, 0) / rows.length : 0;
          return (
            <Card key={name} className="relative p-5">
              <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{index + 1}</span>
              <h2 className="mt-3 font-semibold">{label}</h2>
              <p className="mt-0.5 min-h-9 text-[13px] leading-snug text-muted">{job}</p>
              <p className="mt-3 truncate rounded-md bg-bg px-2 py-1 font-mono text-[11px]">{config?.models[role] ?? "–"}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted">
                <span className="num inline-flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  {seconds.toFixed(0)}s
                </span>
                <span className="num inline-flex items-center gap-1">
                  <Wallet className="size-3" aria-hidden />
                  {usd(cost)}
                </span>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card title="Otari features" icon={ShieldCheck}>
          <ul className="grid gap-x-6 px-5 py-2 sm:grid-cols-2">
            {features.map(([name, on, note]) => (
              <li key={name} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                {on ? <CircleCheck className="size-5 shrink-0 text-good" aria-label="On" /> : <CircleDashed className="size-5 shrink-0 text-faint" aria-label="Off" />}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{name}</span>
                  <span className="block truncate text-xs text-muted">{on ? note : "Off"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Fallbacks used" icon={Repeat}>
          <div className="flex items-center justify-center py-4">
            <Ring
              size={132}
              center={String(fallbacks)}
              caption={`of ${runs.length} calls`}
              segments={[
                { value: fallbacks, color: "var(--accent)" },
                { value: runs.length - fallbacks, color: "var(--line)" },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

const RULES: [Outcome, string, string][] = [
  ["reproduced", "Same definition, same number", "Within 2%, or 5% if the claim says about or nearly."],
  ["misleading", "True under another reading", "It only matches another reading, or the definition differs and a computed rival sits over 10% away."],
  ["wrong", "The source says otherwise", "The figure is outside tolerance on every reading."],
  ["unverifiable", "Nothing solid to compare", "No primary data, or the script failed to replay."],
];

const GUARDS: [string, string][] = [
  ["Numbers come from stdout", "A figure a model types into its answer is never used."],
  ["The analyst never sees the claim", "It gets the metric, place and period, not the number."],
  ["Data must be downloaded", "A script with values typed in is rejected."],
  ["Code picks the verdict", "No model decides the outcome."],
];

export function Method() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {RULES.map(([outcome, title, rule]) => (
          <Card key={outcome} className="p-5">
            <OutcomeChip outcome={outcome} />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-[13px] text-muted">{rule}</p>
          </Card>
        ))}
      </div>
      <Card title="Four guards" icon={ShieldCheck}>
        <ol className="grid gap-px px-5 py-3 sm:grid-cols-2">
          {GUARDS.map(([title, text], index) => (
            <li key={title} className="flex gap-3 py-2.5">
              <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold">{index + 1}</span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-[13px] text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
