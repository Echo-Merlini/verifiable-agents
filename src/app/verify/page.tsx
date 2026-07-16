"use client";

import { useEffect, useState } from "react";
import { Check as CheckIcon, X as XIcon, HelpCircle, Loader2, ShieldCheck, ArrowRight, Wand2, RotateCcw, RefreshCw } from "lucide-react";
import { verifyAll, keccakUtf8, type Showcase, type Check } from "@/lib/verify";

// Self-contained: a real mainnet attestation baked to /showcase.json. The recompute
// still runs live in the browser + reads mainnet — only the record fetch is frozen,
// so the demo works offline / without the gateway. (Swap for a fresh run anytime.)
const SHOWCASE_URL = process.env.NEXT_PUBLIC_SHOWCASE_URL || "/showcase.json";
const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");

// Flip exactly one byte of the query so a tamper is one click, not a guess.
function tamperOneChar(s: string): string {
  const i = s.search(/[a-zA-Z0-9]/);
  if (i < 0) return s + "!";
  const c = s[i];
  const repl = c.toLowerCase() === "a" ? "e" : "a";
  return s.slice(0, i) + (c === c.toUpperCase() ? repl.toUpperCase() : repl) + s.slice(i + 1);
}

export default function VerifyPage() {
  const [sc, setSc] = useState<Showcase | null>(null);
  const [query, setQuery] = useState("");          // editable → powers the tamper test
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(SHOWCASE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Showcase) => { setSc(d); setQuery(d.query); })
      .catch(() => setErr("Couldn't load the showcase attestation."));
  }, []);

  const tampered = !!sc && query !== sc.query;

  // Recompute against a specific query value (so tamper/restore can run the new value
  // immediately, without waiting on a state update).
  async function run(q: string = query) {
    if (!sc) return;
    setRunning(true); setRan(false);
    const result = await verifyAll({ ...sc, query: q });   // recompute against the (maybe edited) query
    setChecks(result);
    setRunning(false); setRan(true);
  }

  function tamper() { if (!sc) return; const q = tamperOneChar(query || sc.query); setQuery(q); run(q); }
  function restore() { if (!sc) return; setQuery(sc.query); run(sc.query); }

  const allOk = ran && checks.length > 0 && checks.every((c) => c.status === "pass");
  const anyFail = ran && checks.some((c) => c.status === "fail");
  const anyAmber = ran && checks.some((c) => c.status === "unverifiable");
  const failed = anyFail;                    // a real mismatch
  const amber = !anyFail && anyAmber;        // couldn't fully check, but nothing mismatched

  return (
    <main className="min-h-screen bg-deepink text-paper px-6 md:px-10 py-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <a href="/" className="font-display font-medium tracking-tight text-paper">Verifiable Agents</a>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Don&apos;t trust. Recompute.</span>
        </div>

        <h1 className="mt-10 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Verify it <span className="brass-text">yourself.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          A real on-chain agent action, attested in and out. Every hash is re-derived
          <span className="text-paper"> in your browser</span>, the anchor is read straight from mainnet,
          and the attestation signer is recovered. Nothing is trusted — so don&apos;t take our word for it, break it.
        </p>

        {/* Guided steps */}
        <ol className="mt-6 grid sm:grid-cols-3 gap-2">
          {[
            { n: "1", t: "Verify as-is", d: "Every field re-derives green." },
            { n: "2", t: "Tamper a byte", d: "One char of the input → it goes red." },
            { n: "3", t: "Restore", d: "Back to green. The check is real." },
          ].map((s) => (
            <li key={s.n} className="liquid-glass rounded-xl p-3 flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass/20 text-brassLight font-mono text-[11px]">{s.n}</span>
              <span className="min-w-0">
                <span className="block font-display text-sm text-paper">{s.t}</span>
                <span className="block text-[11px] text-gb-faint">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>

        {err && <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{err}</div>}

        {!sc && !err && (
          <div className="mt-10 flex items-center gap-2 text-gb-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading showcase…</div>
        )}

        {sc && (
          <>
            {/* Identity + preimage */}
            <div className="mt-8 liquid-glass rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Agent</p>
                  <p className="mt-1 font-display text-lg">{sc.ens} <span className="text-gb-muted">· #{sc.agentId}</span></p>
                </div>
                <span className="font-mono text-[10px] text-gb-faint">registry {short(sc.registry)}</span>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <label className="block font-mono text-[11px] uppercase tracking-wide text-gb-muted">Query — the public input the agent was given</label>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ${tampered ? "bg-red-500/15 text-red-300" : "bg-emerald-400/10 text-emerald-300/80"}`}>
                  {tampered ? "tampered" : "original"}
                </span>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                spellCheck={false}
                className={`mt-2 w-full rounded-xl border bg-black/20 px-4 py-3 text-sm font-mono outline-none transition-colors ${tampered ? "border-red-500/50 text-red-300" : "border-white/10 text-paper focus:border-brassLight/50"}`}
              />
              <p className="mt-1.5 text-[11px] text-gb-faint">Type in here to change the input — or use <span className="text-brassLight/80">Tamper a byte</span> below. The committed hash on-chain doesn&apos;t move, so any change must break the match.</p>

              <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-gb-muted">Reply — what the agent returned</p>
              <p className="mt-1 text-sm text-gb-faint whitespace-pre-wrap line-clamp-4">{sc.reply}</p>
            </div>

            {/* Live keccak of the current query */}
            <div className="mt-3 font-mono text-[11px] text-gb-faint">
              keccak256(utf8(query)) = <span className={tampered ? "text-red-300" : "text-brassLight/90"}>{short(keccakUtf8(query))}</span>
              {tampered && <span className="text-red-400"> · ≠ the hash committed on-chain</span>}
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => run()}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-brassLight disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {running ? "Recomputing…" : "Verify"}
              </button>

              {!tampered ? (
                <button
                  onClick={tamper}
                  disabled={running}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-paper/80 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" /> Tamper a byte
                </button>
              ) : (
                <button
                  onClick={restore}
                  disabled={running}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-paper/80 transition-colors hover:border-brassLight/40 hover:text-brassLight disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Restore original
                </button>
              )}

              {/* Contextual nudge toward the next step */}
              {!ran && !tampered && <span className="text-[12px] text-gb-faint">← start here</span>}
              {allOk && !tampered && <span className="text-[12px] text-emerald-300/80">Now hit <span className="font-medium">Tamper a byte</span> →</span>}
              {failed && tampered && <span className="text-[12px] text-brassLight/80"><span className="font-medium">Restore</span> to prove it passes again →</span>}
            </div>

            {/* Checks */}
            {ran && (
              <div className="mt-6 space-y-2">
                {checks.map((c) => {
                  const pass = c.status === "pass";
                  const unver = c.status === "unverifiable";
                  return (
                    <div key={c.id} className={`liquid-glass rounded-xl p-4 flex items-start gap-3 ${pass ? "" : unver ? "border-amber-400/40" : "border-red-500/40"}`}>
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${pass ? "bg-emerald-400/15 text-emerald-300" : unver ? "bg-amber-400/15 text-amber-300" : "bg-red-500/15 text-red-300"}`}>
                        {pass ? <CheckIcon className="h-3.5 w-3.5" /> : unver ? <HelpCircle className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-medium">{c.label} <span className="ml-1 font-mono text-[10px] text-brassLight/70">{c.recipe}</span></p>
                        {unver ? (
                          // Amber: could not recompute (network). Never rendered as a mismatch.
                          <p className="mt-1 font-mono text-[11px] break-all text-amber-300/90">could not check · <span className="text-amber-200/70">{c.got}</span></p>
                        ) : (
                          <p className="mt-1 font-mono text-[11px] break-all">
                            <span className="text-gb-faint">recomputed </span>
                            {/* On a red, show the FULL mismatch (not shortened) so the exact differing bytes are visible. */}
                            <span className={pass ? "text-gb-faint" : "text-red-300"}>{pass ? short(c.got) : c.got}</span>
                            <span className="text-gb-faint"> {pass ? "=" : "≠"} committed </span>
                            <span className={pass ? "text-gb-faint" : "text-emerald-300/80"}>{pass ? short(c.expected) : c.expected}</span>
                          </p>
                        )}
                        {unver && (
                          <button onClick={() => run()} disabled={running}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 px-3 py-1 text-[11px] text-amber-300/90 hover:border-amber-400/50 disabled:opacity-50">
                            <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className={`mt-4 rounded-2xl p-5 text-center ${allOk ? "border border-brassLight/30 bg-emerald-400/5" : amber ? "border border-amber-400/30 bg-amber-400/5" : "border border-red-500/30 bg-red-500/5"}`}>
                  {allOk ? (
                    <p className="font-display text-lg text-paper">Recomputed from public data — <span className="brass-text">verified.</span> No trust required.</p>
                  ) : amber ? (
                    <>
                      <p className="font-display text-lg text-amber-300">Couldn&apos;t fully verify — the chain was unreachable.</p>
                      <p className="mt-1.5 text-[12px] text-gb-muted">Every other row recomputed in your browser; the on-chain anchor just couldn&apos;t be read right now. That&apos;s <span className="text-amber-300">could not check</span>, not <span className="text-red-300">did not match</span> — the checker won&apos;t hand you a green it didn&apos;t earn.</p>
                      <button onClick={() => run()} disabled={running}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 px-4 py-2 text-[12px] text-amber-200 hover:bg-amber-400/25 disabled:opacity-50">
                        <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} /> Retry the anchor
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-lg text-red-300">Recompute failed — your edited input no longer matches what was committed on-chain.</p>
                      <p className="mt-1.5 text-[12px] text-gb-muted">That red is the point: the check is really re-deriving the hashes, not faking green. Hit <span className="text-brassLight">Restore original</span> to pass again.</p>
                    </>
                  )}
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-gb-muted">recipes via recompute-kit · recomputekit-ai.com</p>
                </div>
              </div>
            )}

            <a href="/#contact" className="mt-10 inline-flex items-center gap-1.5 text-sm text-brassLight/90 hover:text-brassLight">
              Build a verifiable agent <ArrowRight className="h-4 w-4" />
            </a>
          </>
        )}
      </div>
    </main>
  );
}
