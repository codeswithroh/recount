"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, X } from "lucide-react";
import type { Recount } from "@/lib/types";
import { ScaleBars } from "./charts";
import { claimLabel, gapLabel, gapOf, OUTCOMES, OutcomeChip, outcomeOf, placeLabel, readingsOf, sourceOf, usd, withUnit } from "./ui";

type Tab = "Evidence" | "Script" | "Run";

function CopyButton({ text, label, icon: Icon = Copy }: { text: string; label: string; icon?: typeof Copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-bg"
    >
      {copied ? <Check className="size-3.5 text-good" /> : <Icon className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function Report({ recount, onClose }: { recount: Recount; onClose: () => void }) {
  const { claim, analysis, challenge, stages } = recount;
  const [tab, setTab] = useState<Tab>("Evidence");
  const outcome = outcomeOf(recount);
  const gap = gapOf(recount);
  const unit = claim?.unit ?? "";
  const readings = readingsOf(recount);
  const totalMs = stages.reduce((sum, run) => sum + run.durationMs, 0);
  const source = sourceOf(recount);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  let elapsed = 0;
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-label="Recount report"
        onClick={(event) => event.stopPropagation()}
        className="slide flex h-full w-full max-w-xl flex-col bg-card"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <OutcomeChip outcome={outcome} />
          <div className="flex items-center gap-1.5">
            <CopyButton text={typeof window === "undefined" ? "" : window.location.href} label="Link" icon={Link2} />
            <button onClick={onClose} aria-label="Close report" className="rounded-lg p-1.5 text-muted hover:bg-bg">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="px-5 pt-3">
          <h2 className="text-lg font-bold leading-snug tracking-tight">{claimLabel(recount)}</h2>
          <p className="mt-1 text-sm text-muted">{recount.reason}</p>
          {recount.error && <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{recount.error}</p>}
        </div>

        <div className="mx-5 mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-bg p-4">
          <div>
            <p className="text-xs text-muted">Claimed</p>
            <p className="num mt-0.5 text-2xl font-bold sm:text-3xl">{withUnit(claim?.claimed_value, unit)}</p>
          </div>
          <span className="num rounded-full bg-card px-2.5 py-1 text-xs font-semibold" style={{ color: OUTCOMES[outcome].color }}>
            {gap ? gapLabel(gap.ratio) : "→"}
          </span>
          <div className="text-right">
            <p className="text-xs text-muted">Recounted</p>
            <p className="num mt-0.5 text-2xl font-bold sm:text-3xl" style={{ color: OUTCOMES[outcome].color }}>
              {withUnit(analysis?.value, unit)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-5 border-b border-line px-5" role="tablist">
          {(["Evidence", "Script", "Run"] as Tab[]).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`-mb-px border-b-2 py-2 text-sm font-semibold ${tab === item ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {tab === "Evidence" && (
            <>
              {readings.length > 0 && (
                <section>
                  <h3 className="mb-3 text-sm font-semibold">Every reading, one scale</h3>
                  <ScaleBars rows={readings} format={(value) => withUnit(value, unit)} />
                </section>
              )}
              {challenge && (
                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line p-3">
                    <p className="text-xs text-muted">Replay</p>
                    <p className="num mt-1 font-semibold">{withUnit(challenge.rerun_value, unit)}</p>
                    <p className={`mt-0.5 text-xs font-medium ${challenge.rerun_identical ? "text-good" : "text-warn"}`}>
                      {challenge.rerun_identical ? "Identical script" : "Script differed"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line p-3">
                    <p className="text-xs text-muted">Definition</p>
                    <p className="mt-1 font-semibold">{challenge.definition_match === false ? "Differs" : "Matches"}</p>
                    <p className="mt-0.5 text-xs text-muted">Skeptic&apos;s reading</p>
                  </div>
                </section>
              )}
              {analysis?.found_data && (
                <section>
                  <h3 className="text-sm font-semibold">Source</h3>
                  <a
                    href={analysis.data_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 flex items-center gap-2 rounded-xl border border-line p-3 text-sm hover:bg-bg"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{analysis.dataset_title || source}</span>
                      <span className="block text-xs text-muted">{[source, placeLabel(recount)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <ExternalLink className="size-4 shrink-0 text-faint" aria-hidden />
                  </a>
                  <p className="mt-2 text-sm text-muted">{analysis.method}</p>
                </section>
              )}
              {(challenge?.objections?.length ?? 0) > 0 && (
                <section>
                  <h3 className="text-sm font-semibold">Skeptic&apos;s notes</h3>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted">
                    {challenge?.objections.map((objection) => <li key={objection}>{objection}</li>)}
                  </ul>
                </section>
              )}
              {!readings.length && !analysis?.found_data && <p className="text-sm text-muted">No evidence was collected for this run.</p>}
            </>
          )}

          {tab === "Script" &&
            (analysis?.script ? (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Script</h3>
                    <CopyButton text={analysis.script} label="Copy" />
                  </div>
                  <pre className="max-h-[46vh] overflow-auto rounded-xl bg-ink p-4 font-mono text-xs leading-relaxed text-white/90">{analysis.script}</pre>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Sandbox output</h3>
                  <pre className="overflow-auto rounded-xl bg-bg p-3 font-mono text-xs">{analysis.stdout}</pre>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">No script ran for this claim.</p>
            ))}

          {tab === "Run" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Cost", usd(recount.costUsd)],
                  ["Time", `${(totalMs / 1000).toFixed(0)}s`],
                  ["Stages", String(stages.length)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-bg p-3">
                    <p className="text-xs text-muted">{label}</p>
                    <p className="num mt-0.5 text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>
              {stages.length ? (
                <ul className="space-y-3">
                  {stages.map((run, index) => {
                    const left = totalMs ? (elapsed / totalMs) * 100 : 0;
                    const width = totalMs ? (run.durationMs / totalMs) * 100 : 0;
                    elapsed += run.durationMs;
                    return (
                      <li key={`${run.stage}-${index}`}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="font-semibold">
                            {run.role}
                            {run.fallback && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">fallback</span>}
                          </span>
                          <span className="num text-xs text-muted">
                            {(run.durationMs / 1000).toFixed(1)}s · {usd(run.costUsd)}
                          </span>
                        </div>
                        <div className="relative mt-1 h-2 rounded-full bg-none-soft">
                          <div className="absolute h-full rounded-full bg-accent" style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }} />
                        </div>
                        <p className="mt-1 truncate font-mono text-[11px] text-muted">
                          {run.servedModel} · {run.tools.join(", ") || "no tools"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Otari refused this input, so no model ran.</p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
