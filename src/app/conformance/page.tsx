"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, Check, X, Cpu, AlertTriangle, ArrowRight, Fingerprint, Download } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { VerificationBadge } from "@/components/VerificationBadge";
import { tagPillClass } from "@/lib/marketplace";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const SUITE = "ens_write.v0";
const SUITE_HASH = "f4fec32a…";

const short = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h || "");

type VecResult = { name: string; ok: boolean; got?: any; expected?: any };
type RunResult = {
  verdict: string; pass: boolean; tampered?: boolean;
  reproduced: number | null; total: number | null;
  run?: { results?: VecResult[]; vectors_sha256?: string };
  receipt?: any;
};

function downloadReceipt(receipt: any, ok: boolean) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conformance-receipt-ens-write${ok ? "" : "-rejected"}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// The candidate MCP being submitted to the gate.
const CANDIDATE = {
  label: "ENS Write",
  slug: "ens-write",
  endpoint: "https://gateway.ensub.org/mcp/ens",
  category: "Identity",
  mark: "ENS",
};

export default function ConformancePage() {
  const [phase, setPhase] = useState<"idle" | "grading" | "done">("idle");
  const [tampered, setTampered] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  async function submit(tamper: boolean) {
    if (phase === "grading") return;
    setTampered(tamper); setPhase("grading"); setResult(null);
    try {
      const r = await fetch(`${GW_URL}/conformance/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite: SUITE, tamper }),
      });
      const d: RunResult = await r.json();
      // let the grading read for a beat before the verdict lands
      setTimeout(() => { setResult(d); setPhase("done"); }, 900);
    } catch {
      setResult({ verdict: "unverifiable", pass: false, reproduced: null, total: null });
      setPhase("done");
    }
  }

  const results = result?.run?.results ?? [];
  const listed = phase === "done" && result?.pass;
  const failed = phase === "done" && result && !result.pass;

  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.24em] text-brassLight">Community lane · Machine gate</div>
        <h1 className="mt-4 text-3xl font-medium leading-[1.06] tracking-tight sm:text-[40px]">
          Submit an MCP. The <span className="text-brassLight">vectors</span> decide if it lists.
        </h1>
        <p className="mt-4 max-w-[54ch] font-serif text-[18px] leading-relaxed text-paper/70">
          No committee reviews a capability. It's graded against a <span className="text-paper">hash-pinned</span> suite
          of golden vectors — reproduce every one and it <span className="text-paper">lists itself</span>, carrying the
          Recomputable badge. This is marketplace admission you don't have to trust.
        </p>

        {/* Step 1 — Submit */}
        <Step n="01" t="Submit an MCP">
          <div className="rounded-xl border border-white/10 bg-deepink/50 p-4">
            <Field k="endpoint" v={CANDIDATE.endpoint} />
            <Field k="claims suite" v={`${SUITE} · ${SUITE_HASH}`} />
            <Field k="category" v={CANDIDATE.category} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => submit(false)} disabled={phase === "grading"}
              className="inline-flex items-center gap-2 rounded-xl bg-brassLight px-5 py-3 font-display text-[14px] font-semibold text-deepink transition hover:bg-[#ecb264] disabled:opacity-60">
              {phase === "grading" && !tampered ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Cpu className="h-4 w-4" /> Submit to the gate</>}
            </button>
            <button onClick={() => submit(true)} disabled={phase === "grading"}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/[0.06] px-5 py-3 font-display text-[14px] font-semibold text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-60">
              {phase === "grading" && tampered ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><AlertTriangle className="h-4 w-4" /> Submit a tampered build</>}
            </button>
          </div>
        </Step>

        {/* Step 2 — Grade */}
        {phase !== "idle" && (
          <Step n="02" t="Grade it — the recompute-kit re-derives each tx; the MCP must match">
            <div className="rounded-xl border border-white/10 bg-deepink/50 p-4">
              <div className="flex items-center justify-between font-mono text-[12px] text-paper/55">
                <span>{phase === "grading" ? "recomputing golden vectors…" : `suite verified · ${result?.run?.vectors_sha256?.slice(0, 12) ?? SUITE_HASH}…`}</span>
                {phase === "done" && result && <span className={result.pass ? "text-emerald-300" : "text-red-400"}>{result.reproduced}/{result.total}</span>}
              </div>
              {phase === "grading" && <div className="mt-3 flex items-center gap-2 text-paper/50"><Loader2 className="h-4 w-4 animate-spin" /> grading the submission…</div>}
              {phase === "done" && (
                <div className="mt-3 space-y-2">
                  {results.map((v) => (
                    <div key={v.name}>
                      <div className="flex items-center gap-2.5 font-mono text-[12px]">
                        <span className={`inline-grid h-4 w-4 place-items-center rounded ${v.ok ? "bg-emerald-400/12 text-emerald-300" : "bg-red-400/15 text-red-400"}`}>{v.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}</span>
                        <span className={v.ok ? "text-paper/75" : "text-red-300"}>{v.name}</span>
                      </div>
                      <div className="ml-[26px] mt-0.5 font-mono text-[10px] text-paper/40">
                        rules <span className="text-paper/55">{short(v.expected?.value)}</span> <span className={v.ok ? "text-emerald-300" : "text-red-400"}>{v.ok ? "↔" : "≠"}</span> mcp <span className={v.ok ? "text-paper/55" : "text-red-300"}>{short(v.got?.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Step>
        )}

        {/* Step 3 — It lists (the payoff) */}
        {phase === "done" && (
          <Step n="03" t={listed ? "→ It lists" : "→ Not listed"}>
            {listed ? (
              <>
                <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-ink to-deepink p-5" style={{ boxShadow: "0 20px 50px -30px rgba(76,190,147,.35)" }}>
                  <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-paper/40">Now in the marketplace</div>
                  <div className="flex items-center gap-3.5">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-ink font-mono text-[12px] font-semibold text-brassLight">{CANDIDATE.mark}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-semibold">
                        {CANDIDATE.label}
                        <VerificationBadge status="recomputable" />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className={tagPillClass("Community", "sm")}>Community</span>
                        <span className={tagPillClass("Identity", "sm")}>Identity</span>
                      </div>
                    </div>
                    <Link href="/marketplace" className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-brassLight/80 hover:text-brassLight">view <ArrowRight className="h-3 w-3" /></Link>
                  </div>
                  <div className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[11px] text-paper/45">
                    graded against {SUITE} · {SUITE_HASH} · {result?.reproduced}/{result?.total} reproduced · re-run it yourself
                  </div>
                </div>
                <p className="mt-3 text-[13.5px] text-paper/60"><span className="font-semibold text-emerald-300">No committee approved this — the vectors did.</span> It listed itself the moment it reproduced the suite.</p>
              </>
            ) : (
              <div className="rounded-2xl border border-red-400/25 bg-red-400/[0.04] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-red-400/40 bg-red-400/10 text-red-400"><X className="h-5 w-5" /></div>
                  <div>
                    <div className="font-semibold text-red-300">Not listed</div>
                    <div className="text-[13px] text-paper/60">A vector didn't reproduce, so it can't earn the badge. Not rejected by a person — it just doesn't recompute. Fix the failing link and resubmit.</div>
                  </div>
                </div>
              </div>
            )}
            {result?.receipt && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-deepink/50 p-4">
                <button onClick={() => downloadReceipt(result.receipt, !!listed)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-brassLight/40 bg-brassLight/10 px-4 py-2.5 font-display text-[13px] font-semibold text-brassLight transition hover:bg-brassLight/20">
                  <Download className="h-4 w-4" /> Download receipt
                </button>
                <div className="min-w-0 flex-1 text-[12px] leading-snug text-paper/55">
                  A portable <span className="font-mono text-[11px] text-paper/70">receiptos.evidence_capsule.v0</span> — its
                  root recomputes offline and every vector carries its rule + expected + got. Re-verify it yourself; no trust in this gate.
                </div>
              </div>
            )}
          </Step>
        )}

        {/* the other lane */}
        <div className="mt-9 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold"><Fingerprint className="h-4 w-4 text-brassLight" /> The other lane — Attested</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-paper/60">
            Golden-vector conformance only fits <span className="text-emerald-300">deterministic</span> capabilities (hashes,
            encodings, calldata). A live-data MCP — a DEX quote, a market read — is non-deterministic, so it can't reproduce a
            pinned vector. It still lists, in the <span className="text-brassLight">Attested</span> lane, where its evidence is
            the WYRIWE action-recompute on <span className="font-mono">/verify</span>.
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-deepink/40 p-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-ink font-mono text-[11px] text-paper/70">1IN</div>
            <div className="flex-1"><div className="flex items-center gap-2 text-[14px] font-medium">1inch <VerificationBadge status="attested" /></div></div>
            <span className={tagPillClass("Attested", "sm")}>Attested</span>
          </div>
        </div>
      </main>
    </div>
  );
}

function Step({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md border border-brassLight/40 bg-brassLight/10 font-mono text-[11px] text-brassLight">{n}</span>
        <h2 className="text-[15px] font-semibold">{t}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
      <span className="text-paper/45">{k}</span>
      <span className="truncate font-mono text-[12px] text-[#cdb58c]">{v}</span>
    </div>
  );
}
