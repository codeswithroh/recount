# Recount

Paste a statistic. Recount downloads the source data, recalculates the figure in a sandbox, and gives you a verdict plus the script.

Built for Mozilla's Developers Wilding hackathon on [Otari](https://otari.ai), using open-weight models only.

| Claim | Claimed | Recounted | Verdict |
|---|---|---|---|
| Nigeria's population passed 300 million in 2023 | 300 | 227.9 | Wrong |
| Brazil's GDP per capita doubled between 2003 and 2013 | 2x | 1.35x | Wrong |
| Global CO2 emissions per capita fell 20% between 2010 and 2020 | 20% | 4.2% | Wrong |
| India's population grew 2.5% between 2020 and 2023 | 2.5% | 2.53% | Reproduced |

These are test claims written for the demo, checked against World Bank and Eurostat data. Each run cost $0.03 to $0.07.

## How a recount works

1. **Extract** (`deepseek/deepseek-v4-flash`): pulls out the number, unit, place and period.
2. **Recompute** (`deepseek/deepseek-v4-pro`): finds the series through the MCP data server, then writes and runs a script that downloads it.
3. **Replay** (`deepseek/deepseek-v4-flash`): runs the same script in a fresh sandbox.
4. **Challenge** (`openai/gpt-oss-120b`): checks the definition and computes other readings, such as another base year.

## Why no model reports the result

In testing, a model wrote a correct script and then reported 2.51 when the script's output said 2.53. So:

- Every number comes from raw sandbox stdout, through Otari's Responses API. Chat Completions doesn't expose code execution output.
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
