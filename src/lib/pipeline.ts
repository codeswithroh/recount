import { randomUUID } from "crypto";
import { chat, OtariError, parseJson, type ChatRequest } from "./otari";
import type { Analysis, Challenge, Claim, Recount, RecountEvent, StageName, StageRun } from "./types";
import { decideVerdict } from "./verdict";

export const models = () => ({
  extractor: process.env.RECOUNT_MODEL_EXTRACTOR || "deepseek/deepseek-v4-flash",
  analyst: process.env.RECOUNT_MODEL_ANALYST || "alibaba/qwen3-coder-480b-a35b-instruct",
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

const EXTRACT_PROMPT = `You pull the single checkable statistic out of a piece of text.
If the input is a URL, fetch it and pick its most prominent statistic.
Answer with JSON only:
{"statement": "the claim in one sentence", "claimed_value": number or null, "unit": "%, percentage points, million people, USD...", "metric": "what is measured", "geography": "", "period": "", "source_hint": "who the text credits for the number, or empty"}
Keep the number as stated: for "1.4 billion" use 1.4 with unit "billion".`;

const RECOMPUTE_PROMPT = `You recalculate a published statistic from its primary source.
1. Find the official dataset. Use the data tools first, then web search if available.
2. Write one self-contained Python script that downloads the data from a public URL, computes the figure, and prints a last line of exactly: RESULT <number>
3. Run it with code execution. Fix it until it works. Never paste data into the script and never guess a value.
4. Express the result in the claim's unit and scale.
Answer with JSON only:
{"found_data": boolean, "dataset_title": "", "data_url": "", "method": "one sentence", "script": "the final script", "value": number or null, "unit": "", "notes": "caveats, one sentence"}
If no primary data exists, set found_data to false and value to null.`;

const CHALLENGE_PROMPT = `You are checking another analyst's recalculation. Assume it may be wrong.
1. Run their script unchanged with code execution and read the RESULT line.
2. Decide if the script measures the same thing as the claim: same population, geography, period, and basis (nominal or real, gross or net, per capita or total).
3. Write up to three other reasonable readings of the claim, compute them in code from the same source (another base year, another series, real instead of nominal).
Answer with JSON only:
{"rerun_value": number or null, "definition_match": boolean, "alternatives": [{"label": "short description", "value": number or null}], "objections": ["short sentences"]}
Use null for rerun_value if the script fails.`;

class OverBudget extends Error {}

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

  const stage = async <T>(
    name: StageName,
    role: string,
    tools: string[],
    request: ChatRequest,
  ): Promise<T> => {
    if (recount.costUsd >= recount.budgetUsd) throw new OverBudget();
    emit({ type: "stage_start", stage: name, role, model: request.model });

    const result = await chat(request);
    let data: T;
    try {
      data = parseJson<T>(result.content);
    } catch {
      const repair = await chat({
        ...request,
        tools: [],
        mcpServers: [],
        user: `Return this as the requested JSON only, nothing else:\n${result.content}`,
      });
      result.costUsd += repair.costUsd;
      data = parseJson<T>(repair.content);
    }

    const run: StageRun = {
      stage: name,
      role,
      requestedModel: request.model,
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
    emit({ type: "stage_done", run, data });
    return data;
  };

  const { extractor, analyst, skeptic } = models();
  const web = webEnabled();
  const servers = dataServers();

  try {
    const isUrl = /^https?:\/\//i.test(input.trim());
    recount.claim = await stage<Claim>("extract", "Extractor", isUrl ? ["web fetch"] : [], {
      model: extractor,
      system: EXTRACT_PROMPT,
      user: input,
      maxTokens: 800,
      tools: isUrl ? [{ type: "otari_web_fetch", max_uses: 2 }] : [],
    });

    recount.analysis = await stage<Analysis>(
      "recompute",
      "Analyst",
      ["code execution", ...(servers.length ? ["MCP"] : []), ...(web ? ["web search"] : [])],
      {
        model: analyst,
        system: RECOMPUTE_PROMPT,
        user: `Claim: ${JSON.stringify(recount.claim)}`,
        maxTokens: 4000,
        mcpServers: servers,
        tools: [
          { type: "otari_code_execution" },
          ...(web ? [{ type: "otari_web_search", max_uses: 3 }, { type: "otari_web_fetch", max_uses: 3 }] : []),
        ],
      },
    );

    if (recount.analysis.found_data && recount.analysis.script) {
      recount.challenge = await stage<Challenge>("challenge", "Skeptic", ["code execution"], {
        model: skeptic,
        system: CHALLENGE_PROMPT,
        user: `Claim: ${JSON.stringify(recount.claim)}\nAnalyst result: ${JSON.stringify(recount.analysis)}`,
        maxTokens: 4000,
        tools: [{ type: "otari_code_execution" }],
      });
    }

    Object.assign(recount, decideVerdict(recount.claim, recount.analysis, recount.challenge));
  } catch (error) {
    if (error instanceof OverBudget || (error instanceof OtariError && error.isBudget)) {
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
