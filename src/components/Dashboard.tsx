"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Database,
  LayoutDashboard,
  ListChecks,
  Loader2,
  type LucideIcon,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  Workflow,
} from "lucide-react";
import type { Recount, RecountEvent } from "@/lib/types";
import { Composer } from "./Composer";
import { Toast, type Notice } from "./RunProgress";
import { MiniRun } from "./RunProgress";
import { Report } from "./Report";
import { claimLabel, Logo, OUTCOMES, outcomeOf, usd } from "./ui";
import { Claims, Method, Overview, Pipeline, Sources, Spend, STAGES, type Config, type Live } from "./views";

type View = "Overview" | "Claims" | "Sources" | "Spend" | "Pipeline" | "Method";

const NAV: { group: string; items: { view: View; icon: LucideIcon }[] }[] = [
  {
    group: "Recounts",
    items: [
      { view: "Overview", icon: LayoutDashboard },
      { view: "Claims", icon: ListChecks },
      { view: "Sources", icon: Database },
    ],
  },
  {
    group: "Operations",
    items: [
      { view: "Spend", icon: Wallet },
      { view: "Pipeline", icon: Workflow },
      { view: "Method", icon: BookOpen },
    ],
  },
];

const ALL_VIEWS = NAV.flatMap((group) => group.items);

const CAPTIONS: Record<View, string> = {
  Overview: "Every number is read from sandbox output.",
  Claims: "Every recount, with the gap between claim and source.",
  Sources: "Where the recounted figures came from.",
  Spend: "What each recount cost through Otari.",
  Pipeline: "Four stages, three models, one sandbox.",
  Method: "How plain code picks a verdict.",
};

