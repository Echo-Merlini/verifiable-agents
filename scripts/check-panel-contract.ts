// Contract vectors for the frozen panel state contract (@boardyai, 15 August 2026).
//
// Written BEFORE any panel changes, per his sequencing: "write the vectors from this contract,
// including the current reachable mappings, before changing panel code."
//
// Each vector carries an explicit expected execution state, an expected verdict (or null), and
// the qualifier — rule 5. The vectors are generated into a golden so that changing what a
// reader is told becomes a diff rather than a silent edit.
//
// Exit codes: 0 verified-good · 1 determinate mismatch · 2 could-not-check.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  surfaceFor, fromLegacy, combineSubChecks, LEGACY_MAP,
  EXECUTION_STATES, DOMAIN_VERDICTS,
  type Outcome, type ExecutionState, type DomainVerdict, type SubResult,
} from "../src/lib/panel-contract";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "..", "src", "lib", "__golden__", "panel-contract.golden.json");
const EXIT_OK = 0, EXIT_BAD = 1, EXIT_UNVERIFIABLE = 2;

let fails = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) fails++;
};

// Rule 5: every declared state needs a reachable vector. Built from the declarations so a new
// state added without a vector cannot slip through.
const OUTCOME_VECTORS: [string, Outcome][] = [
  ...EXECUTION_STATES.filter((s) => s !== "CHECKED").map(
    (s) => [`exec:${s}`, { execution: s } as Outcome] as [string, Outcome]),
  ...DOMAIN_VERDICTS.map(
    (v) => [`checked:${v}`, { execution: "CHECKED", verdict: v } as Outcome] as [string, Outcome]),
];

// The current reachable mappings he asked for — every legacy string in use across the eight
// panels, plus the ones that must NOT resolve to a verdict.
const LEGACY_VECTORS: string[] = [
  ...Object.keys(LEGACY_MAP),
  "UNVERIFIABLE", "Verified", "  ok  ",          // case + whitespace at the boundary
  "no_concerns_raised",                           // the substring trap in ReviewVerdictEvidence
  "concerns_addressed", "approved", "vIoLaTiOn",
  "future_state_from_2027", "", "null",
];

const SUBCHECK_VECTORS: [string, Record<string, SubResult>][] = [
  ["all_true", { cc: true, id: true, pq: true, tamper: true }],
  ["identity_unknown", { cc: true, id: "unknown", pq: true, tamper: true }],
  ["one_false", { cc: true, id: false, pq: true, tamper: true }],
  ["unknown_and_false", { cc: false, id: "unknown", pq: true, tamper: true }],
  ["all_unknown", { cc: "unknown", id: "unknown" }],
  ["empty", {}],
];

function snapshot() {
  const outcomes: Record<string, unknown> = {};
  for (const [name, o] of OUTCOME_VECTORS) outcomes[name] = surfaceFor(o);
  const legacy: Record<string, unknown> = {};
  for (const raw of LEGACY_VECTORS) {
    const o = fromLegacy(raw);
    legacy[JSON.stringify(raw)] = { outcome: o, surface: surfaceFor(o) };
  }
  const subchecks: Record<string, unknown> = {};
  for (const [name, subs] of SUBCHECK_VECTORS) {
    const o = combineSubChecks(subs);
    subchecks[name] = { outcome: o, surface: surfaceFor(o) };
  }
  return { outcomes, legacy, subchecks };
}

if (process.argv.includes("--write-golden")) {
  mkdirSync(dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify({
    note: "Frozen panel state contract (@boardyai, 2026-08-15). Every vector carries an explicit "
        + "expected execution state, verdict (or null) and qualifier. Changing what a reader is "
        + "told is a deliberate act that updates this file — read the diff.",
    contract: { execution: EXECUTION_STATES, verdicts: DOMAIN_VERDICTS },
    source: "src/lib/panel-contract.ts",
    ...snapshot(),
  }, null, 2) + "\n");
  console.log(`wrote ${GOLDEN}`);
  process.exit(EXIT_OK);
}

console.log("\npanel state contract — frozen vectors\n");
if (!existsSync(GOLDEN)) {
  console.error("UNVERIFIABLE — no golden. Regenerate with --write-golden and review the diff.");
  process.exit(EXIT_UNVERIFIABLE);
}
let golden: any;
try { golden = JSON.parse(readFileSync(GOLDEN, "utf8")); }
catch (e) { console.error(`UNVERIFIABLE — golden unreadable: ${(e as Error).message}`); process.exit(EXIT_UNVERIFIABLE); }

const got = snapshot();

