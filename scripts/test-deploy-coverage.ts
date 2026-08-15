// Controls for the deploy-verification contract (@boardyai, 15 August 2026).
//
// Rule 5 is the one that matters here: a fixture must exercise the layout CHANGING, so the
// checker proves it follows the deployment rather than a remembered shape. The original
// failure was a selector that knew one naming convention and reported "NOT FOUND across 27"
// when it met the other.
//
// Run: bun run scripts/test-deploy-coverage.ts

import {
  enumerateChunks, legacyPrefixSelector, assessCoverage, type FetchedChunk,
} from "../src/lib/deploy-coverage";

let fails = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${!cond && detail ? `  — ${detail}` : ""}`);
  if (!cond) fails++;
};

// Rule 5 — the same deployment under two build layouts. Next emits app/-prefixed chunks for
// some routes and bare page chunks for others, and a real deploy contains both.
const HTML_APP_LAYOUT = `
<html><body>
<script src="/_next/static/chunks/webpack-abc.js"></script>
<script src="/_next/static/chunks/2117-shared.js"></script>
<script src="/_next/static/chunks/app/verify/page-deadbeef.js"></script>
</body></html>`;

const HTML_PAGE_LAYOUT = `
<html><body>
<script src="/_next/static/chunks/webpack-abc.js"></script>
<script src="/_next/static/chunks/2117-shared.js"></script>
<script src="/_next/static/chunks/page-8cd1805c.js"></script>
</body></html>`;

const MARKER = "COULD_NOT_CHECK";
const fetchAll = (html: string, carrier: string): FetchedChunk[] =>
  enumerateChunks(html).map((p) => ({ p, body: p === carrier ? `x${MARKER}x` : "unrelated" }))
    .map(({ p, body }) => ({ path: p, body }));

console.log("controls for the deploy-verification contract\n");

console.log("RULE 5 — the checker follows the deployment across both layouts:");
{
  const a = assessCoverage(HTML_APP_LAYOUT, fetchAll(HTML_APP_LAYOUT, "/_next/static/chunks/app/verify/page-deadbeef.js"), [MARKER]);
  const b = assessCoverage(HTML_PAGE_LAYOUT, fetchAll(HTML_PAGE_LAYOUT, "/_next/static/chunks/page-8cd1805c.js"), [MARKER]);
  check("app/-prefixed layout: COVERED", a.verdict === "COVERED", a.verdict);
  check("bare page-chunk layout: COVERED", b.verdict === "COVERED", b.verdict);
  check("the marker is attributed to the chunk that carried it",
    b.found[MARKER] === "/_next/static/chunks/page-8cd1805c.js", String(b.found[MARKER]));
}

console.log("\nTHE ORIGINAL BUG — the prefix selector must be caught, not tolerated:");
{
  // Exactly what shipped: filter to app/ chunks, meet a page-chunk deployment, inspect nothing.
  const selected = legacyPrefixSelector(HTML_PAGE_LAYOUT);
  check("the legacy selector matches zero chunks on this layout", selected.length === 0,
    JSON.stringify(selected));
  const fetched: FetchedChunk[] = selected.map((p) => ({ path: p, body: "" }));
  const c = assessCoverage(HTML_PAGE_LAYOUT, fetched, [MARKER]);
  check("verdict is NO_COVERAGE, not MARKER_ABSENT", c.verdict === "NO_COVERAGE", c.verdict);
  check("it does NOT report the marker as absent", c.verdict !== "MARKER_ABSENT");
  check("it names the chunks it never attempted", c.skipped.length === 3, String(c.skipped.length));
  check("and says why", c.skipped.every((s) => s.reason.length > 8));
  check("the note calls it a coverage failure", /coverage failure/.test(c.note), c.note);
}

console.log("\nRULE 4 — inspected, skipped and unmatched are reported separately:");
{
  const chunks = enumerateChunks(HTML_PAGE_LAYOUT);
  const fetched: FetchedChunk[] = [
    { path: chunks[0], body: "unrelated" },
    { path: chunks[1], body: null, reason: "HTTP 503 from the CDN" },
  ];
  const c = assessCoverage(HTML_PAGE_LAYOUT, fetched, [MARKER]);
  check("inspected holds only what was actually searched", c.inspected.length === 1, JSON.stringify(c.inspected));
  check("a failed fetch is skipped WITH its reason",
    c.skipped.some((s) => /503/.test(s.reason)), JSON.stringify(c.skipped));
  check("a never-attempted chunk is skipped as such",
    c.skipped.some((s) => /never attempted/.test(s.reason)), JSON.stringify(c.skipped));
  check("unmatched names the marker, not a count", c.unmatched[0] === MARKER);
  check("none of the three collapse into one number",
    c.inspected.length + c.skipped.length >= chunks.length);
}

console.log("\nCONTENT RESULT — only reachable once coverage is established:");
{
  const chunks = enumerateChunks(HTML_PAGE_LAYOUT);
  const fetched: FetchedChunk[] = chunks.map((p) => ({ path: p, body: "nothing here" }));
  const c = assessCoverage(HTML_PAGE_LAYOUT, fetched, [MARKER]);
  check("genuinely absent marker reports MARKER_ABSENT", c.verdict === "MARKER_ABSENT", c.verdict);
  check("and says coverage was established first", /coverage was established first/.test(c.note));
}

console.log("\nDEGENERATE — a route that references no chunks at all:");
{
  const c = assessCoverage("<html></html>", [], [MARKER]);
  check("verdict is COULD_NOT_FETCH, never COVERED", c.verdict === "COULD_NOT_FETCH", c.verdict);
  check("it claims nothing about the marker", c.found[MARKER] === undefined);
}

console.log("\nENUMERATION — no prefix assumption (rule 1):");
{
  const mixed = HTML_APP_LAYOUT + HTML_PAGE_LAYOUT;
  const all = enumerateChunks(mixed);
  check("finds app/-prefixed AND bare page chunks together", all.length === 4, JSON.stringify(all));
  check("legacy selector finds only one of the two shapes", legacyPrefixSelector(mixed).length === 1);
}

console.log();
if (fails) { console.log(`${fails} control(s) failed`); process.exit(1); }
console.log("all controls passed — the checker's own coverage is established, not assumed");
