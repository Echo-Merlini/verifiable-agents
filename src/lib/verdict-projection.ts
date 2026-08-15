/* The /verify page's state → text projection, extracted so it can be asserted.
 *
 * @boardyai, 15 August 2026, on why this page came before the agent panels:
 *
 *   "It is the canonical place where a person decides whether to trust the result, so a
 *    dropped qualifier there is the highest-risk presentation failure. I'd treat the page as
 *    a projection of the same state-to-text contract, not a parallel implementation."
 *
 * So this is deliberately the same contract as the console's ui/lineage-marker.js: every
 * branch returns a named state and `qualified: true`, and there is no input for which it
 * returns an unqualified green. The page imports this; the check imports the same file. The
 * thing under test is the thing that ships.
 *
 * THE BUG THIS FIXES. The summary was computed inline as:
 *
 *     allOk  = ran && checks.length > 0 && checks.every(c => c.status === "pass")
 *     anyFail = checks.some(c => c.status === "fail")
 *     amber   = !anyFail && checks.some(c => c.status === "unverifiable")
 *     render: allOk ? green : amber ? amber : RED
 *
 * With `ran` true and ZERO checks, all three are false and it fell through to the red branch —
 * "Recompute failed — your edited input no longer matches what was committed on-chain." Having
 * nothing to check was rendered as a determinate mismatch, which is a specific accusation about
 * the user's input. Absence rendered as the strongest claim, in the mirror direction to the
 * console's old bug where absence rendered as no claim at all.
 *
 * Nothing-to-check is now its own state. It is not a pass and it is not a failure.
 */

export type CheckStatus = "pass" | "fail" | "unverifiable";
export interface CheckRow { id: string; status: CheckStatus }

export type VerdictState =
  | "VERIFIED"          // every check recomputed and matched
  | "MISMATCH"          // at least one check ran and disagreed — determinate
  | "COULD_NOT_CHECK"   // nothing mismatched, but something could not be recomputed
  | "NOTHING_TO_CHECK"  // ran, but there were no checks to run
  | "NOT_RUN";          // the user has not pressed the button

export interface Verdict {
  state: VerdictState;
  /** True on every branch. It exists so a caller — or a check — can assert that no path
   *  produces a bare green. A green with `qualified` absent would be a bug in this file. */
  qualified: true;
  /** The tone a caller applies. Never "green" unless state is VERIFIED. */
  tone: "green" | "amber" | "red" | "neutral";
  headline: string;
  detail: string;
}

/** The per-row projection. `fail` shows the full mismatch; `unverifiable` never renders as one. */
export function rowMarker(status: CheckStatus): {
  state: CheckStatus; qualified: true; tone: "green" | "amber" | "red"; prefix: string;
} {
  if (status === "pass") {
    return { state: "pass", qualified: true, tone: "green", prefix: "recomputed" };
  }
  if (status === "unverifiable") {
    // Amber: could not recompute. Must never be rendered as a mismatch, and must say so in
    // words rather than only in colour — a reader who does not perceive the amber still needs
    // to know this row proved nothing.
    return { state: "unverifiable", qualified: true, tone: "amber", prefix: "could not check" };
  }
  return { state: "fail", qualified: true, tone: "red", prefix: "recomputed" };
}

/** The summary projection. Order matters: a real mismatch outranks a could-not-check. */
export function summaryVerdict(ran: boolean, checks: readonly CheckRow[]): Verdict {
  if (!ran) {
    return {
      state: "NOT_RUN", qualified: true, tone: "neutral",
      headline: "Not recomputed yet.",
      detail: "Nothing has been checked, which is not the same as nothing being wrong.",
    };
  }
  if (checks.length === 0) {
    // Previously fell through to the red branch and accused the user's input of not matching.
    return {
      state: "NOTHING_TO_CHECK", qualified: true, tone: "amber",
      headline: "Nothing to check.",
      detail: "No checks were produced for this action, so this is neither a pass nor a mismatch — there was no recompute to judge.",
    };
  }
  if (checks.some((c) => c.status === "fail")) {
    return {
      state: "MISMATCH", qualified: true, tone: "red",
      headline: "Recompute failed — your edited input no longer matches what was committed on-chain.",
      detail: "That red is the point: the check is really re-deriving the hashes, not faking green.",
    };
  }
  if (checks.some((c) => c.status === "unverifiable")) {
    return {
      state: "COULD_NOT_CHECK", qualified: true, tone: "amber",
      headline: "Couldn't fully verify — the chain was unreachable.",
      detail: "Every other row recomputed in your browser; the on-chain anchor just couldn't be read right now. That's could not check, not did not match — the checker won't hand you a green it didn't earn.",
    };
  }
  return {
    state: "VERIFIED", qualified: true, tone: "green",
    headline: "Recomputed from public data — verified. No trust required.",
    detail: "Every hash was re-derived in your browser and the anchor was read from chain.",
  };
}

export const VERDICT_STATES: readonly VerdictState[] =
  ["VERIFIED", "MISMATCH", "COULD_NOT_CHECK", "NOTHING_TO_CHECK", "NOT_RUN"] as const;

/* The compact glyph used in the surfaces strip. It previously read
 *     surfaceMark = anyFail ? "✗" : allPass ? "✓" : "·"
 * so could-not-check, nothing-to-check and not-run all collapsed to one neutral dot: three
 * states, one glyph, no way to tell them apart. "~" now means specifically "ran, could not
 * fully check", and "·" is reserved for "not run / nothing to run". */
export function surfaceMark(ran: boolean, checks: readonly CheckRow[]): { glyph: string; state: VerdictState; qualified: true } {
  const v = summaryVerdict(ran, checks);
  const glyph = v.state === "VERIFIED" ? "✓"
    : v.state === "MISMATCH" ? "✗"
    : v.state === "COULD_NOT_CHECK" ? "~"
    : "·";
  return { glyph, state: v.state, qualified: true };
}

/* Per-row glyph, from the same row projection — "~" for could-not-check, never a tick. */
export function rowMarkGlyph(status: string): string {
  const r = rowMarker((status === "pass" || status === "fail" || status === "unverifiable")
    ? (status as CheckStatus) : "unverifiable");
  return r.state === "pass" ? "✓" : r.state === "fail" ? "✗" : "~";
}

/* The compact banner. Its third branch used to read "— PRESS VERIFY —" for could-not-check as
 * well as for not-run, so a surface that had been checked and could not be resolved was
 * indistinguishable from one nobody had asked about yet. */
export function surfaceBanner(ran: boolean, checks: readonly CheckRow[]): string {
  const v = summaryVerdict(ran, checks);
  switch (v.state) {
    case "MISMATCH": return "✗  TAMPER DETECTED";
    case "VERIFIED": return "✓  RECOMPUTED";
    case "COULD_NOT_CHECK": return "~  COULD NOT CHECK";
    case "NOTHING_TO_CHECK": return "·  NOTHING TO CHECK";
    default: return "— PRESS VERIFY —";
  }
}
