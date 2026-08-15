/* The panel state contract — frozen by @boardyai, 15 August 2026.
 *
 * Two layers, because the panels were found holding six different vocabularies across eight
 * components and none of them consumed a shared verdict. The separation is not an invention:
 * three panels already implemented it under other names (PqKeyBindingEvidence's
 * idle/running/err beside ok/bad, PqLifecycle's phase, ReviewVerdictEvidence's separate status
 * and verdict fields). This names what they had already converged on.
 *
 * EXECUTION STATE — what happened when we tried.
 *   NOT_RUN           no check has been attempted
 *   PENDING           a check is underway and has not produced a result
 *   NOTHING_TO_CHECK  the input is validly understood, but there is no applicable claim or work item
 *   COULD_NOT_CHECK   the input was attempted, but the system cannot establish a result —
 *                     including absent, malformed, unrecognised, or failed evidence
 *   CHECKED           the check completed and established a domain verdict
 *
 * DOMAIN VERDICT — exists ONLY when execution is CHECKED. These stay domain-specific and are
 * deliberately NOT shared execution states.
 *
 * THE RULES, as frozen:
 *   1. No fallback may create a verdict.
 *   2. Unknown execution state or unknown domain verdict maps to COULD_NOT_CHECK, never green
 *      or red.
 *   3. Legacy UNVERIFIABLE maps to COULD_NOT_CHECK at the boundary and must not survive as a
 *      second canonical state.
 *   4. A panel with execution-only evidence must never render a domain verdict.
 *   5. Every declared state needs a reachable vector, and every vector needs an explicit
 *      expected state plus qualifier.
 *   6. The pair (executionState, verdict?) is the only input to a surface projection. Panels
 *      may choose labels and colours, but cannot derive status again.
 *
 * Rule 6 is enforced by shape here: `surfaceFor` takes only the pair. A panel that wants to
 * decide something else has to reach outside this module to do it, which CI can see.
 */

export type ExecutionState =
  | "NOT_RUN" | "PENDING" | "NOTHING_TO_CHECK" | "COULD_NOT_CHECK" | "CHECKED";

export type DomainVerdict =
  | "VERIFIED" | "REJECTED" | "APPROVE" | "CONCERN" | "CLEAN" | "VIOLATION";

export const EXECUTION_STATES: readonly ExecutionState[] =
  ["NOT_RUN", "PENDING", "NOTHING_TO_CHECK", "COULD_NOT_CHECK", "CHECKED"] as const;
export const DOMAIN_VERDICTS: readonly DomainVerdict[] =
  ["VERIFIED", "REJECTED", "APPROVE", "CONCERN", "CLEAN", "VIOLATION"] as const;

/* Rule 4 and the verdict-only-under-CHECKED constraint, expressed so the compiler refuses the
 * illegal combination rather than a reviewer catching it. A panel cannot construct a PENDING
 * that carries a verdict. */
export type Outcome =
  | { execution: "CHECKED"; verdict: DomainVerdict }
  | { execution: Exclude<ExecutionState, "CHECKED">; verdict?: never };

export interface Surface {
  execution: ExecutionState;
  verdict: DomainVerdict | null;
  /** True on every branch — no projection of this contract may return a bare, unqualified
   *  claim. Present so a check can assert it rather than a reader trusting it. */
  qualified: true;
  /** Green is reachable ONLY from CHECKED + VERIFIED/CLEAN/APPROVE. Everything a caller might
   *  be tempted to treat as "fine" — pending, nothing to check, could not check — is not. */
  tone: "green" | "amber" | "red" | "neutral";
  /** What a reader is told. Never empty, and never silent about an unestablished result. */
  text: string;
}