export function Dashboard() {
  const [recounts, setRecounts] = useState<Recount[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [runError, setRunError] = useState("");
  const [open, setOpen] = useState<Recount | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const composingRef = useRef(false);
  composingRef.current = composing;
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/recounts");
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      setRecounts(body.recounts);
      setConfig(body.config);
      const linked = window.location.hash.match(/^#report-(.+)$/)?.[1];
      const report = (body.recounts as Recount[]).find((recount) => recount.id === linked);
      if (report) setOpen(report);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      setCode(localStorage.getItem("recount-code") ?? "");
    } catch {}
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openReport = useCallback((recount: Recount | null) => {
    setOpen(recount);
    window.history.replaceState(null, "", recount ? `#report-${recount.id}` : window.location.pathname);
  }, []);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setLive((state) => state && { ...state, seconds: state.seconds + 1 }), 1000);
    return () => clearInterval(timer);
  }, [Boolean(live)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!live) return;
    const stage = STAGES.find((item) => item.name === live.active);
    document.title = live.ready ? "Verdict ready · Recount" : `${stage?.label ?? "Working"} ${live.seconds}s · Recount`;
    return () => {
      document.title = "Recount";
    };
  }, [live]);

  const run = async (text: string) => {
    setRunError("");
    setNotice(null);
    // Extract is marked as running straight away, so the dialog is never blank while the server wakes up.
    setLive({ input: text, active: "extract", done: [], model: "", seconds: 0, stageStart: 0, notes: { extract: "Connecting" }, ready: false });
    let reached: string = "Extract";
    try {
      localStorage.setItem("recount-code", code);
    } catch {}
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
      let finished = false;
      const lost = "The connection dropped before a verdict. Try again.";
      for (;;) {
        // The server sends a heartbeat every 15s, so 45s of silence means the run is gone.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const silence = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(lost)), 45_000);
        });
        const { value, done } = await Promise.race([reader.read(), silence]).finally(() => clearTimeout(timer));
        if (done) {
          if (!finished) throw new Error(lost);
          break;
        }
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as RecountEvent;
          if (event.type === "stage_start") {
            reached = STAGES.find((stage) => stage.name === event.stage)?.label ?? reached;
            setLive(
              (state) =>
                state && {
                  ...state,
                  active: event.stage,
                  model: event.model,
                  stageStart: state.seconds,
                  notes: { ...state.notes, [event.stage]: state.active === event.stage ? state.notes[event.stage] : STAGES.find((stage) => stage.name === event.stage)?.first },
                },
            );
          }
          if (event.type === "activity")
            setLive((state) => state && (state.active ? { ...state, notes: { ...state.notes, [state.active]: event.text } } : state));
          if (event.type === "stage_done")
            setLive((state) => state && { ...state, done: [...state.done, event.run] });
          if (event.type === "done") {
            finished = true;
            const { recount } = event;
            setRecounts((list) => [recount, ...(list ?? [])]);
            setInput("");
            setLive((state) => state && { ...state, active: null, ready: true });
            await new Promise((resolve) => setTimeout(resolve, 900));
            if (composingRef.current) {
              setComposing(false);
              openReport(recount);
            } else {
              setNotice({
                title: OUTCOMES[outcomeOf(recount)].label,
                text: claimLabel(recount),
                color: OUTCOMES[outcomeOf(recount)].color,
                onOpen: () => openReport(recount),
              });
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The run failed.";
      setRunError(`Stopped during ${reached}. ${message}`);
      setComposing(true);
    } finally {
      setLive(null);
    }
  };

  const list = useMemo(() => recounts ?? [], [recounts]);
  const liveStage = live && STAGES.find((stage) => stage.name === live.active);
  const budget = config?.budgetUsd ?? 0.25;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-card md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-3 md:py-4">
        <Link href="/" className="flex items-center gap-2.5 px-2.5 pb-5">
          <Logo className="size-8" />
          <span>
            <span className="block text-sm font-bold leading-tight">Recount</span>
            <span className="block text-[11px] text-muted">Statistics, re-run</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-5">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">{group}</p>
              {items.map(({ view: item, icon: Icon }) => (
                <button
                  key={item}
                  onClick={() => setView(item)}
                  aria-current={view === item ? "page" : undefined}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    view === item ? "bg-bg text-ink" : "text-muted hover:bg-bg hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {item}
                  {item === "Claims" && recounts && (
                    <span className="num ml-auto rounded-md bg-none-soft px-1.5 text-xs text-muted">{list.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rounded-xl bg-bg p-3">
          <p className="text-xs font-semibold">{usd(budget)} cap per recount</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">A run stops itself at the cap.</p>
        </div>
      </aside>

      <div className="min-w-0 pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight">{view}</h1>
            <p className="hidden truncate text-xs text-muted sm:block">{CAPTIONS[view]}</p>
          </div>
          <label className="hidden h-9 w-56 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm focus-within:border-accent lg:flex">
            <Search className="size-4 text-faint" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value) setView("Claims");
              }}
              placeholder="Search claims"
              aria-label="Search claims"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            />
            <kbd className="text-[11px] text-faint">⌘K</kbd>
          </label>
          {live && (
            <button
              onClick={() => setComposing(true)}
              className="flex h-9 items-center gap-2 rounded-lg bg-accent-soft px-3 text-sm font-semibold text-accent"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="hidden sm:inline">{live.ready ? "Done" : (liveStage?.label ?? "Working")}</span>
              <span className="num">{live.seconds}s</span>
            </button>
          )}
          <button
            onClick={() => setComposing(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            New recount
          </button>
        </header>

        <main className="px-4 py-5 sm:px-6">
          {loadError ? (
            <div className="card mx-auto max-w-md p-8 text-center">
              <p className="font-semibold">Could not load recounts</p>
              <p className="mt-1 text-sm text-muted">The server did not answer.</p>
              <button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-bg">
                <RefreshCw className="size-4" aria-hidden />
                Try again
              </button>
            </div>
          ) : !recounts ? (
            <div className="grid gap-4 lg:grid-cols-3" aria-label="Loading">
              <div className="shimmer h-24 lg:col-span-3" />
              <div className="shimmer h-72 lg:col-span-2" />
              <div className="shimmer h-72" />
            </div>
          ) : (
            <div key={view} className="rise">
              {view === "Overview" && <Overview recounts={list} onOpen={openReport} onViewAll={() => setView("Claims")} onNew={() => setComposing(true)} />}
              {view === "Claims" && <Claims recounts={list} query={query} onQuery={setQuery} onOpen={openReport} onNew={() => setComposing(true)} />}
              {view === "Sources" && <Sources recounts={list} onOpen={openReport} />}
              {view === "Spend" && <Spend recounts={list} budget={budget} onOpen={openReport} />}
              {view === "Pipeline" && <Pipeline recounts={list} config={config} />}
              {view === "Method" && <Method />}
            </div>
          )}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-line bg-card md:hidden" aria-label="Sections">
        {ALL_VIEWS.map(({ view: item, icon: Icon }) => (
          <button
            key={item}
            onClick={() => setView(item)}
            aria-current={view === item ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${view === item ? "text-accent" : "text-muted"}`}
          >
            <Icon className="size-5" aria-hidden />
            {item}
          </button>
        ))}
      </nav>

      {live && !composing && <MiniRun live={live} onOpen={() => setComposing(true)} />}
      {notice && <Toast notice={notice} onClose={() => setNotice(null)} />}
      {composing && (
        <Composer
          config={config}
          input={input}
          code={code}
          live={live}
          error={runError}
          onInput={setInput}
          onCode={setCode}
          onRun={run}
          onClose={() => setComposing(false)}
        />
      )}
      {open && <Report recount={open} onClose={() => openReport(null)} />}
    </div>
  );
}
