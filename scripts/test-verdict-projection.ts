// Controls for the /verify projection check.
//
// The point is the FAIL path. A rendered-surface check that has only run against a correct
// projection has not been shown to work — it has been shown to be silent, and on this page
// silence is the highest-risk failure there is: it is where a person decides whether to trust
// the result.
//
// Each control mutates a temp copy of the SHIPPED projection and requires the check to go red.
// Exit codes are asserted exactly, never "non-zero" — 1 (determinate) and 2 (could not check)
// are different answers, and a control accepting either would pass while the check collapsed
// them, which is the defect under test one level up.
//
// Run: bun run scripts/test-verdict-projection.ts

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "src", "lib", "verdict-projection.ts");
const EXIT_OK = 0, EXIT_BAD = 1, EXIT_UNVERIFIABLE = 2;

let fails = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${!cond && detail ? `  — ${detail}` : ""}`);
  if (!cond) fails++;
};

/** A throwaway copy of the repo's lib+scripts+golden with one substitution in the projection. */
function runMutated(find: string, replace: string) {
  const src = readFileSync(SRC, "utf8");
  if (!src.includes(find)) return { anchored: false, code: -1, out: "" };
  const td = mkdtempSync(join(tmpdir(), "vp-"));
  mkdirSync(join(td, "src", "lib"), { recursive: true });
  mkdirSync(join(td, "scripts"), { recursive: true });
  cpSync(join(ROOT, "src", "lib", "__golden__"), join(td, "src", "lib", "__golden__"), { recursive: true });
  writeFileSync(join(td, "src", "lib", "verdict-projection.ts"), src.replace(find, replace));
  cpSync(join(HERE, "check-verdict-projection.ts"), join(td, "scripts", "check-verdict-projection.ts"));
  const r = spawnSync("bun", ["run", join(td, "scripts", "check-verdict-projection.ts")],
    { encoding: "utf8", timeout: 120000 });
  return { anchored: true, code: r.status ?? -1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

console.log("controls for check-verdict-projection\n");

console.log("NEGATIVE CONTROL — could-not-check rendered as a green verdict:");
{
  const r = runMutated(
    `state: "COULD_NOT_CHECK", qualified: true, tone: "amber",`,
    `state: "VERIFIED", qualified: true, tone: "green",`);
  // Anchor drift is reported, never skipped. An unrun control is not a passing one — the
  // console's equivalent suite shipped once with an anchor that patched zero bytes.
  check("mutation anchor still present", r.anchored, "anchor drifted — control did not run");
  if (r.anchored) check("exit is exactly 1", r.code === EXIT_BAD, `got ${r.code}`);
}

console.log("\nNEGATIVE CONTROL — nothing-to-check goes back to accusing the user:");
{
  const r = runMutated(
    `headline: "Nothing to check.",`,
    `headline: "Recompute failed — your edited input no longer matches what was committed on-chain.",`);
  check("mutation anchor still present", r.anchored);
  if (r.anchored) {
    check("exit is exactly 1", r.code === EXIT_BAD, `got ${r.code}`);
    check("caught as an accusation, not just a wording drift",
      /does not accuse the user/.test(r.out), r.out.slice(-260));
  }
}

console.log("\nNEGATIVE CONTROL — the row stops saying it in words:");
{
  const r = runMutated(`tone: "amber", prefix: "could not check"`, `tone: "amber", prefix: "recomputed"`);
  check("mutation anchor still present", r.anchored);
  if (r.anchored) {
    check("exit is exactly 1", r.code === EXIT_BAD, `got ${r.code}`);
    check("caught in words, not only colour", /says it in words/.test(r.out), r.out.slice(-220));
  }
}

console.log("\nNEGATIVE CONTROL — the compact glyph re-collapses two states:");
{
  const r = runMutated(`: v.state === "COULD_NOT_CHECK" ? "~"`, `: v.state === "COULD_NOT_CHECK" ? "·"`);
  check("mutation anchor still present", r.anchored);
  if (r.anchored) {
    check("exit is exactly 1", r.code === EXIT_BAD, `got ${r.code}`);
    check("caught as a collapse", /own glyph/.test(r.out), r.out.slice(-200));
  }
}

console.log("\nUNVERIFIABLE — the golden is missing (must be 2, never 0):");
{
  const td = mkdtempSync(join(tmpdir(), "vp-nog-"));
  mkdirSync(join(td, "src", "lib"), { recursive: true });
  mkdirSync(join(td, "scripts"), { recursive: true });
  writeFileSync(join(td, "src", "lib", "verdict-projection.ts"), readFileSync(SRC, "utf8"));
  cpSync(join(HERE, "check-verdict-projection.ts"), join(td, "scripts", "check-verdict-projection.ts"));
  const r = spawnSync("bun", ["run", join(td, "scripts", "check-verdict-projection.ts")],
    { encoding: "utf8", timeout: 120000 });
  check("exit is exactly 2", r.status === EXIT_UNVERIFIABLE, `got ${r.status}`);
  check("could-not-check never reports as a pass", r.status !== EXIT_OK);
}

console.log("\nPOSITIVE CONTROL — the projection as shipped:");
{
  const r = spawnSync("bun", ["run", join(HERE, "check-verdict-projection.ts")],
    { encoding: "utf8", timeout: 120000 });
  check("exit is exactly 0", r.status === EXIT_OK, `got ${r.status}`);
  check("says the surface matches the asserted state",
    /the rendered surface matches the asserted state/.test(r.stdout ?? ""));
}

console.log();
if (fails) { console.log(`${fails} control(s) failed`); process.exit(EXIT_BAD); }
console.log("all controls passed — the check can fail for each reason it claims to check");
