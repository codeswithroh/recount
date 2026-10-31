import Link from "next/link";
import seed from "@/data/seed.json";
import { shortNumber, usd, VerdictChip } from "@/components/ui";
import type { Recount } from "@/lib/types";

const STEPS = [
  ["Extract", "Pulls the number, unit, place and period out of your text.", "deepseek-v4-flash"],
  ["Recompute", "Finds the official series and writes a script that downloads it.", "deepseek-v4-pro"],
  ["Replay", "Runs that exact script again in a fresh sandbox.", "deepseek-v4-flash"],
  ["Challenge", "Tries other readings: another base year, another series.", "gpt-oss-120b"],
];

const VERDICT_RULES = [
  ["reproduced", "Within 2% of the claim, and it measures the same thing."],
  ["misleading", "Only matches under a different definition or base year."],
  ["wrong", "The source data gives another number."],
  ["unverifiable", "No primary data, or the script did not replay the same."],
] as const;

export default function Landing() {
  const example = (seed as Recount[]).find((recount) => recount.verdict === "wrong") ?? (seed as Recount[])[0];
  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6">
      <nav className="flex items-center justify-between py-5">
        <span className="text-lg font-bold tracking-tight">Recount</span>
        <Link href="/app" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          Open dashboard
        </Link>
      </nav>

      <section className="grid items-center gap-10 py-14 md:grid-cols-[1.15fr_1fr] md:py-20">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            Check the number before you repeat it.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted">
            Paste a statistic from an article or report. Recount downloads the source data, recalculates the figure in a
            sandbox, and hands you the script.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            Recount a claim
          </Link>
          <p className="mt-3 text-sm text-muted">About 5 cents a claim on open-weight models.</p>
        </div>

        {example && (
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted">A real recount</span>
              <VerdictChip verdict={example.verdict} />
            </div>
            <p className="mt-3 font-medium">{example.claim?.statement}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-bg p-4">
                <div className="text-xs text-muted">Claimed</div>
                <div className="font-mono text-3xl font-bold">{shortNumber(example.claim?.claimed_value)}</div>
              </div>
              <div className="rounded-xl bg-accent-soft p-4">
                <div className="text-xs text-muted">Recounted</div>
                <div className="font-mono text-3xl font-bold text-accent">{shortNumber(example.analysis?.value)}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted">
              {example.analysis?.dataset_title} · {usd(example.costUsd)}
            </p>
          </div>
        )}
      </section>

      <section className="py-10">
        <h2 className="text-2xl font-bold tracking-tight">Four steps, three models</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([name, text, model], index) => (
            <div key={name} className="card p-5">
              <div className="font-mono text-sm text-accent">0{index + 1}</div>
              <h3 className="mt-2 font-semibold">{name}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
              <p className="mt-3 font-mono text-xs text-muted">{model}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 py-10 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">No model gets to report the result</h2>
          <p className="mt-3 text-muted">
            In testing, a model wrote a correct script and then reported 2.51 when its output said 2.53. So Recount reads
            numbers from raw sandbox stdout, and plain code picks the verdict. A script with data typed into it is
            rejected.
          </p>
        </div>
        <div className="card divide-y divide-line">
          {VERDICT_RULES.map(([verdict, rule]) => (
            <div key={verdict} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-32 shrink-0">
                <VerdictChip verdict={verdict} />
              </div>
              <p className="text-sm text-muted">{rule}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-line py-6 text-sm text-muted">
        <span>Built on Otari by Mozilla.ai with open-weight models.</span>
        <Link href="/app" className="font-semibold text-ink">
          Open dashboard
        </Link>
      </footer>
    </main>
  );
}
