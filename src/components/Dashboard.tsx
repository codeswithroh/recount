"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Recount, RecountEvent, StageName, StageRun, Verdict } from "@/lib/types";
import { Donut, shortNumber, usd, VERDICTS, VerdictChip } from "./ui";

type Config = {
  models: { extractor: string; analyst: string; skeptic: string };
  budgetUsd: number;
  canRun: boolean;
  needsCode: boolean;
  guardrail: boolean;
  mcp: boolean;
  web: boolean;
};

type View = "Overview" | "Claims" | "Spend" | "System";
const VIEWS: View[] = ["Overview", "Claims", "Spend", "System"];

const STAGES: { name: StageName; label: string }[] = [
  { name: "extract", label: "Extract" },
  { name: "recompute", label: "Recompute" },
  { name: "replay", label: "Replay" },
  { name: "challenge", label: "Challenge" },
];

const VERDICT_ORDER: Verdict[] = ["reproduced", "misleading", "wrong", "unverifiable"];

const EXAMPLES = [
  "India's population grew 2.5% between 2020 and 2023.",
  "Germany's unemployment rate was 3% in 2023.",
  "Brazil's GDP per capita doubled between 2003 and 2013.",
];

type Live = { active: StageName | null; done: StageRun[]; model: string };

export function Dashboard() {
  const [recounts, setRecounts] = useState<Recount[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("Overview");
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [runError, setRunError] = useState("");
  const [open, setOpen] = useState<Recount | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/recounts");
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setRecounts(body.recounts);
      setConfig(body.config);
    } catch {
      setLoadError("Could not load recounts.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (text: string) => {
    setRunError("");
    setLive({ active: null, done: [], model: "" });
    try {
      const res = await fetch("/api/recounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text, code }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "The request failed.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as RecountEvent;
          if (event.type === "stage_start")
            setLive((state) => state && { ...state, active: event.stage, model: event.model });
          if (event.type === "stage_done")
            setLive((state) => state && { ...state, active: null, done: [...state.done, event.run] });
          if (event.type === "done") {
            setRecounts((list) => [event.recount, ...list]);
            setOpen(event.recount);
            setInput("");
          }
        }
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "The run failed.");
    } finally {
      setLive(null);
    }
  };

  const stats = useMemo(() => {
    const counts = Object.fromEntries(
      VERDICT_ORDER.map((verdict) => [verdict, recounts.filter((recount) => recount.verdict === verdict).length]),
    ) as Record<Verdict, number>;
    const decided = recounts.filter((recount) => recount.verdict).length;
    const spend = recounts.reduce((sum, recount) => sum + recount.costUsd, 0);
    return { counts, decided, spend, avg: recounts.length ? spend / recounts.length : 0 };
  }, [recounts]);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[210px_1fr]">
      <aside className="flex items-center gap-1 overflow-x-auto border-b border-line bg-card px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-b-0 md:border-r md:py-5">
        <Link href="/" className="mr-3 text-lg font-bold tracking-tight md:mb-6 md:px-3">
          Recount
        </Link>
        {VIEWS.map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
              view === item ? "bg-accent-soft text-accent" : "text-muted hover:bg-bg"
            }`}
          >
            {item}
          </button>
        ))}
      </aside>

      <main className="min-w-0 px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{view}</h1>
          {config && (
            <span className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-muted">
              {usd(config.budgetUsd)} cap per recount
            </span>
          )}
        </header>

        {loadError && <p className="card mb-4 p-4 text-sm text-bad">{loadError}</p>}

        {view === "Overview" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-4">
              <section className="card p-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (input.trim() && !live) run(input);
                  }}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={Boolean(live)}
                    placeholder="Paste a statistic or a URL"
                    aria-label="Claim or URL"
                    className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"
                  />
                  {config?.needsCode && (
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      disabled={Boolean(live)}
                      placeholder="Access code"
                      aria-label="Access code"
                      className="rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent sm:w-36"
                    />
                  )}
                  <button
                    disabled={Boolean(live) || !input.trim() || config?.canRun === false}
                    className="rounded-xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-40"
                  >
                    {live ? "Running" : "Recount"}
                  </button>
                </form>
                {config?.canRun === false && (
                  <p className="mt-2 text-sm text-muted">Read-only here. Run it locally with your Otari key.</p>
                )}
                {runError && <p className="mt-2 text-sm text-bad">{runError}</p>}
                {live ? (
                  <Progress live={live} />
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        onClick={() => setInput(example)}
                        className="rounded-full bg-bg px-3 py-1.5 text-left text-xs text-muted hover:text-ink"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Stat label="Recounts" value={String(recounts.length)} strong />
                <Stat label="Reproduced" value={String(stats.counts.reproduced)} tone="var(--good)" />
                <Stat
                  label="Wrong or misleading"
                  value={String(stats.counts.wrong + stats.counts.misleading)}
                  tone="var(--bad)"
                />
                <Stat label="Avg cost" value={usd(stats.avg)} />
              </div>

              <ClaimsTable recounts={recounts.slice(0, 8)} onOpen={setOpen} />
            </div>

            <div className="space-y-4">
              <section className="card p-5">
                <h2 className="font-semibold">Verdicts</h2>
                <div className="mt-3 flex items-center gap-4">
                  <Donut
                    center={String(stats.decided)}
                    caption="verdicts"
                    segments={VERDICT_ORDER.map((verdict) => ({
                      value: stats.counts[verdict],
                      color: VERDICTS[verdict].color,
                    }))}
                  />
                  <ul className="space-y-1.5 text-sm">
                    {VERDICT_ORDER.map((verdict) => (
                      <li key={verdict} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: VERDICTS[verdict].color }} />
                        <span className="text-muted">{VERDICTS[verdict].label}</span>
                        <span className="font-semibold">{stats.counts[verdict]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
              <SpendCard recounts={recounts} budget={config?.budgetUsd ?? 0.25} />
            </div>
          </div>
        )}

        {view === "Claims" && <ClaimsTable recounts={recounts} onOpen={setOpen} />}
        {view === "Spend" && <Spend recounts={recounts} total={stats.spend} budget={config?.budgetUsd ?? 0.25} />}
        {view === "System" && config && <System config={config} recounts={recounts} />}
      </main>

      {open && <Report recount={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Stat({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className={`card p-4 ${strong ? "!bg-ink text-white" : ""}`}>
      <div className={`text-sm ${strong ? "text-white/70" : "text-muted"}`}>{label}</div>
      <div className="mt-1 font-mono text-3xl font-bold" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}

function Progress({ live }: { live: Live }) {
  return (
    <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-live="polite">
      {STAGES.map(({ name, label }) => {
        const finished = live.done.find((run) => run.stage === name);
        const active = live.active === name;
        return (
          <li
            key={name}
            className={`rounded-xl border p-3 text-sm ${
              active ? "animate-pulse border-accent bg-accent-soft" : "border-line"
            }`}
          >
            <div className="font-semibold">{label}</div>
            <div className="truncate font-mono text-xs text-muted">
              {finished ? `${usd(finished.costUsd)} · ${(finished.durationMs / 1000).toFixed(0)}s` : active ? live.model : "waiting"}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ClaimsTable({ recounts, onOpen }: { recounts: Recount[]; onOpen: (recount: Recount) => void }) {
  if (!recounts.length)
    return <p className="card p-8 text-center text-muted">No recounts yet. Paste a claim to run the first one.</p>;
  return (
    <section className="card overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="p-4 font-medium">Claim</th>
            <th className="p-4 font-medium">Claimed</th>
            <th className="p-4 font-medium">Recounted</th>
            <th className="p-4 font-medium">Verdict</th>
            <th className="p-4 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {recounts.map((recount) => (
            <tr
              key={recount.id}
              tabIndex={0}
              onClick={() => onOpen(recount)}
              onKeyDown={(event) => event.key === "Enter" && onOpen(recount)}
              className="cursor-pointer border-t border-line hover:bg-bg"
            >
              <td className="max-w-80 truncate p-4 font-medium">{recount.claim?.statement ?? recount.input}</td>
              <td className="p-4 font-mono">{shortNumber(recount.claim?.claimed_value)}</td>
              <td className="p-4 font-mono">{shortNumber(recount.analysis?.value)}</td>
              <td className="p-4">
                <VerdictChip verdict={recount.verdict} />
              </td>
              <td className="p-4 font-mono text-muted">{usd(recount.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SpendCard({ recounts, budget }: { recounts: Recount[]; budget: number }) {
  const last = recounts[0];
  const share = last ? Math.min(last.costUsd / budget, 1) : 0;
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Last run against cap</h2>
      <div className="mt-3 font-mono text-2xl font-bold">
        {usd(last?.costUsd ?? 0)} <span className="text-sm font-normal text-muted">of {usd(budget)}</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
      </div>
    </section>
  );
}

function Spend({ recounts, total, budget }: { recounts: Recount[]; total: number; budget: number }) {
  const byStage = STAGES.map(({ name, label }) => ({
    label,
    cost: recounts.flatMap((recount) => recount.stages).filter((run) => run.stage === name).reduce((sum, run) => sum + run.costUsd, 0),
  }));
  const top = Math.max(...byStage.map((row) => row.cost), 0.0001);
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <Stat label="Total spend" value={usd(total)} strong />
        <SpendCard recounts={recounts} budget={budget} />
      </div>
      <section className="card p-5">
        <h2 className="font-semibold">Spend by stage</h2>
        <ul className="mt-4 space-y-3">
          {byStage.map((row) => (
            <li key={row.label} className="grid grid-cols-[84px_1fr_60px] items-center gap-3 text-sm">
              <span className="text-muted">{row.label}</span>
              <div className="h-3 rounded-full bg-bg">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.cost / top) * 100}%` }} />
              </div>
              <span className="text-right font-mono">{usd(row.cost)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function System({ config, recounts }: { config: Config; recounts: Recount[] }) {
  const runs = recounts.flatMap((recount) => recount.stages);
  const fallbacks = runs.filter((run) => run.fallback).length;
  const features: [string, boolean][] = [
    ["Code execution", true],
    ["MCP data server", config.mcp],
    ["Web search and fetch", config.web],
    ["Prompt-injection guardrail", config.guardrail],
    ["Hard budget per recount", true],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="font-semibold">Models</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {Object.entries(config.models).map(([role, model]) => (
            <li key={role} className="flex justify-between gap-4 py-2.5">
              <span className="capitalize text-muted">{role}</span>
              <span className="truncate font-mono">{model}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Otari features</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {features.map(([name, on]) => (
            <li key={name} className="flex justify-between py-2.5">
              <span>{name}</span>
              <span className={`font-semibold ${on ? "text-good" : "text-none"}`}>{on ? "On" : "Off"}</span>
            </li>
          ))}
          <li className="flex justify-between py-2.5">
            <span>Fallbacks used</span>
            <span className="font-mono font-semibold">
              {fallbacks} of {runs.length}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Report({ recount, onClose }: { recount: Recount; onClose: () => void }) {
  const { claim, analysis, challenge } = recount;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex justify-end bg-ink/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Recount report"
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-xl overflow-y-auto bg-card p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <VerdictChip verdict={recount.verdict} />
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-bg">
            Close
          </button>
        </div>
        <h2 className="mt-3 text-xl font-bold">{claim?.statement ?? recount.input}</h2>
        <p className="mt-1 text-muted">{recount.reason}</p>
        {recount.error && <p className="mt-2 text-sm text-bad">{recount.error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-bg p-4">
            <div className="text-xs text-muted">Claimed</div>
            <div className="font-mono text-3xl font-bold">{shortNumber(claim?.claimed_value)}</div>
          </div>
          <div className="rounded-xl bg-accent-soft p-4">
            <div className="text-xs text-muted">Recounted</div>
            <div className="font-mono text-3xl font-bold text-accent">{shortNumber(analysis?.value)}</div>
          </div>
        </div>

        {analysis?.found_data && (
          <section className="mt-6">
            <h3 className="font-semibold">Source</h3>
            <a href={analysis.data_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-accent underline">
              {analysis.dataset_title || analysis.data_url}
            </a>
            <p className="mt-1 text-sm text-muted">{analysis.method}</p>
          </section>
        )}

        {challenge && (
          <section className="mt-6">
            <h3 className="font-semibold">Other readings</h3>
            <ul className="mt-2 divide-y divide-line text-sm">
              <li className="flex justify-between py-2">
                <span className="text-muted">Replay in fresh sandbox</span>
                <span className="font-mono">{shortNumber(challenge.rerun_value)}</span>
              </li>
              {challenge.alternatives.map((alternative) => (
                <li key={alternative.label} className="flex justify-between gap-4 py-2">
                  <span className="text-muted">{alternative.label}</span>
                  <span className="font-mono">{shortNumber(alternative.value)}</span>
                </li>
              ))}
            </ul>
            {challenge.objections?.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-muted">
                {challenge.objections.map((objection) => (
                  <li key={objection}>{objection}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {analysis?.script && (
          <section className="mt-6">
            <h3 className="font-semibold">Script</h3>
            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-ink p-4 font-mono text-xs text-white/90">{analysis.script}</pre>
            <pre className="mt-2 overflow-auto rounded-xl bg-bg p-3 font-mono text-xs">{analysis.stdout}</pre>
          </section>
        )}

        <section className="mt-6">
          <h3 className="font-semibold">Run</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {recount.stages.map((run, index) => (
              <li key={`${run.stage}-${index}`} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {run.role}
                  {run.fallback && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">fallback</span>}
                </span>
                <span className="truncate font-mono text-xs text-muted">
                  {run.servedModel} · {usd(run.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
