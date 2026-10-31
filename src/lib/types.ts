export type Verdict = "reproduced" | "misleading" | "wrong" | "unverifiable";

export type StageName = "extract" | "recompute" | "replay" | "challenge";

export type Claim = {
  statement: string;
  claimed_value: number | null;
  approximate?: boolean;
  unit: string;
  metric: string;
  geography: string;
  period: string;
  source_hint: string;
};

export type Analysis = {
  found_data: boolean;
  dataset_title: string;
  data_url: string;
  method: string;
  script: string;
  stdout: string;
  value: number | null;
  unit: string;
  notes: string;
};

export type Challenge = {
  rerun_value: number | null;
  rerun_identical: boolean;
  definition_match?: boolean;
  alternatives: { label: string; value: number | null }[];
  objections: string[];
};

export type StageRun = {
  stage: StageName;
  role: string;
  requestedModel: string;
  servedModel: string;
  provider: string;
  attempts: number;
  fallback: boolean;
  costUsd: number;
  durationMs: number;
  tools: string[];
};

export type Recount = {
  id: string;
  createdAt: string;
  input: string;
  status: "done" | "failed" | "over_budget" | "blocked";
  verdict: Verdict | null;
  reason: string;
  claim: Claim | null;
  analysis: Analysis | null;
  challenge: Challenge | null;
  stages: StageRun[];
  costUsd: number;
  budgetUsd: number;
  error?: string;
};

export type RecountEvent =
  | { type: "stage_start"; stage: StageName; role: string; model: string }
  | { type: "stage_done"; run: StageRun }
  | { type: "done"; recount: Recount };