console.log("every vector renders exactly what the contract records\n");
for (const k of Object.keys(got.outcomes))
  check(`outcome ${k}`, JSON.stringify(got.outcomes[k]) === JSON.stringify(golden.outcomes?.[k]));
for (const k of Object.keys(got.legacy))
  check(`legacy ${k}`, JSON.stringify(got.legacy[k]) === JSON.stringify(golden.legacy?.[k]));
for (const k of Object.keys(got.subchecks))
  check(`subcheck ${k}`, JSON.stringify(got.subchecks[k]) === JSON.stringify(golden.subchecks?.[k]));

console.log("\nrule 5 — every declared state is reachable, and carries a qualifier\n");
{
  const reached = new Set(Object.values(got.outcomes).map((s: any) => s.execution));
  for (const s of EXECUTION_STATES) check(`reachable execution: ${s}`, reached.has(s));
  const vreached = new Set(Object.values(got.outcomes).map((s: any) => s.verdict).filter(Boolean));
  for (const v of DOMAIN_VERDICTS) check(`reachable verdict: ${v}`, vreached.has(v));
  const all = [...Object.values(got.outcomes), ...Object.values(got.legacy).map((x: any) => x.surface),
               ...Object.values(got.subchecks).map((x: any) => x.surface)];
  check("every surface is qualified", all.every((s: any) => s.qualified === true));
  check("every surface has non-empty text", all.every((s: any) => typeof s.text === "string" && s.text.length > 12));
}

console.log("\nrule 1 + 4 — a verdict exists only under CHECKED\n");
{
  const all = [...Object.values(got.outcomes), ...Object.values(got.legacy).map((x: any) => x.surface),
               ...Object.values(got.subchecks).map((x: any) => x.surface)];
  check("no verdict on a non-CHECKED surface",
    all.every((s: any) => s.execution === "CHECKED" || s.verdict === null));
  check("every CHECKED surface names a verdict",
    all.every((s: any) => s.execution !== "CHECKED" || s.verdict !== null));
}

console.log("\nrule 2 — unknown maps to COULD_NOT_CHECK, never green or red\n");
for (const raw of ["future_state_from_2027", "no_concerns_raised", "concerns_addressed", "approved", "", "null"]) {
  const e: any = (got.legacy as any)[JSON.stringify(raw)];
  check(`${JSON.stringify(raw)} → COULD_NOT_CHECK`, e.outcome.execution === "COULD_NOT_CHECK",
    JSON.stringify(e.outcome));
  check(`${JSON.stringify(raw)} is neither green nor red`, e.surface.tone !== "green" && e.surface.tone !== "red",
    e.surface.tone);
}

console.log("\nrule 3 — legacy UNVERIFIABLE does not survive as a second canonical state\n");
{
  const lower: any = (got.legacy as any)[JSON.stringify("unverifiable")];
  const upper: any = (got.legacy as any)[JSON.stringify("UNVERIFIABLE")];
  check("lowercase maps to COULD_NOT_CHECK", lower.outcome.execution === "COULD_NOT_CHECK");
  check("uppercase maps to COULD_NOT_CHECK", upper.outcome.execution === "COULD_NOT_CHECK");
  const states = new Set(Object.values(got.legacy).map((x: any) => x.outcome.execution));
  check("UNVERIFIABLE is not itself an execution state", !states.has("UNVERIFIABLE" as any));
  check("it is not in the declared alphabet", !(EXECUTION_STATES as readonly string[]).includes("UNVERIFIABLE"));
}

console.log("\nthe motivating case — PqKeyBinding sub-checks\n");
{
  const s: any = got.subchecks;
  check("identity unknown does NOT contribute VERIFIED",
    s.identity_unknown.outcome.execution === "COULD_NOT_CHECK", JSON.stringify(s.identity_unknown.outcome));
  check("identity unknown does NOT silently become REJECTED",
    s.identity_unknown.outcome.verdict === undefined || s.identity_unknown.outcome.verdict === null);
  check("an actual false still rejects", s.one_false.outcome.verdict === "REJECTED");
  check("unknown outranks a false — cannot claim a determinate rejection it did not establish",
    s.unknown_and_false.outcome.execution === "COULD_NOT_CHECK");
  check("all true verifies", s.all_true.outcome.verdict === "VERIFIED");
  check("no sub-checks is NOTHING_TO_CHECK, not a pass", s.empty.outcome.execution === "NOTHING_TO_CHECK");
}

console.log();
if (fails) { console.log(`${fails} assertion(s) failed`); process.exit(EXIT_BAD); }
console.log("the contract holds across every declared state and every mapped legacy value");
process.exit(EXIT_OK);