/** Rule 6: the pair is the only input. */
export function surfaceFor(o: Outcome): Surface {
  if (o.execution !== "CHECKED") {
    const text: Record<Exclude<ExecutionState, "CHECKED">, string> = {
      NOT_RUN: "Not checked yet — nothing has been attempted, which is not the same as nothing being wrong.",
      PENDING: "Checking — no result yet. This is not a pass.",
      NOTHING_TO_CHECK: "Nothing to check — the input is understood, and there is no applicable claim here.",
      COULD_NOT_CHECK: "Could not check — a check was attempted and no result could be established. This is not a rejection.",
    };
    return {
      execution: o.execution,
      verdict: null,
      qualified: true,
      tone: o.execution === "COULD_NOT_CHECK" || o.execution === "PENDING" ? "amber" : "neutral",
      text: text[o.execution],
    };
  }
  const byVerdict: Record<DomainVerdict, { tone: Surface["tone"]; text: string }> = {
    VERIFIED:  { tone: "green", text: "Checked — verified." },
    CLEAN:     { tone: "green", text: "Checked — clean." },
    APPROVE:   { tone: "green", text: "Checked — approved." },
    CONCERN:   { tone: "amber", text: "Checked — concerns raised." },
    REJECTED:  { tone: "red",   text: "Checked — rejected." },
    VIOLATION: { tone: "red",   text: "Checked — violation found." },
  };
  const r = byVerdict[o.verdict];
  return { execution: "CHECKED", verdict: o.verdict, qualified: true, tone: r.tone, text: r.text };
}

/* ── The boundary ────────────────────────────────────────────────────────────────────────────
 *
 * Rule 3: legacy UNVERIFIABLE maps to COULD_NOT_CHECK here and must not survive past this
 * point. Rule 2: anything unrecognised maps to COULD_NOT_CHECK, never to a verdict.
 *
 * This is deliberately the ONLY place a raw string becomes an Outcome. Every panel's existing
 * vocabulary is listed so the mapping is reviewable as a table rather than discovered in eight
 * components — and so a string nobody mapped is visibly unmapped rather than silently falling
 * somewhere flattering.
 */
export const LEGACY_MAP: Readonly<Record<string, Outcome>> = {
  // execution-layer legacy
  idle:          { execution: "NOT_RUN" },
  running:       { execution: "PENDING" },
  pending:       { execution: "PENDING" },
  err:           { execution: "COULD_NOT_CHECK" },
  error:         { execution: "COULD_NOT_CHECK" },
  unverifiable:  { execution: "COULD_NOT_CHECK" },   // rule 3
  unknown:       { execution: "COULD_NOT_CHECK" },   // LicensedMcpAudit: "used, no gate decision recorded"
  // domain verdicts, only ever under CHECKED
  verified:      { execution: "CHECKED", verdict: "VERIFIED" },
  ok:            { execution: "CHECKED", verdict: "VERIFIED" },
  rejected:      { execution: "CHECKED", verdict: "REJECTED" },
  bad:           { execution: "CHECKED", verdict: "REJECTED" },
  approve:       { execution: "CHECKED", verdict: "APPROVE" },
  concern:       { execution: "CHECKED", verdict: "CONCERN" },
  clean:         { execution: "CHECKED", verdict: "CLEAN" },
  violation:     { execution: "CHECKED", verdict: "VIOLATION" },
};

/** Rule 2, at the boundary. An unrecognised string is not an error to swallow and not a
 *  verdict to invent — it is a result we could not establish. */
export function fromLegacy(raw: string | null | undefined): Outcome {
  if (raw == null) return { execution: "COULD_NOT_CHECK" };
  const hit = LEGACY_MAP[String(raw).trim().toLowerCase()];
  return hit ?? { execution: "COULD_NOT_CHECK" };
}

/* ── The motivating case ─────────────────────────────────────────────────────────────────────
 *
 * PqKeyBindingEvidence line 97 was:
 *
 *     setState(ccOk && idOk !== false && pqOk && pqTamperRejected ? "ok" : "bad");
 *
 * Two invented verdicts in one expression. `idOk !== false` let an identity check that could
 * not be established count TOWARD "ok" — unknown resolving green. Every other unestablished
 * sub-check fell to "bad" — unknown resolving red. There was no way for the panel to say it
 * could not establish something.
 *
 * Split into named sub-results, per the frozen contract: a sub-check is true, false, or
 * unknown. Any unknown makes the whole COULD_NOT_CHECK — it cannot contribute VERIFIED, and it
 * cannot silently become REJECTED. Only an actual false does that.
 */
export type SubResult = true | false | "unknown";

export function combineSubChecks(subs: Readonly<Record<string, SubResult>>): Outcome {
  const values = Object.values(subs);
  if (values.length === 0) return { execution: "NOTHING_TO_CHECK" };
  if (values.some((v) => v === "unknown")) return { execution: "COULD_NOT_CHECK" };
  return values.every((v) => v === true)
    ? { execution: "CHECKED", verdict: "VERIFIED" }
    : { execution: "CHECKED", verdict: "REJECTED" };
}
