/* The deploy-verification contract — @boardyai, 15 August 2026.
 *
 * Promoted from a live failure. A deploy check reported "NOT FOUND across 27 chunks" while the
 * deployment was correct: the selector filtered to `/_next/static/chunks/app/...`, and the
 * routes in question emit `/_next/static/chunks/page-*.js` with no `app/` prefix. It searched
 * everywhere except the chunk that mattered.
 *
 * His framing, and the reason this is its own contract:
 *
 *   "The selector was correct about the chunks it knew how to name, and wrong about the
 *    deployment it was supposed to inspect. 'NOT FOUND across 27' sounded precise while
 *    excluding the relevant route chunks. That's a coverage failure, not a content failure."
 *
 *   "Most dangerous falsehoods here are claims about what was checked, not only claims about
 *    what the checked artifact says. The verifier needs to make its own coverage and blind
 *    spots re-derivable too."
 *
 * So a Coverage result carries what was inspected, what was skipped and why, and which
 * selectors matched nothing — separately, never merged into a single count. A checker that
 * cannot say what it failed to look at is making an unestablished claim about its own reach,
 * which is the same defect one level up from the artifacts it inspects.
 *
 * THE RULES:
 *   1. Enumerate the actual chunk set from the deployment. Never assume a path prefix.
 *   2. The target route must be in the inspected set — assert it, do not infer it.
 *   3. A selector that matches zero relevant chunks is a FAILURE, not an empty pass.
 *   4. Report inspected, skipped and unmatched separately.
 *   5. A fixture must exercise the layout changing (app/ chunks vs page chunks) so the checker
 *      proves it follows the deployment rather than a remembered shape.
 */

export type CoverageVerdict = "COVERED" | "MARKER_ABSENT" | "NO_COVERAGE" | "COULD_NOT_FETCH";

export interface Coverage {
  verdict: CoverageVerdict;
  /** Chunk paths actually fetched and searched. */
  inspected: string[];
  /** Found in the document but not searched, each with a stated reason. Never silently dropped. */
  skipped: { path: string; reason: string }[];
  /** Selectors that matched nothing. Rule 3: non-empty here is a failure, not an absence. */
  unmatched: string[];
  /** Which markers were located, and in which chunk. */
  found: Record<string, string | null>;
  qualified: true;
  note: string;
}

/** Rule 1: every chunk the document references, with no prefix assumption whatsoever. */
export function enumerateChunks(html: string): string[] {
  const out = new Set<string>();
  // Deliberately broad: any static chunk path, at any depth, however the build names it.
  for (const m of html.matchAll(/\/_next\/static\/chunks\/[^"'\s\\)]+?\.js/g)) out.add(m[0]);
  return [...out].sort();
}

/** The bug this contract exists to prevent, kept as a named function so a test can drive it. */
export function legacyPrefixSelector(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/\/_next\/static\/chunks\/app[^"'\s\\)]+?\.js/g)) out.add(m[0]);
  return [...out].sort();
}

export interface FetchedChunk { path: string; body: string | null; reason?: string }

/**
 * Rules 2-4. `markers` are the strings whose presence proves the deployment carries the change.
 * Coverage is decided BEFORE content: a run that inspected nothing cannot report on markers.
 */
export function assessCoverage(
  routeHtml: string,
  fetched: FetchedChunk[],
  markers: string[],
): Coverage {
  const referenced = enumerateChunks(routeHtml);
  const inspected = fetched.filter((f) => f.body !== null).map((f) => f.path);
  const skipped = fetched
    .filter((f) => f.body === null)
    .map((f) => ({ path: f.path, reason: f.reason ?? "not fetched, no reason recorded" }));
  // Referenced by the route but never even attempted — the blind spot that produced the
  // original failure. Named separately so it cannot hide inside a total.
  for (const p of referenced) {
    if (!fetched.some((f) => f.path === p)) skipped.push({ path: p, reason: "referenced by the route but never attempted" });
  }

  if (referenced.length === 0) {
    return { verdict: "COULD_NOT_FETCH", inspected, skipped, unmatched: markers, found: {},
      qualified: true, note: "the route document referenced no chunks — nothing could be inspected, so nothing is claimed" };
  }
  // Rule 3. Zero inspected is never an empty pass, and never a marker-absent verdict either:
  // we did not establish anything about the content.
  if (inspected.length === 0) {
    return { verdict: "NO_COVERAGE", inspected, skipped, unmatched: markers, found: {},
      qualified: true, note: `the selector matched none of the ${referenced.length} chunk(s) this route references — a coverage failure, not a content result` };
  }

  const found: Record<string, string | null> = {};
  for (const m of markers) {
    const hit = fetched.find((f) => f.body !== null && f.body.includes(m));
    found[m] = hit ? hit.path : null;
  }
  const unmatched = markers.filter((m) => found[m] === null);

  return {
    verdict: unmatched.length === 0 ? "COVERED" : "MARKER_ABSENT",
    inspected, skipped, unmatched, found, qualified: true,
    note: unmatched.length === 0
      ? `all ${markers.length} marker(s) located across ${inspected.length} inspected chunk(s)`
      : `${unmatched.length} marker(s) not present in ${inspected.length} inspected chunk(s) — content result, coverage was established first`,
  };
}
