"use client";

import { useEffect } from "react";
import { Check, ChevronUp, X } from "lucide-react";
import { usd } from "./ui";
import { STAGES, type Live } from "./views";

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Bar length follows how long each stage usually takes. It eases toward the next stage and never reaches it early.
function percentOf(live: Live) {
  if (live.ready) return 100;
  const total = STAGES.reduce((sum, stage) => sum + stage.typical, 0);
  const finished = (name: string) => name !== live.active && live.done.some((run) => run.stage === name);
  const earned = STAGES.filter((stage) => finished(stage.name)).reduce((sum, stage) => sum + stage.typical, 0);
  const current = STAGES.find((stage) => stage.name === live.active);
  const inside = current ? current.typical * 0.95 * (1 - Math.exp(-(live.seconds - live.stageStart) / current.typical)) : 0;
  return Math.max(Math.round(((earned + inside) / total) * 100), 2);
}

function Bar({ percent, ready }: { percent: number; ready: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Recount progress"
      className="h-2 overflow-hidden rounded-full bg-none-soft"
    >
      <div
        className={`relative h-full overflow-hidden rounded-full transition-[width] duration-1000 ease-out ${ready ? "bg-good" : "bg-accent"}`}
        style={{ width: `${percent}%` }}
      >
        {!ready && <span className="bar-sheen absolute inset-0" />}
      </div>
    </div>
  );
}

export function RunProgress({ live }: { live: Live }) {
  const percent = percentOf(live);
  const index = STAGES.findIndex((stage) => stage.name === live.active);
  const current = STAGES[index];
  const inStage = live.seconds - live.stageStart;
  const slow = current && inStage > current.typical * 2 + 5;

  return (
    <div className="mt-1">
      <p className="truncate text-[13px] text-muted">{live.input}</p>

      <div className="mt-4 flex items-baseline justify-between text-[13px]">
        <span className="font-semibold">
          {live.ready ? "All four steps finished" : `Step ${index + 1} of ${STAGES.length}: ${current?.label}`}
        </span>
        <span className="num text-muted">
          {percent}% · {clock(live.seconds)}
        </span>
      </div>
      <div className="mt-1.5">
        <Bar percent={percent} ready={live.ready} />
      </div>

      <ol className="mt-4">
        {STAGES.map(({ name, label, job }, position) => {
          const active = live.active === name;
          const run = live.done.findLast((item) => item.stage === name);
          const finished = Boolean(run) && !active;
          const last = position === STAGES.length - 1;
          return (
            <li key={name} className="relative flex gap-3 pb-3 last:pb-0">
              {!last && <span aria-hidden className={`absolute bottom-0 left-[13px] top-7 w-0.5 transition-colors duration-500 ${finished ? "bg-good" : "bg-line"}`} />}
              <span
                className={`relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                  finished ? "tick-in bg-good text-white" : active ? "halo bg-accent text-white" : "bg-none-soft text-faint"
                }`}
              >
                {finished ? <Check className="size-4" aria-hidden /> : position + 1}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span className={`text-sm font-semibold ${active || finished ? "" : "text-muted"}`}>{label}</span>
                  {finished && run && (
                    <span className="num shrink-0 text-xs text-muted">
                      {(run.durationMs / 1000).toFixed(0)}s · {usd(run.costUsd)}
                    </span>
                  )}
                  {active && <span className="num shrink-0 text-xs font-semibold text-accent">{inStage}s</span>}
                </span>
                {active ? (
                  <span key={live.notes[name]} className="note dots block truncate text-[13px] text-accent">
                    {live.notes[name] ?? job}
                  </span>
                ) : (
                  <span className="block truncate text-[13px] text-muted">{finished ? (live.notes[name] ?? job) : job}</span>
                )}
                {active && live.model && <span className="block truncate font-mono text-[11px] text-faint">{live.model}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className={`mt-3 rounded-lg px-3 py-2 text-xs ${live.ready ? "bg-good-soft text-good" : slow ? "bg-warn-soft text-warn" : "bg-bg text-muted"}`}>
        {live.ready
          ? "Opening your report."
          : slow
            ? `${current.label} is taking longer than usual. It is still working.`
            : "Usually about a minute. You can close this and keep browsing; the run carries on."}
      </p>
    </div>
  );
}

export function MiniRun({ live, onOpen }: { live: Live; onOpen: () => void }) {
  const current = STAGES.find((stage) => stage.name === live.active);
  const percent = percentOf(live);
  return (
    <button
      onClick={onOpen}
      className="rise fixed bottom-20 right-4 z-20 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-3 text-left shadow-xl md:bottom-4"
    >
      <span className="flex items-center justify-between gap-2 text-[13px] font-semibold">
        <span className="truncate">{live.ready ? "Verdict ready" : `Recounting: ${current?.label ?? "working"}`}</span>
        <ChevronUp className="size-4 shrink-0 text-faint" aria-hidden />
      </span>
      <span key={current ? live.notes[current.name] : ""} className="note mb-2 block truncate text-xs text-muted">
        {current ? live.notes[current.name] : "Finished"}
      </span>
      <Bar percent={percent} ready={live.ready} />
    </button>
  );
}

export type Notice = { title: string; text: string; color: string; onOpen: () => void };

export function Toast({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  // Stays until dismissed, and flags the tab, because the reader may be elsewhere when the run ends.
  useEffect(() => {
    document.title = `Verdict ready: ${notice.title} · Recount`;
    return () => {
      document.title = "Recount";
    };
  }, [notice]);
  return (
    <div role="status" className="rise fixed bottom-20 right-4 z-20 w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-3 shadow-xl md:bottom-4">
      <div className="flex items-start gap-2">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: notice.color }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Verdict ready: {notice.title}</p>
          <p className="truncate text-xs text-muted">{notice.text}</p>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="rounded p-0.5 text-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <button
        onClick={() => {
          notice.onOpen();
          onClose();
        }}
        className="mt-2 w-full rounded-lg bg-accent py-1.5 text-sm font-semibold text-white"
      >
        Open report
      </button>
    </div>
  );
}
