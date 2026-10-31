const BASE_URL = "https://otari.ai/api/v1";

export class OtariError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
  get isBudget() {
    return this.status === 402 || /budget|spend|ceiling/i.test(this.message);
  }
  get isGuardrail() {
    return this.status === 403 && /guardrail/i.test(this.message);
  }
}

export type ChatResult = {
  content: string;
  servedModel: string;
  provider: string;
  attempts: number;
  fallback: boolean;
  costUsd: number;
  durationMs: number;
  webCalls: unknown[];
};

export type ChatRequest = {
  model: string;
  system: string;
  user: string;
  tools?: Record<string, unknown>[];
  mcpServers?: Record<string, unknown>[];
  guardrails?: Record<string, unknown>[];
  maxTokens?: number;
};

// The hosted gateway's WAF returns a bare 403 for backticked function calls (mozilla-ai/otari#2704).
const stripBackticks = (text: string) => text.replaceAll("`", "'");

// Always streamed: the CDN cuts non-streamed tool loops at about 60s (mozilla-ai/otari#2692).
export async function chat(req: ChatRequest): Promise<ChatResult> {
  const key = process.env.OTARI_API_KEY;
  if (!key) throw new OtariError("OTARI_API_KEY is not set", 500);

  const started = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Otari-Key": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(280_000),
    body: JSON.stringify({
      model: req.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: req.maxTokens ?? 2500,
      messages: [
        { role: "system", content: stripBackticks(req.system) },
        { role: "user", content: stripBackticks(req.user) },
      ],
      ...(req.tools?.length ? { tools: req.tools } : {}),
      ...(req.mcpServers?.length ? { mcp_servers: req.mcpServers } : {}),
      ...(req.guardrails?.length ? { guardrails: req.guardrails } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text).detail ?? detail;
      detail = typeof parsed === "string" ? parsed : (parsed.message ?? text);
    } catch {}
    throw new OtariError(String(detail), res.status);
  }

  let content = "";
  let costUsd = 0;
  const webCalls: unknown[] = [];
  let buffer = "";
  const decoder = new TextDecoder();

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ") || line === "data: [DONE]") return;
    const chunk = JSON.parse(line.slice(6));
    if (chunk.error) throw new OtariError(chunk.error.message ?? "stream error", 502);
    for (const choice of chunk.choices ?? []) content += choice.delta?.content ?? "";
    if (chunk.otari_tool_calls) webCalls.push(...chunk.otari_tool_calls);
    if (chunk.usage) costUsd = Number(chunk.usage.cost_usd ?? chunk.usage.estimated_cost ?? costUsd);
  };

  for await (const bytes of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer);

  return {
    content,
    servedModel: res.headers.get("otari-model") ?? req.model,
    provider: res.headers.get("otari-provider") ?? "",
    attempts: Number(res.headers.get("otari-attempt-count") ?? 1),
    fallback: res.headers.get("otari-fallback") === "true",
    costUsd,
    durationMs: Date.now() - started,
    webCalls,
  };
}

export type CodeRun = { code: string; logs: string };

type ResponseItem = {
  type: string;
  code?: string;
  outputs?: { type: string; logs?: string }[];
  content?: { type: string; text?: string }[];
};

// Chat Completions hides code execution. Responses returns the code and raw stdout of every
// sandbox call, so verdict numbers can be read from the sandbox instead of a model's prose.
export async function respond(req: ChatRequest): Promise<ChatResult & { codeRuns: CodeRun[] }> {
  const key = process.env.OTARI_API_KEY;
  if (!key) throw new OtariError("OTARI_API_KEY is not set", 500);

  const started = Date.now();
  const res = await fetch(`${BASE_URL}/responses`, {
    method: "POST",
    headers: { "Otari-Key": key, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(280_000),
    body: JSON.stringify({
      model: req.model,
      stream: true,
      instructions: stripBackticks(req.system),
      input: stripBackticks(req.user),
      max_output_tokens: req.maxTokens ?? 3000,
      tools: [{ type: "code_interpreter", container: { type: "auto" } }, ...(req.tools ?? [])],
      include: ["code_interpreter_call.outputs"],
      ...(req.mcpServers?.length ? { mcp_servers: req.mcpServers } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text).detail ?? detail;
      detail = typeof parsed === "string" ? parsed : (parsed.message ?? text);
    } catch {}
    throw new OtariError(String(detail), res.status);
  }

  let final: { output?: ResponseItem[]; usage?: { cost_usd?: string; estimated_cost?: number } } | null = null;
  let failure = "";
  let buffer = "";
  const decoder = new TextDecoder();

  const handleLine = (line: string) => {
    if (!line.startsWith("data: ") || line === "data: [DONE]") return;
    const event = JSON.parse(line.slice(6));
    if (event.type === "response.completed" || event.type === "response.incomplete") final = event.response;
    if (event.type === "response.failed" || event.type === "error")
      failure = event.response?.error?.message ?? event.message ?? "stream failed";
  };

  for await (const bytes of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer);

  if (failure) throw new OtariError(failure, 502);
  const response = final as { output?: ResponseItem[]; usage?: { cost_usd?: string; estimated_cost?: number } } | null;
  if (!response) throw new OtariError("stream ended without a response", 502);

  const output = response.output ?? [];
  return {
    content: output
      .flatMap((item) => item.content ?? [])
      .map((part) => part.text ?? "")
      .join(""),
    codeRuns: output
      .filter((item) => item.type === "code_interpreter_call")
      .map((item) => ({
        code: item.code ?? "",
        logs: (item.outputs ?? []).map((out) => out.logs ?? "").join(""),
      })),
    servedModel: res.headers.get("otari-model") ?? req.model,
    provider: res.headers.get("otari-provider") ?? "",
    attempts: Number(res.headers.get("otari-attempt-count") ?? 1),
    fallback: res.headers.get("otari-fallback") === "true",
    costUsd: Number(response.usage?.cost_usd ?? response.usage?.estimated_cost ?? 0),
    durationMs: Date.now() - started,
    webCalls: [],
  };
}

// Models sometimes wrap the answer in prose or emit a draft first, so the last valid object wins.
export function parseJson<T>(text: string): T {
  let found: T | undefined;
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let quoted = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === "\\") i++;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) {
        try {
          found = JSON.parse(text.slice(start, i + 1)) as T;
          start = i;
        } catch {}
        break;
      }
    }
  }
  if (found === undefined) throw new Error("model did not return JSON");
  return found;
}
