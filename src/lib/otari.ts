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
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    let detail = text.slice(0, 300);
    try {
      detail = JSON.parse(text).detail ?? detail;
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
    if (chunk.usage?.cost_usd) costUsd = Number(chunk.usage.cost_usd);
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

export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model did not return JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
