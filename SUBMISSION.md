# Submission draft

Reply on the existing email thread with marcus+wilding@mozilla.org before the deadline.

- **Project:** Recount
- **Otari.ai email:** rohitpurkait001@gmail.com
- **One line:** Re-runs the maths behind published statistics and shows whether each number holds up, with the code attached.
- **Repository:** https://github.com/codeswithroh/recount
- **Live app:** https://recount-xi.vercel.app (open to everyone, no sign-in or code)
- **Branch:** devs-wilding
- **First Otari commit:** https://github.com/codeswithroh/recount/commit/ee0e525edd2c92c5ef582c090c344d6ff9fd987e
- **PRs or issues on the Otari repo:** TODO
- **Demo video:** TODO
- **Feedback recording:** TODO, or use the written answers below

## Otari features

Working in the app now:
- Code execution
- MCP integration (World Bank and Eurostat)
- Multiple models in distinct roles (extractor, analyst, skeptic)
- Guardrails: Otari blocks injected input with a 403 through Recount's own service at /api/guardrail
- Open-weight models: deepseek-v4-flash, deepseek-v4-pro, gpt-oss-120b
- Web search and fetch: paste a URL and Recount reads it (otari_web_fetch); the analyst can search when the data tools have no series
- Routing and fallbacks: the analyst calls the `recount-analyst` policy, DeepSeek V4 Pro with Kimi K2.7 Code as backup
- Budgets: the key has a $5 daily ceiling, and each run stops at $0.25

## Written feedback

**When were you most tempted to skip Otari and call the provider directly?**
When Chat Completions hid code execution. It returns only the model's final text, so I could not tell what the sandbox printed, and one model reported 2.51 when its script's output said 2.53. The Responses API returns the code and raw logs, which fixed it. I found that by trying each endpoint, because the same tool behaves differently across them.

**What did you end up building yourself that Otari should've done for you?**
- A per-run cost cap. Spend ceilings cover a key, not one job with several calls.
- A check that a model used a tool. qwen3-coder answered without running code when given the tool, and there was no error to catch.
- Handling for failures that arrive as HTML: a plain non-streamed Hello returned a CloudFront 504, not JSON.
- Recovery for Responses streams that close after several tool calls with no response.completed, so no error and no cost figure.

**If the rules hadn't required Otari, would you have continued using Otari? Why or why not?**
TODO: your answer. Worth mentioning: one key across three labs' models, and sandboxed Python with pandas and network access at about a cent a call, saved real work here.
