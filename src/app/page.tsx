import Link from "next/link";
import { ArrowRight, Check, Database, FlaskConical, Repeat, ShieldAlert, Swords } from "lucide-react";
import seed from "@/data/seed.json";
import { claimLabel, gapLabel, gapOf, OutcomeChip, outcomeOf, usd, VERDICT_ORDER, withUnit } from "@/components/ui";
import type { Recount, StageName } from "@/lib/types";

const recounts = seed as Recount[];
const STAGE_NAMES: [StageName, string][] = [
  ["extract", "Extract"],
  ["recompute", "Recompute"],
  ["replay", "Replay"],
  ["challenge", "Challenge"],
];

const stageSeconds = STAGE_NAMES.map(([name, label]) => {
  const runs = recounts.flatMap((recount) => recount.stages).filter((run) => run.stage === name);
  return { label, seconds: runs.reduce((sum, run) => sum + run.durationMs, 0) / Math.max(runs.length, 1) / 1000 };
});
const totalSeconds = stageSeconds.reduce((sum, stage) => sum + stage.seconds, 0);

const paid = recounts.filter((recount) => recount.stages.length);
const avgCost = paid.reduce((sum, recount) => sum + recount.costUsd, 0) / paid.length;
const decided = recounts.filter((recount) => recount.verdict);
const held = decided.filter((recount) => recount.verdict === "reproduced").length;
const heldShare = held / decided.length;
const miss = recounts.find((recount) => recount.verdict === "wrong")!;

// A band whose thickness follows how long each stage takes, tapering to a point at both ends.
function bandPath(scale: number) {
  const width = 400;
  const middle = 110;
  const top = Math.max(...stageSeconds.map((stage) => stage.seconds));
  const points = [
    [0, 2],
    ...stageSeconds.map((stage, index) => [50 + index * 100, 14 + Math.sqrt(stage.seconds / top) * 66]),
    [width, 2],
  ].map(([x, half]) => [x, half * scale]);
  const edge = (sign: number, list: number[][]) =>
    list
      .slice(1)
      .map(([x, half], index) => {
        const [lastX, lastHalf] = list[index];
        const bend = (x - lastX) / 2;
        return `C${lastX + Math.sign(x - lastX) * Math.abs(bend)} ${middle + sign * lastHalf} ${x - Math.sign(x - lastX) * Math.abs(bend)} ${middle + sign * half} ${x} ${middle + sign * half}`;
      })
      .join(" ");
  return `M0 ${middle - points[0][1]} ${edge(-1, points)} L${width} ${middle + points.at(-1)![1]} ${edge(1, [...points].reverse())} Z`;
}

