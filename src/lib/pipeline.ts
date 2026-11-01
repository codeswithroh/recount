import { randomUUID } from "crypto";
import { chat, OtariError, parseJson, respond, type ChatResult, type CodeRun } from "./otari";
import type { Analysis, Challenge, Claim, Recount, RecountEvent, StageName, StageRun } from "./types";
import { decideVerdict } from "./verdict";

export const models = () => ({
  extractor: process.env.RECOUNT_MODEL_EXTRACTOR || "deepseek/deepseek-v4-flash",
  analyst: process.env.RECOUNT_MODEL_ANALYST || "deepseek/deepseek-v4-pro",
  skeptic: process.env.RECOUNT_MODEL_SKEPTIC || "openai/gpt-oss-120b",
});

const budgetUsd = () => Number(process.env.RECOUNT_BUDGET_USD || 0.25);
const webEnabled = () => process.env.OTARI_WEB_TOOLS === "1";

const dataServers = () =>
  process.env.OTARI_MCP_URL
    ? [
        {
          name: "recount-data",
          url: process.env.OTARI_MCP_URL,
          purpose_hint: "Official statistics from the World Bank and Eurostat. Try this first.",
        },
      ]
    : [];

const guardrails = () =>
  process.env.OTARI_GUARDRAIL_URL
    ? [{ profile: "prompt-injection", mode: "block", url: process.env.OTARI_GUARDRAIL_URL }]
    : [];

const EXTRACT_PROMPT = `You pull the single checkable statistic out of a piece of text.
If the input is a URL, fetch it and pick its most prominent statistic.
Answer with JSON only:
{"statement": "the claim in one sentence", "claimed_value": number or null, "approximate": true if hedged with about, roughly, nearly or similar, "unit": "%, percentage points, million people, USD...", "metric": "what is measured, with no figures", "geography": "", "period": "", "source_hint": "who the text credits for the number, or empty"}
Keep the number as stated: for "1.4 billion" use 1.4 with unit "billion". For "$10,700" use 10700 with unit "USD".`;

const RECOMPUTE_PROMPT = `You measure a statistic from its primary source.
1. Find the official dataset. Use the data tools first. Use web search only if they have no matching series, and prefer published actuals over projections. If the claim doesn't state a basis, use the headline series (GDP per capita means current US$, not PPP). 
2. Write one self-contained Python script that downloads the data itself from a public URL (the data tools return a source_url you can use), computes the figure in the claim's unit and scale, and prints a last line of exactly: RESULT <number>, unrounded
3. Run it with code execution, printing the unrounded value. Keep it short: three script runs at most, and stop as soon as RESULT prints. A script with data values typed into it is rejected. Never guess.
Answer with JSON only:
{"found_data": boolean, "dataset_title": "", "data_url": "", "method": "one sentence about your last script", "unit": "", "notes": "caveats, one sentence"}
If no primary data exists, set found_data to false.`;

const REPLAY_PROMPT = `Run the user's Python script once with code execution, copied character for character. Do not change, shorten or reformat it. Then answer with the word done.`;

const CHALLENGE_PROMPT = `You are checking another analyst's recalculation. Assume it may be wrong. Judge the numbers only: who made the claim doesn't matter, and objections contain no figures.
1. Decide if the script measures what the claim says. Set definition_match to false only if the claim's own wording points to a different population, geography, period or basis than the script used. Ordinary loose wording, such as income for GDP per capita, is true. Put caveats in objections.
2. Always run one Python script that computes two or three other reasonable readings from the same source (constant dollars instead of current, another base year, another series), in the claim's unit, printing one line each: ALT <short label> = <number>
Answer with JSON only:
{"definition_match": boolean, "objections": ["short sentences"]}`;

// Numbers come from sandbox stdout only. A figure a model typed into its answer is never used.
const resultFrom = (run: CodeRun | undefined) => {
  const match = run?.logs.match(/^RESULT\s+(-?[\d.]+(?:e[+-]?\d+)?)\s*$/im);
  return match ? Number(match[1]) : null;
};

