// The Boardy rule, applied to /verify — the rendered state is part of the asserted state.
//
// Same contract as the console's reference/check_boardy_rule.py, deliberately: drive the
// SHIPPED projection over every state it can be handed, pin the rendered text to a golden, and
// require that no input yields an unqualified green. @boardyai chose this surface first
// because "it is the canonical place where a person decides whether to trust the result, so a
// dropped qualifier there is the highest-risk presentation failure."
//
// Exit codes follow the house convention: 0 verified-good · 1 determinate mismatch ·
// 2 could-not-check. A skipped comparison is never a pass.
//
// Regenerate the golden with --write-golden, then READ THE DIFF. A lost qualifier looks
// exactly like a wording change here, which is the point of pinning it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { rowMarker, summaryVerdict, surfaceMark, surfaceBanner, rowMarkGlyph, VERDICT_STATES, type CheckStatus, type CheckRow } from "../src/lib/verdict-projection";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = join(HERE, "..", "src", "lib", "__golden__", "verdict-projection.golden.json");
const EXIT_OK = 0, EXIT_BAD = 1, EXIT_UNVERIFIABLE = 2;

let fails = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) fails++;
};

const c = (id: string, status: CheckStatus): CheckRow => ({ id, status });

// Every input a caller can hand the projection, including the ones that used to fall through.
const SUMMARY_CASES: [string, boolean, CheckRow[]][] = [
  ["not_run", false, []],
  ["not_run_with_checks", false, [c("a", "pass")]],
  ["nothing_to_check", true, []],
  ["all_pass", true, [c("a", "pass"), c("b", "pass")]],
  ["one_fail", true, [c("a", "pass"), c("b", "fail")]],
  ["one_unverifiable", true, [c("a", "pass"), c("b", "unverifiable")]],
  ["fail_outranks_unverifiable", true, [c("a", "fail"), c("b", "unverifiable")]],
  ["all_unverifiable", true, [c("a", "unverifiable")]],
];
const ROW_CASES: CheckStatus[] = ["pass", "fail", "unverifiable"];

function snapshot() {
  const summaries: Record<string, unknown> = {};
  for (const [name, ran, checks] of SUMMARY_CASES) summaries[name] = summaryVerdict(ran, checks);
  const rows: Record<string, unknown> = {};
  for (const s of ROW_CASES) rows[s] = rowMarker(s);
  // The compact surfaces too: a glyph and a banner are rendered state like any other, and both
  // previously collapsed three states into one.
  const glyphs: Record<string, unknown> = {};
  for (const [name, ran, checks] of SUMMARY_CASES) {
    glyphs[name] = { mark: surfaceMark(ran, checks), banner: surfaceBanner(ran, checks) };
  }
  const rowGlyphs: Record<string, unknown> = {};
  for (const s of ROW_CASES) rowGlyphs[s] = rowMarkGlyph(s);
  return { rows, summaries, glyphs, rowGlyphs };
}

if (process.argv.includes("--write-golden")) {
  mkdirSync(dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify({
    note: "Rendered verdicts, pinned. The Boardy rule: the rendered state is part of the asserted "
        + "state, so changing what a reader sees is a deliberate act that updates this file. "
        + "Regenerate with bun run scripts/check-verdict-projection.ts --write-golden and read the diff.",
    source: "src/lib/verdict-projection.ts",
    ...snapshot(),
  }, null, 2) + "\n");
  console.log(`wrote ${GOLDEN}`);
  process.exit(EXIT_OK);
}

console.log("\n/verify — the rendered state is part of the asserted state\n");

if (!existsSync(GOLDEN)) {
  console.error("UNVERIFIABLE — no golden. Regenerate with --write-golden and review the diff.");
  process.exit(EXIT_UNVERIFIABLE);
}
let golden: any;
try {
  golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
} catch (e) {
  console.error(`UNVERIFIABLE — golden unreadable: ${(e as Error).message}`);
  process.exit(EXIT_UNVERIFIABLE);
}