function Gauge({ share }: { share: number }) {
  const ticks = 41;
  return (
    <svg viewBox="0 0 220 118" className="w-full" role="img" aria-label={`${Math.round(share * 100)}% held up`}>
      {Array.from({ length: ticks }, (_, index) => {
        const progress = index / (ticks - 1);
        const angle = Math.PI * (1 - progress);
        const on = progress <= share;
        const outer = index % 5 === 0 ? 104 : 98;
        return (
          <line
            key={index}
            x1={110 + 76 * Math.cos(angle)}
            y1={110 - 76 * Math.sin(angle)}
            x2={110 + outer * Math.cos(angle)}
            y2={110 - outer * Math.sin(angle)}
            stroke={on ? "#3b6ff5" : "#d3d9e2"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function Checker({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden fill="currentColor">
      {[[40, 0], [80, 0], [0, 40], [40, 40], [80, 80], [40, 80], [0, 80]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="40" height="40" opacity={(x + y) % 80 ? 0.55 : 1} />
      ))}
    </svg>
  );
}

const PRIMARY = "rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5";
const SECONDARY = "rounded-full border border-ink/80 bg-white/50 px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5";

export default function Landing() {
  const listed = recounts.filter((recount) => recount.claim).slice(0, 3);
  const unit = miss.claim?.unit;
  return (
    <main className="overflow-hidden bg-white">
      <div className="relative bg-[#eff4f8]">
        <div aria-hidden className="absolute -left-64 top-72 size-[760px] rounded-full bg-[#e6eef3]" />
        <div aria-hidden className="absolute -right-64 top-72 size-[760px] rounded-full bg-[#e6eef3]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <nav className="grid grid-cols-[1fr_auto] items-center py-5 sm:grid-cols-3">
            <div className="hidden gap-1 text-sm font-medium sm:flex">
              <a href="#how" className="rounded-full border border-ink/70 px-4 py-2">How it works</a>
              <a href="#proof" className="rounded-full px-4 py-2 hover:bg-white/60">Proof</a>
            </div>
            <span className="display flex items-center gap-2 text-xl font-bold sm:justify-center">
              <span className="grid size-7 place-items-center rounded-lg bg-ink text-xs text-white">R</span>
              Recount
            </span>
            <Link href="/app" className="flex items-center justify-self-end rounded-full border border-ink/70 bg-white/50 py-1 pl-4 pr-1 text-sm font-semibold">
              Open app
              <span className="ml-2 grid size-8 place-items-center rounded-full bg-ink text-white">
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </nav>

          <section className="pt-10 text-center sm:pt-14">
            <h1 className="display mx-auto max-w-4xl text-[38px] font-bold leading-[1.12] sm:text-6xl">
              Check the{" "}
              <span className="inline-flex translate-y-1 items-center rounded-full border border-ink/70 bg-white px-3 py-1 align-middle text-[0.62em] sm:translate-y-0">
                <span className="num">$1,847</span>
              </span>{" "}
              number before you repeat it
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
              Paste a statistic. Recount downloads the source data, recalculates it in a sandbox and hands you the script.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/app" className={PRIMARY}>Recount a claim</Link>
              <a href="#proof" className={SECONDARY}>See real reports</a>
            </div>
          </section>

          <section className="mt-14 grid gap-5 md:grid-cols-[1fr_1.3fr_1fr]" aria-label="Figures from real recounts">
            <div className="grid gap-5">
              <div className="overflow-hidden rounded-3xl border border-[#d5dce4] bg-white/80">
                <div className="flex items-center justify-between px-5 pt-4">
                  <span className="font-medium">Claimed</span>
                  <span className="num font-bold">{withUnit(miss.claim?.claimed_value, unit)}</span>
                </div>
                <div className="flex items-center justify-between px-5 pb-4 pt-1">
                  <span className="font-medium">Source</span>
                  <span className="num font-bold">{withUnit(miss.analysis?.value, unit)}</span>
                </div>
                <div className="flex items-end justify-between bg-[#ece8fb] px-5 py-3">
                  <span className="text-sm text-[#5b4bc4]">Nigeria, 1960</span>
                  <span className="num rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#5b4bc4]">{gapLabel(gapOf(miss)!.ratio)}</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-[#d5dce4] bg-white/70 p-5 text-center">
                <p className="font-semibold">Official sources</p>
                <div aria-hidden className="absolute -bottom-32 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[#eaf0f5]" />
                <div className="relative mt-5 flex flex-wrap justify-center gap-2 pb-2">
                  {["World Bank", "Eurostat", "Web, if needed"].map((source, index) => (
                    <span key={source} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${["bg-ink text-white", "bg-[#3b6ff5] text-white", "bg-[#ffd84d]"][index]}`}>
                      {source}
                    </span>
                  ))}
                </div>
                <Link href="/app" className="relative mt-3 inline-block rounded-full bg-[#3c5364] px-4 py-2 text-sm font-semibold text-white">
                  Try one
                </Link>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-3xl border border-[#d5dce4] bg-white/80">
              <div className="px-6 pt-5">
                <p className="text-sm font-semibold">One recount</p>
                <p className="num mt-0.5 flex items-center gap-2 text-3xl font-bold">
                  {Math.round(totalSeconds)}s
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{usd(avgCost)}</span>
                </p>
                <p className="text-sm text-muted">Average across {paid.length} real runs</p>
              </div>
              <div className="relative mt-3 flex-1">
                <svg viewBox="0 0 400 220" preserveAspectRatio="none" className="h-full min-h-56 w-full" aria-hidden>
                  <defs>
                    <filter id="glow" x="-20%" y="-100%" width="140%" height="300%">
                      <feGaussianBlur stdDeviation="16" />
                    </filter>
                  </defs>
                  <path d={bandPath(1.08)} fill="#7ea6ff" opacity="0.5" filter="url(#glow)" />
                  <path d={bandPath(1)} fill="#8db2fb" />
                  <path d={bandPath(0.72)} fill="#6495f7" />
                  <path d={bandPath(0.42)} fill="#3b7bf5" />
                  {[100, 200, 300].map((x) => (
                    <line key={x} x1={x} x2={x} y1="0" y2="220" stroke="white" strokeWidth="1.5" />
                  ))}
                </svg>
                <div className="absolute inset-0 grid grid-cols-4 items-center text-center">
                  {stageSeconds.map((stage) => (
                    <span key={stage.label} className="justify-self-center rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold shadow-sm">
                      <span className="num">{stage.seconds.toFixed(0)}s</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 px-1 pb-4 pt-2 text-center text-xs font-medium sm:text-[13px]">
                {stageSeconds.map((stage) => <span key={stage.label}>{stage.label}</span>)}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-3xl border border-[#d5dce4] bg-white/80 px-5 pt-4">
                <span className="rounded-full bg-[#e8f0fb] px-3 py-1 text-sm font-medium">Held up</span>
                <div className="relative mt-2">
                  <Gauge share={heldShare} />
                  <p className="display absolute inset-x-0 bottom-1 text-center text-3xl font-bold">{Math.round(heldShare * 100)}%</p>
                </div>
                <p className="pb-4 text-center text-xs text-muted">{held} of {decided.length} claims</p>
              </div>
              <div className="flex flex-col overflow-hidden rounded-3xl border border-[#d5dce4] bg-[#fff8ec]">
                <p className="num pt-5 text-center text-2xl font-bold">
                  {usd(avgCost)} <span className="ml-1 rounded-full bg-[#fde4d5] px-2 py-0.5 text-xs font-semibold text-[#d9601f]">per claim</span>
                </p>
                <p className="mt-1 text-center text-sm">Cost of each real run</p>
                <div className="mt-4 flex h-24 flex-1 items-end gap-1 px-4">
                  {paid.map((recount) => (
                    <span key={recount.id} className="flex-1 rounded-t bg-[#f6a77a]" style={{ height: `${(recount.costUsd / Math.max(...paid.map((run) => run.costUsd))) * 100}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <section id="how" className="scroll-mt-6 py-20">
          <h2 className="display mx-auto max-w-2xl text-center text-3xl font-bold uppercase leading-tight sm:text-[42px]">
            Three models <span className="text-[#5a3fd6]">check each other</span> on every claim
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-muted">Each one has one job, and none of them sees the whole picture.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="relative min-h-72 overflow-hidden rounded-3xl bg-gradient-to-b from-[#c9b8ec] to-[#dccdf5] p-6">
              <div aria-hidden className="absolute -right-10 -top-10 size-44 rounded-full border-[14px] border-[#5a3fd6] p-4">
                <div className="size-full rounded-full border-[10px] border-[#5a3fd6]" />
              </div>
              <span className="grid size-11 place-items-center rounded-full bg-white/70"><Database className="size-5" aria-hidden /></span>
              <h3 className="display mt-20 text-lg font-semibold leading-tight">Blind<br />analyst</h3>
              <p className="mt-2 text-sm text-ink/70">Gets the metric, place and period, never the claimed number.</p>
            </article>
            <article className="relative min-h-72 overflow-hidden rounded-3xl bg-gradient-to-b from-[#5a3fd6] to-[#4b32c4] p-6 text-white">
              <div aria-hidden className="absolute -top-14 right-8 h-40 w-32 rounded-b-full border-[26px] border-t-0 border-[#c9b8ec]" />
              <span className="grid size-11 place-items-center rounded-full bg-white/20"><Repeat className="size-5" aria-hidden /></span>
              <h3 className="display mt-20 text-lg font-semibold leading-tight">Fresh<br />sandbox</h3>
              <p className="mt-2 text-sm text-white/75">The same script runs again from nothing. A different result means no verdict.</p>
            </article>
            <article className="relative min-h-72 overflow-hidden rounded-3xl bg-gradient-to-b from-[#f9bd35] to-[#fbc64d] p-6">
              <Checker className="absolute -right-2 -top-2 size-36 text-[#f0ab1e]" />
              <span className="relative grid size-11 place-items-center rounded-full bg-white/70"><Swords className="size-5" aria-hidden /></span>
              <h3 className="display mt-20 text-lg font-semibold leading-tight">Hired<br />skeptic</h3>
              <p className="mt-2 text-sm text-ink/70">Computes rival readings: another series, another base year.</p>
            </article>
          </div>
        </section>

        <section id="proof" className="scroll-mt-6 pb-20">
          <h2 className="display mx-auto max-w-2xl text-center text-3xl font-bold uppercase leading-tight sm:text-[42px]">
            No model gets to <span className="text-[#e8724a]">report the result</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-muted">Numbers come from raw sandbox output. Plain code picks the verdict.</p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="relative flex flex-col overflow-hidden rounded-3xl bg-[#e8724a] p-6 pb-0 text-white">
              <div aria-hidden className="absolute -top-6 right-6 h-28 w-16 rounded-b-3xl bg-[#f6ab90]" />
              <div aria-hidden className="absolute -top-6 right-24 h-28 w-16 rounded-b-3xl bg-[#f6ab90]/70" />
              <h3 className="display text-lg font-semibold leading-tight">Caught in<br />testing</h3>
              <p className="mt-2 max-w-64 text-sm text-white/85">A model wrote a correct script, then misreported what it printed.</p>
              <div className="mx-auto mt-auto grid w-full max-w-sm translate-y-px grid-cols-2 divide-x divide-line rounded-t-2xl bg-white p-5 text-ink">
                <div className="pr-4">
                  <span className="grid size-10 place-items-center rounded-full bg-bad-soft"><ShieldAlert className="size-5 text-bad" aria-hidden /></span>
                  <p className="num mt-3 text-2xl font-bold">2.51</p>
                  <p className="text-sm text-muted">Model said</p>
                </div>
                <div className="pl-4">
                  <span className="grid size-10 place-items-center rounded-full bg-good-soft"><FlaskConical className="size-5 text-good" aria-hidden /></span>
                  <p className="num mt-3 text-2xl font-bold">2.53</p>
                  <p className="text-sm text-muted">Sandbox printed</p>
                </div>
              </div>
            </article>

            <article className="relative flex flex-col overflow-hidden rounded-3xl bg-[#fbc64d] p-6 pb-0">
              <Checker className="absolute -right-4 -top-4 size-32 text-[#f4b530]" />
              <h3 className="display relative text-lg font-semibold leading-tight">Four verdicts,<br />fixed rules</h3>
              <p className="relative mt-2 max-w-64 text-sm text-ink/70">Within 2% of the source, or 5% if the claim says about.</p>
              <div className="relative mx-auto mt-8 grid w-full max-w-sm grid-cols-2 gap-2 rounded-t-2xl bg-white p-4">
                {VERDICT_ORDER.map((verdict) => (
                  <div key={verdict} className="rounded-xl border border-line p-3">
                    <OutcomeChip outcome={verdict} />
                    <p className="num mt-2 text-2xl font-bold">{recounts.filter((recount) => recount.verdict === verdict).length}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="relative mt-4 grid items-center gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#6c97f2] to-[#4b78e6] py-8 md:grid-cols-[1.25fr_1fr]">
            <Checker className="absolute -bottom-6 left-4 size-36 text-white/10" />
            <ul className="relative space-y-[-6px] pr-4 md:-ml-4">
              {listed.map((recount, index) => (
                <li
                  key={recount.id}
                  className={`flex items-center gap-3 rounded-r-xl bg-white p-3.5 pl-6 ${index === 1 ? "relative z-[1] mr-[-16px] shadow-xl" : "mr-3 bg-white/90"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{claimLabel(recount)}</span>
                    <span className="num block text-xs text-muted">
                      {withUnit(recount.claim?.claimed_value, recount.claim?.unit)} → {withUnit(recount.analysis?.value, recount.claim?.unit)}
                    </span>
                  </span>
                  <OutcomeChip outcome={outcomeOf(recount)} />
                </li>
              ))}
            </ul>
            <div className="relative px-6 text-white md:pl-4">
              <h3 className="display text-2xl font-semibold leading-tight">Every report comes<br />with its script</h3>
              <p className="mt-2 text-sm text-white/85">Open any verdict, copy the Python and run it yourself.</p>
              <ul className="mt-3 space-y-1 text-sm">
                {["Source link", "Sandbox output", "Other readings"].map((item) => (
                  <li key={item} className="flex items-center gap-2"><Check className="size-4" aria-hidden />{item}</li>
                ))}
              </ul>
              <Link href="/app" className="mt-5 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink">Open the reports</Link>
            </div>
          </article>
        </section>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>Built on Otari by Mozilla.ai with open-weight models.</span>
          <Link href="/app" className="font-semibold text-ink">Open app</Link>
        </div>
      </footer>
    </main>
  );
}
