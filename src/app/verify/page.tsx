"use client";

import { useEffect, useState } from "react";
import { Check as CheckIcon, X as XIcon, Loader2, ShieldCheck, ArrowRight } from "lucide-react";
import { verifyAll, keccakUtf8, type Showcase, type Check } from "@/lib/verify";

// Self-contained: a real mainnet attestation baked to /showcase.json. The recompute
// still runs live in the browser + reads mainnet — only the record fetch is frozen,
// so the demo works offline / without the gateway. (Swap for a fresh run anytime.)
const SHOWCASE_URL = process.env.NEXT_PUBLIC_SHOWCASE_URL || "/showcase.json";
const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");

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

  async function run() {
    if (!sc) return;
    setRunning(true); setRan(false);
    const result = await verifyAll({ ...sc, query });   // recompute against the (maybe edited) query
    setChecks(result);
    setRunning(false); setRan(true);
  }

  const allOk = ran && checks.length > 0 && checks.every((c) => c.ok);

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
          A real on-chain agent action, attested in and out. Press verify — every hash is re-derived
          <span className="text-paper"> in your browser</span>, the anchor is read straight from mainnet,
          and the attestation signer is recovered. Nothing is trusted.
        </p>

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

              <label className="mt-5 block font-mono text-[11px] uppercase tracking-wide text-gb-muted">Query (public preimage — edit to tamper)</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                className={`mt-2 w-full rounded-xl border bg-black/20 px-4 py-3 text-sm font-mono outline-none transition-colors ${tampered ? "border-red-500/50 text-red-300" : "border-white/10 text-paper focus:border-brassLight/50"}`}
              />
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-gb-muted">Reply (public preimage)</p>
              <p className="mt-1 text-sm text-gb-faint whitespace-pre-wrap line-clamp-4">{sc.reply}</p>
            </div>

            {/* Live keccak of the current query */}
            <div className="mt-3 font-mono text-[11px] text-gb-faint">
              keccak256(utf8(query)) = <span className={tampered ? "text-red-300" : "text-brassLight/90"}>{short(keccakUtf8(query))}</span>
              {tampered && <span className="text-red-400"> · tampered → won&apos;t match the committed hash</span>}
            </div>

            {/* Verify */}
            <button
              onClick={run}
              disabled={running}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brass px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-brassLight disabled:opacity-50"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {running ? "Recomputing…" : "Verify"}
            </button>

            {/* Checks */}
            {ran && (
              <div className="mt-6 space-y-2">
                {checks.map((c) => (
                  <div key={c.id} className={`liquid-glass rounded-xl p-4 flex items-start gap-3 ${c.ok ? "" : "border-red-500/40"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                      {c.ok ? <CheckIcon className="h-3.5 w-3.5" /> : <XIcon className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="font-display font-medium">{c.label} <span className="ml-1 font-mono text-[10px] text-brassLight/70">{c.recipe}</span></p>
                      <p className="mt-1 font-mono text-[11px] text-gb-faint break-all">
                        recomputed {short(c.got)} {c.ok ? "= " : "≠ "} committed {short(c.expected)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className={`mt-4 rounded-2xl p-5 text-center ${allOk ? "border border-brassLight/30 bg-emerald-400/5" : "border border-red-500/30 bg-red-500/5"}`}>
                  {allOk ? (
                    <p className="font-display text-lg text-paper">Recomputed from public data — <span className="brass-text">verified.</span> No trust required.</p>
                  ) : (
                    <p className="font-display text-lg text-red-300">Recompute failed — the record does not match. (Restore the query to pass.)</p>
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