const got = snapshot();

console.log("every state renders exactly what the golden records\n");
for (const [name] of SUMMARY_CASES) {
  check(`summary ${name}`, JSON.stringify(got.summaries[name]) === JSON.stringify(golden.summaries?.[name]),
    JSON.stringify(got.summaries[name]).slice(0, 140));
}
for (const s of ROW_CASES) {
  check(`row ${s}`, JSON.stringify(got.rows[s]) === JSON.stringify(golden.rows?.[s]),
    JSON.stringify(got.rows[s]).slice(0, 140));
}
for (const [name] of SUMMARY_CASES) {
  check(`glyphs ${name}`, JSON.stringify(got.glyphs[name]) === JSON.stringify(golden.glyphs?.[name]),
    JSON.stringify(got.glyphs[name]).slice(0, 120));
}

console.log("\nthe compact surfaces do not collapse three states into one\n");
const gl: any = got.glyphs;
check("could-not-check has its own glyph", gl["one_unverifiable"].mark.glyph !== gl["not_run"].mark.glyph,
  `${gl["one_unverifiable"].mark.glyph} vs ${gl["not_run"].mark.glyph}`);
check("could-not-check has its own banner", gl["one_unverifiable"].banner !== gl["not_run"].banner,
  gl["one_unverifiable"].banner);
check("nothing-to-check is not a tick", gl["nothing_to_check"].mark.glyph !== "\u2713");
check("could-not-check is not a tick", gl["one_unverifiable"].mark.glyph !== "\u2713");

console.log("\nno input renders an unqualified green\n");
for (const [name] of SUMMARY_CASES) {
  const v: any = got.summaries[name];
  check(`summary ${name}: qualified`, v.qualified === true);
  check(`summary ${name}: green only when VERIFIED`,
    v.tone !== "green" || v.state === "VERIFIED", `${v.state}/${v.tone}`);
}
for (const s of ROW_CASES) {
  const r: any = got.rows[s];
  check(`row ${s}: qualified`, r.qualified === true);
  check(`row ${s}: green only when pass`, r.tone !== "green" || r.state === "pass");
}

console.log("\ncould-not-check is never a pass and never a mismatch\n");
const unver: any = got.summaries["one_unverifiable"];
check("an unverifiable row does not produce VERIFIED", unver.state !== "VERIFIED", unver.state);
check("an unverifiable row does not produce MISMATCH", unver.state !== "MISMATCH", unver.state);
check("and the headline says could not, not did not match",
  /couldn't|could not/i.test(unver.headline) && !/no longer matches/i.test(unver.headline), unver.headline);
const rowU: any = got.rows["unverifiable"];
check("the row says it in words, not only in colour", /could not check/i.test(rowU.prefix), rowU.prefix);

console.log("\nhaving nothing to check is its own state, not an accusation\n");
const none: any = got.summaries["nothing_to_check"];
check("zero checks does not render as VERIFIED", none.state !== "VERIFIED", none.state);
check("zero checks does not render as MISMATCH", none.state !== "MISMATCH", none.state);
check("and does not accuse the user's input",
  !/no longer matches/i.test(none.headline + none.detail), none.headline);

console.log("\na real mismatch outranks a could-not-check\n");
const both: any = got.summaries["fail_outranks_unverifiable"];
check("fail + unverifiable resolves to MISMATCH", both.state === "MISMATCH", both.state);

console.log("\nevery declared state is reachable from some input\n");
const reached = new Set(Object.values(got.summaries).map((v: any) => v.state));
for (const s of VERDICT_STATES) {
  check(`reachable: ${s}`, reached.has(s), "declared but no input produces it");
}

console.log();
if (fails) {
  console.log(`${fails} assertion(s) failed`);
  process.exit(EXIT_BAD);
}
console.log("the rendered surface matches the asserted state");
process.exit(EXIT_OK);
