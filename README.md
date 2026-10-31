# Recount

Paste a statistic. Recount downloads the source data, recalculates the figure in a sandbox, and gives you a verdict plus the script.

Built for Mozilla's Developers Wilding hackathon on [Otari](https://otari.ai), using open-weight models only.

Live: https://recount-xi.vercel.app

## A public argument, recounted

In May 2025 Akinwumi Adesina, then AfDB president, said Nigeria's GDP per capita fell from $1,847 in 1960 to $824. The Nigerian Presidency replied that the 1960 figure was $93. Recount checked each number against World Bank data:

| Who said it | Claim | Recounted | Verdict |
|---|---|---|---|
| Adesina | GDP per capita $1,847 in 1960 | $93 current, $1,455 constant 2015 dollars | Wrong |
| Adesina | GDP per capita $824 in 2024 | $1,084 | Wrong |
| Presidency | Per capita income $93 in 1960 | $93.14 | Reproduced |
| Presidency | GDP $4.2 billion in 1960 | $4.196 billion | Reproduced |
| Peter Obi, March 2026 | Nigeria's nominal GDP about $250 billion | $252.3 billion | Reproduced |

Same country, same year, a 16-fold gap between current and constant dollars. Each run cost $0.02 to $0.16, about 6 cents on average.

## How a recount works

1. **Extract** (`deepseek/deepseek-v4-flash`): pulls out the number, unit, place and period.
2. **Recompute** (`deepseek/deepseek-v4-pro`): finds the series through the MCP data server, then writes and runs a script that downloads it.
3. **Replay** (`deepseek/deepseek-v4-flash`): runs the same script in a fresh sandbox.
4. **Challenge** (`openai/gpt-oss-120b`): checks the definition and computes other readings, such as another base year.

## Why no model reports the result

In testing, a model wrote a correct script and then reported 2.51 when the script's output said 2.53. So:

- Every number comes from raw sandbox stdout, through Otari's Responses API. Chat Completions doesn't expose code execution output.
- The analyst never sees the claimed number, only what to measure. Before this it picked a PPP series that happened to match a claim.
- A skeptic's objection can't downgrade a claim alone. "Misleading" needs a computed figure from the sandbox.
- Input is checked by an Otari guardrail before any model reads it. Recount serves the check itself at `/api/guardrail/validate`, so Otari answers 403 and no provider is called.
- A script with no download URL is rejected and retried once.
- A replay must run identical code and land within 0.5%, or the verdict is unverifiable.
- `src/lib/verdict.ts` picks the verdict in plain code, with tests.

Only one judgement comes from a model: whether the script measures the same thing as the claim.

## Run it

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Set `OTARI_API_KEY` in `.env.local`. The MCP server is `POST /api/mcp`. Otari has to reach it, so set `OTARI_MCP_URL` to a public URL. Without it, the analyst runs with code execution only.

In the Otari dashboard:

1. Turn on web access, then set `OTARI_WEB_TOOLS=1`.
2. Create a Fallback policy named `recount-analyst`: main `deepseek/deepseek-v4-pro`, backup `moonshotai/kimi-k2.7-code`. Then set `RECOUNT_MODEL_ANALYST=recount-analyst`.
3. Put a daily spend ceiling on the API key.

```bash
npm test
```

## Limits

- Sources are the World Bank and Eurostat through MCP. Other claims depend on web search.
- The per-recount cap is checked between stages, so a run can overshoot by one stage. A test with a $0.012 cap stopped at $0.022.
- Results are stored in a local JSON file. Hosted copies show the seeded runs and can't save new ones.
- Otari's stream can close after several tool calls without a final event. Recount keeps the sandbox output, but that call's cost shows as $0.
- The public deploy needs an access code to run, because each run spends real credits. `RECOUNT_ACCESS_CODE` sets it.
- The analyst uses the headline series when a claim doesn't state its basis. Six of the nine seeded runs predate blind analysis, so the analyst saw the claimed number in those.
