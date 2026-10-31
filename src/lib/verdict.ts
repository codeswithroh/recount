import type { Analysis, Challenge, Claim, Verdict } from "./types";

function tolerance(claimed: number, approximate?: boolean) {
  const decimals = (String(claimed).split(".")[1] ?? "").length;
  return Math.max(Math.abs(claimed) * (approximate ? 0.05 : 0.02), 0.5 * 10 ** -decimals);
}

// Decided here, not by a model, so a persuasive answer can't talk its way to "reproduced".
export function decideVerdict(
  claim: Claim,
  analysis: Analysis,
  challenge: Challenge | null,
): { verdict: Verdict; reason: string } {
  const claimed = claim.claimed_value;
  if (claimed === null) return { verdict: "unverifiable", reason: "No number in the claim." };
  const matches = (value: number | null): value is number =>
    value !== null && Math.abs(claimed - value) <= tolerance(claimed, claim.approximate);
  if (!analysis.found_data || analysis.value === null)
    return { verdict: "unverifiable", reason: "No usable source data found." };
  if (!challenge || challenge.rerun_value === null)
    return { verdict: "unverifiable", reason: "The script could not be re-run." };

  const drift = Math.abs(challenge.rerun_value - analysis.value);
  if (!challenge.rerun_identical || drift > Math.abs(analysis.value) * 0.005)
    return { verdict: "unverifiable", reason: "Re-running the script gave a different number." };

  const shown = `${Number(analysis.value.toPrecision(4))} ${claim.unit}`.trim();
  if (matches(analysis.value)) {
    // A skeptic's objection alone stays a caveat. Downgrading takes a computed figure that disagrees.
    const rival = challenge.alternatives.find(
      (alt) => alt.value !== null && Math.abs(alt.value - analysis.value!) > Math.abs(analysis.value!) * 0.1,
    );
    return challenge.definition_match === false && rival
      ? { verdict: "misleading", reason: `Matches one basis only. ${rival.label} gives ${Number(rival.value!.toPrecision(4))}.` }
      : { verdict: "reproduced", reason: `Source data gives ${shown}.` };
  }
  const alternative = challenge.alternatives.find((alt) => matches(alt.value));
  if (alternative)
    return { verdict: "misleading", reason: `Only holds under one reading: ${alternative.label}.` };
  return { verdict: "wrong", reason: `Source data gives ${shown}, not ${claimed}.` };
}