const alternativesFrom = (runs: CodeRun[]) =>
  [...runs.map((run) => run.logs).join("\n").matchAll(/^ALT\s+(.+?)\s*=\s*(-?[\d.]+(?:e[+-]?\d+)?)\s*$/gim)].map(
    ([, label, value]) => ({ label, value: Number(value) }),
  );

// A dropped stream can lose the closing JSON while the sandbox output survives.
const reportFrom = (text: string, run: CodeRun | undefined, claim: Claim): Omit<Analysis, "script" | "value" | "stdout"> => {
  try {
    return parseJson(text);
  } catch {
    if (!run) throw new Error("model did not return JSON");
    const data_url = run.code.match(/https?:\/\/[^\s"']+/)?.[0] ?? "";
    return {
      found_data: true,
      dataset_title: new URL(data_url).hostname,
      data_url,
      method: "Read from the script below.",
      unit: claim.unit,
      notes: "",
    };
  }
};

const reviewFrom = (text: string): Pick<Challenge, "definition_match" | "objections"> => {
  try {
    return parseJson(text);
  } catch {
    return { objections: [] };
  }
};

class OverBudget extends Error {}
class OverTime extends Error {}

// Vercel ends a function at 300s, so a run stops itself first and still returns a report.
const RUN_LIMIT_MS = 270_000;

export async function runRecount(input: string, emit: (event: RecountEvent) => void): Promise<Recount> {
  const recount: Recount = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    input,
    status: "done",
    verdict: null,
    reason: "",
    claim: null,
    analysis: null,
    challenge: null,
    stages: [],
    costUsd: 0,
    budgetUsd: budgetUsd(),
  };

  const deadline = Date.now() + RUN_LIMIT_MS;
  const timeLeft = () => deadline - Date.now();

  const stage = async <T extends ChatResult>(
    name: StageName,
    role: string,
    model: string,
    tools: string[],
    call: () => Promise<T>,
  ): Promise<T> => {
    if (recount.costUsd >= recount.budgetUsd) throw new OverBudget();
    if (timeLeft() < 15_000) throw new OverTime();
    emit({ type: "stage_start", stage: name, role, model });
    const result = await call();
    const run: StageRun = {
      stage: name,
      role,
      requestedModel: model,
      servedModel: result.servedModel,
      provider: result.provider,
      attempts: result.attempts,
      fallback: result.fallback,
      costUsd: result.costUsd,
      durationMs: result.durationMs,
      tools,
    };
    recount.stages.push(run);
    recount.costUsd += result.costUsd;
    emit({ type: "stage_done", run });
    return result;
  };

  const say = (text: string) => emit({ type: "activity", text });
  const { extractor, analyst, skeptic } = models();
  const web = webEnabled();
  const servers = dataServers();

  try {
    const isUrl = /^https?:\/\//i.test(input.trim());
    const extracted = await stage("extract", "Extractor", extractor, [...(isUrl ? ["web fetch"] : []), ...(guardrails().length ? ["guardrail"] : [])], () =>
      chat({
        model: extractor,
        system: EXTRACT_PROMPT,
        user: input,
        maxTokens: 800,
        deadline,
        onActivity: say,
        tools: isUrl ? [{ type: "otari_web_fetch" }] : [],
        guardrails: guardrails(),
      }),
    );
    recount.claim = parseJson<Claim>(extracted.content);
    say(`Checking ${[recount.claim.metric, recount.claim.geography, recount.claim.period].filter(Boolean).join(", ")}`);

    // The analyst never sees the claimed number, so it can't shop for a series that agrees.
    const { metric, unit, geography, period } = recount.claim;
    const blind = { metric, unit, geography, period };
    const recompute = (extra: string) =>
      stage(
        "recompute",
        "Analyst",
        analyst,
        ["code execution", ...(servers.length ? ["MCP"] : []), ...(web ? ["web search"] : [])],
        () =>
          respond({
            model: analyst,
            system: RECOMPUTE_PROMPT,
            user: `Measure: ${JSON.stringify(blind)}${extra}`,
            maxTokens: 4000,
            deadline,
            onActivity: say,
            mcpServers: servers,
            tools: web
              ? [
                  { type: "otari_web_search", max_uses: 3 },
                  { type: "otari_web_fetch" },
                ]
              : [],
          }),
      );
    const usable = (run: CodeRun) => resultFrom(run) !== null && /https?:\/\//.test(run.code);
    let worked = await recompute("");
    if (!worked.codeRuns.some(usable)) {
      say("That script did not download its data. Asking again");
      worked = await recompute("\nYour last script did not download its data from a URL. Do that this time.");
    }
    const lastRun = [...worked.codeRuns].reverse().find(usable);
    const report = reportFrom(worked.content, lastRun, recount.claim);
    recount.analysis = {
      ...report,
      found_data: report.found_data && Boolean(lastRun),
      script: lastRun?.code ?? "",
      value: resultFrom(lastRun),
      stdout: lastRun?.logs ?? "",
    };

    say(recount.analysis.value === null ? "No usable source figure found" : `Source figure: ${Number(recount.analysis.value.toPrecision(6))}`);

    if (recount.analysis.found_data) {
      const script = recount.analysis.script;
      const sameCode = (run: CodeRun) => run.code.replace(/\s+/g, "") === script.replace(/\s+/g, "");
      const replayOnce = () =>
        stage("replay", "Replayer", extractor, ["code execution"], () =>
          respond({ model: extractor, system: REPLAY_PROMPT, user: script, maxTokens: 3000, deadline, onActivity: say }),
        );
      let replay = await replayOnce();
      if (!replay.codeRuns.some(sameCode)) {
        say("The script came back changed. Running it again");
        replay = await replayOnce();
      }
      const rerun = replay.codeRuns.find(sameCode) ?? replay.codeRuns[0];
      say(resultFrom(rerun) === recount.analysis.value ? "Same script, same number" : "The replay gave a different number");

      const challenged = await stage("challenge", "Skeptic", skeptic, ["code execution"], () =>
        respond({
          model: skeptic,
          system: CHALLENGE_PROMPT,
          user: `Claim: ${JSON.stringify(recount.claim)}\nAnalyst method: ${recount.analysis?.method}\nAnalyst script:\n${script}`,
          maxTokens: 4000,
          deadline,
          onActivity: say,
        }),
      );
      const review = reviewFrom(challenged.content);
      recount.challenge = {
        definition_match: review.definition_match,
        // Figures come from the sandbox, so an objection quoting one from memory is dropped.
        objections: (review.objections ?? []).filter((objection) => !/\d/.test(objection)),
        rerun_value: resultFrom(rerun),
        rerun_identical: Boolean(rerun && sameCode(rerun)),
        alternatives: alternativesFrom(challenged.codeRuns).filter(
          ({ value }) => Math.abs(value) <= Math.abs(recount.analysis?.value ?? 0) * 100,
        ),
      };
    }

    if (recount.challenge) say(`${recount.challenge.alternatives.length} other readings computed`);
    Object.assign(recount, decideVerdict(recount.claim, recount.analysis, recount.challenge));
  } catch (error) {
    if (error instanceof OtariError && error.isGuardrail) {
      recount.status = "blocked";
      recount.reason = "Otari refused this input before any model read it: it contains instructions for the pipeline.";
    } else if (error instanceof OverTime || (error instanceof DOMException && error.name === "TimeoutError")) {
      recount.status = "failed";
      recount.reason = "The run hit the time limit before a verdict.";
    } else if (error instanceof OverBudget || (error instanceof OtariError && error.isBudget)) {
      recount.status = "over_budget";
      recount.reason = `Stopped at the $${recount.budgetUsd.toFixed(2)} cap.`;
    } else {
      recount.status = "failed";
      recount.error = error instanceof Error ? error.message : String(error);
      recount.reason = "The run failed before a verdict.";
    }
  }
  return recount;
}
