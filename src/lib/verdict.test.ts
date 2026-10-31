import assert from "node:assert/strict";
import { test } from "node:test";
import type { Analysis, Challenge, Claim } from "./types";
import { decideVerdict } from "./verdict";

const claim = { claimed_value: 2.5, unit: "%" } as Claim;
const analysis = { found_data: true, value: 2.5276, unit: "%" } as Analysis;
const challenge: Challenge = {
  rerun_value: 2.5276,
  rerun_identical: true,
  definition_match: true,
  alternatives: [],
  objections: [],
};
const verdict = (a = analysis, c: Challenge | null = challenge, cl = claim) => decideVerdict(cl, a, c).verdict;

test("close value with the same definition is reproduced", () => {
  assert.equal(verdict(), "reproduced");
});

test("a missing definition answer does not count against the claim", () => {
  const { definition_match: _, ...rest } = challenge;
  assert.equal(verdict(analysis, rest as Challenge), "reproduced");
});

test("matching number with another definition is misleading", () => {
  assert.equal(verdict(analysis, { ...challenge, definition_match: false }), "misleading");
});

test("value that only matches an alternative reading is misleading", () => {
  const other = { ...analysis, value: 4 };
  const alternatives = [{ label: "base 2021", value: 2.5 }];
  assert.equal(verdict(other, { ...challenge, rerun_value: 4, alternatives }), "misleading");
});

test("a different number is wrong", () => {
  assert.equal(verdict({ ...analysis, value: 4 }, { ...challenge, rerun_value: 4 }), "wrong");
});

test("no data, no replay, or an edited replay is unverifiable", () => {
  assert.equal(verdict({ ...analysis, found_data: false }), "unverifiable");
  assert.equal(verdict(analysis, null), "unverifiable");
  assert.equal(verdict(analysis, { ...challenge, rerun_value: 3 }), "unverifiable");
  assert.equal(verdict(analysis, { ...challenge, rerun_identical: false }), "unverifiable");
});

test("a hedged claim gets a wider margin", () => {
  const measured = { ...analysis, value: 2593.4 };
  const rerun = { ...challenge, rerun_value: 2593.4 };
  const hedged = { ...claim, claimed_value: 2700, approximate: true };
  assert.equal(verdict(measured, rerun, hedged), "reproduced");
  assert.equal(verdict(measured, rerun, { ...hedged, approximate: false }), "wrong");
});
