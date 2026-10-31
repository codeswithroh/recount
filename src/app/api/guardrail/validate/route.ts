import { findInjection } from "@/lib/guardrail";

// Implements Otari's guardrail service contract, so the gateway refuses a flagged input before any provider is called.
export async function POST(request: Request) {
  const { profile, input_text } = (await request.json()) as { profile?: string; input_text?: string };
  const hit = findInjection(input_text ?? "");
  return Response.json({
    profile,
    result: { valid: !hit, explanation: hit ? "Instructions aimed at the pipeline." : null, score: hit ? 1 : 0 },
  });
}
