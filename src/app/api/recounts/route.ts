import { models, runRecount } from "@/lib/pipeline";
import { listRecounts, saveRecount } from "@/lib/store";
import type { RecountEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return Response.json({
    recounts: await listRecounts(),
    config: {
      models: models(),
      budgetUsd: Number(process.env.RECOUNT_BUDGET_USD || 0.25),
      canRun: Boolean(process.env.OTARI_API_KEY),
      needsCode: Boolean(process.env.RECOUNT_ACCESS_CODE),
      guardrail: Boolean(process.env.OTARI_GUARDRAIL_URL),
      mcp: Boolean(process.env.OTARI_MCP_URL),
      web: process.env.OTARI_WEB_TOOLS === "1",
    },
  });
}

export async function POST(request: Request) {
  const { input, code } = (await request.json()) as { input?: string; code?: string };
  const required = process.env.RECOUNT_ACCESS_CODE;
  if (required && code !== required) return Response.json({ error: "Wrong access code." }, { status: 401 });
  const text = input?.trim();
  if (!text) return Response.json({ error: "Paste a claim or a URL." }, { status: 400 });
  if (text.length > 2000) return Response.json({ error: "Keep it under 2,000 characters." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RecountEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      // Long stages send nothing for minutes, and an idle connection gets dropped.
      send({ type: "activity", text: "Connected" });
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode("\n")), 15_000);
      const recount = await runRecount(text, send);
      clearInterval(heartbeat);
      await saveRecount(recount);
      send({ type: "done", recount });
      controller.close();
    },
  });
  // Compression holds small events back until a buffer fills, so progress would arrive all at once.
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store, no-transform",
      "Content-Encoding": "identity",
      "X-Accel-Buffering": "no",
    },
  });
}
