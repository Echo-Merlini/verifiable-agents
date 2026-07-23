"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, Check, X, Search, ArrowRight, Fingerprint, Download } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { VerificationBadge } from "@/components/VerificationBadge";
import { tagPillClass } from "@/lib/marketplace";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const CATALOG_URL = "https://raw.githubusercontent.com/Echo-Merlini/agent-mcp-catalog/main/catalog.json";
const short = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-4)}` : h || "");

type CatalogMcp = {
  slug: string; name: string; category?: string; endpoint?: string | null;
  introspectable?: boolean; verification?: string;
  lanes?: { recomputable?: number | null; attested?: number | null };
};

type Tool = { tool: string; lane: "recomputable" | "attested"; ok?: boolean; recompute?: string; expected?: any; got?: any; reason?: string };
type Result = { endpoint: string; tools?: Tool[]; recomputable: number; attested: number; pass: boolean; receipt?: any; error?: string };

function hostOf(u: string) { try { return new URL(u).hostname; } catch { return u; } }
function labelOf(u: string) {
  const h = hostOf(u); const p = (() => { try { return new URL(u).pathname; } catch { return ""; } })();
  const slug = p.split("/").filter(Boolean).pop() || h;
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " MCP";
}

function downloadReceipt(receipt: any, ok: boolean) {
  const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `conformance-receipt${ok ? "" : "-partial"}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export default function ConformancePage() {
  const [endpoint, setEndpoint] = useState("https://gateway.ensub.org/mcp/ens");
  const [phase, setPhase] = useState<"idle" | "grading" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [catalog, setCatalog] = useState<CatalogMcp[]>([]);

  useEffect(() => {
    fetch(CATALOG_URL)
      .then((r) => r.json())
      .then((d) => setCatalog(Array.isArray(d?.mcps) ? d.mcps : []))
      .catch(() => setCatalog([]));
  }, []);

  async function submit(ep?: string) {
    const target = (ep ?? endpoint).trim();
    if (phase === "grading" || !target) return;
    if (ep) setEndpoint(ep);
    setPhase("grading"); setResult(null);
    try {
      const r = await fetch(`${GW_URL}/conformance/introspect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: target }),
      });
      const d: Result = await r.json();
      setTimeout(() => { setResult(d); setPhase("done"); }, 700);
    } catch (e) {
      setResult({ endpoint: target, recomputable: 0, attested: 0, pass: false, error: String(e) });
      setPhase("done");
    }
  }

  const tools = result?.tools ?? [];
  const rec = tools.filter((t) => t.lane === "recomputable");
  const att = tools.filter((t) => t.lane === "attested");
  const listed = phase === "done" && !!result?.pass && (result?.recomputable ?? 0) > 0;

  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.24em] text-brassLight">Community lane · Machine gate</div>
        <h1 className="mt-4 text-3xl font-medium leading-[1.06] tracking-tight sm:text-[40px]">
          Drop an MCP. The <span className="text-brassLight">recompute</span> decides what lists.
        </h1>
        <p className="mt-4 max-w-[54ch] font-serif text-[18px] leading-relaxed text-paper/70">
          No committee, no submission form. Paste an endpoint — the recompute-kit reads its tools and
          re-derives each output <span className="text-paper">byte-for-byte</span> from public rules: a tool that
          reproduces exactly lists as <span className="text-emerald-300">Recomputable</span>, with a portable receipt.
          Change a single byte and it fails — anything that can't be independently reproduced drops to
          <span className="text-brassLight"> Attested</span> (signed provenance, not reproduced). Every tool lands in
          one lane or the other.
        </p>

        {/* 01 — drop the endpoint */}
        <Step n="01" t="Drop your MCP endpoint">
          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/15 bg-deepink/50 px-3">
              <Search className="h-4 w-4 shrink-0 text-paper/40" />
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="https://your-mcp.example/mcp"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-3 font-mono text-[13px] text-paper placeholder:text-paper/30 focus:outline-none" />
            </div>
            <button onClick={() => submit()} disabled={phase === "grading"}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brassLight px-5 py-3 font-display text-[14px] font-semibold text-deepink transition hover:bg-[#ecb264] disabled:opacity-60">
              {phase === "grading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</> : <>Submit to the gate</>}
            </button>
          </div>
          <div className="mt-2 font-mono text-[11px] text-paper/40">reads <span className="text-paper/55">tools/list</span>, matches each tool against the recompute-kit's recipe registry — https only</div>

          {catalog.filter((m) => m.endpoint && m.introspectable !== false).length > 0 && (
            <div className="mt-4">
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper/40">
                or try one from the <a href="https://github.com/Echo-Merlini/agent-mcp-catalog" target="_blank" rel="noreferrer" className="text-brassLight/80 underline decoration-dotted underline-offset-2 hover:text-brassLight">catalog</a>
              </div>
              <div className="flex flex-wrap gap-2">
                {catalog.filter((m) => m.endpoint && m.introspectable !== false).map((m) => {
                  const r = m.lanes?.recomputable ?? 0;
                  const a = m.lanes?.attested;
                  const isRec = (r ?? 0) > 0;
                  return (
                    <button key={m.slug} onClick={() => submit(m.endpoint!)} disabled={phase === "grading"}
                      title={m.endpoint!}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px] transition disabled:opacity-50 ${
                        endpoint === m.endpoint ? "border-brassLight/60 bg-brassLight/10 text-paper" : "border-white/12 bg-deepink/50 text-paper/70 hover:border-white/25 hover:text-paper"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isRec ? "bg-emerald-400" : "bg-brassLight"}`} />
                      {m.name}
                      <span className="text-paper/35">{r}/{a ?? "·"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 font-mono text-[10px] text-paper/30"><span className="text-emerald-400">●</span> has a live recipe · <span className="text-brassLight">●</span> attested only · counts are recomputable/attested tools</div>
            </div>
          )}
        </Step>

        {/* 02 — detect + grade */}
        {phase !== "idle" && (
          <Step n="02" t="Detect & grade — re-derive each tool from the rules">
            <div className="rounded-xl border border-white/10 bg-deepink/50 p-4">
              {phase === "grading" && <div className="flex items-center gap-2 text-paper/50"><Loader2 className="h-4 w-4 animate-spin" /> introspecting {hostOf(endpoint)} + recomputing…</div>}
              {phase === "done" && result?.error && <div className="text-[13px] text-red-300">{result.error}</div>}
              {phase === "done" && !result?.error && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]">
                    <span className="text-emerald-300">{result?.recomputable} recomputable</span>
                    <span className="text-brassLight">{result?.attested} attested</span>
                    <span className="text-paper/40">{tools.length} tools discovered</span>
                  </div>
                  <div className="space-y-2">
                    {rec.map((t) => (
                      <div key={t.tool}>
                        <div className="flex items-center gap-2.5 font-mono text-[12px]">
                          <span className={`inline-grid h-4 w-4 place-items-center rounded ${t.ok ? "bg-emerald-400/12 text-emerald-300" : "bg-red-400/15 text-red-400"}`}>{t.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}</span>
                          <span className={t.ok ? "text-paper/75" : "text-red-300"}>{t.tool}</span>
                          <span className="text-paper/30">· {t.recompute}</span>
                        </div>
                        <div className="ml-[26px] mt-0.5 font-mono text-[10px] text-paper/40">
                          rules <span className="text-paper/55">{short(t.expected?.value)}</span> <span className={t.ok ? "text-emerald-300" : "text-red-400"}>{t.ok ? "↔" : "≠"}</span> mcp <span className={t.ok ? "text-paper/55" : "text-red-300"}>{short(t.got?.value)}</span>
                        </div>
                      </div>
                    ))}
                    {att.map((t) => (
                      <div key={t.tool} className="flex items-center gap-2.5 font-mono text-[12px] opacity-70">
                        <span className="inline-grid h-4 w-4 place-items-center rounded bg-brassLight/12 text-brassLight"><Fingerprint className="h-2.5 w-2.5" /></span>
                        <span className="text-paper/55">{t.tool}</span>
                        <span className="text-brassLight/70">· attested — {t.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Step>
        )}

        {/* 03 — list + receipt */}
        {phase === "done" && !result?.error && (
          <Step n="03" t={listed ? "→ It lists" : (result?.recomputable ? "→ Not fully listed" : "→ Nothing recomputable")}>
            {listed && (
              <div className="rounded-2xl border border-emerald-400/25 bg-gradient-to-b from-ink to-deepink p-5" style={{ boxShadow: "0 20px 50px -30px rgba(76,190,147,.35)" }}>
                <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.15em] text-paper/40">Now in the marketplace</div>
                <div className="flex items-center gap-3.5">
                  <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-ink font-mono text-[11px] font-semibold text-brassLight">{hostOf(endpoint).slice(0, 3).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-semibold">{labelOf(endpoint)}<VerificationBadge status="recomputable" /></div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={tagPillClass("Community", "sm")}>Community</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.02] px-2 py-[2px] text-[10.5px] text-paper/55">{result?.recomputable} recomputable tools</span>
                    </div>
                  </div>
                  <Link href="/marketplace" className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-brassLight/80 hover:text-brassLight">view <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="mt-4 border-t border-white/[0.06] pt-3 font-mono text-[11px] text-paper/45">graded against public rules · {result?.recomputable}/{result?.recomputable} tools reproduced · re-run it yourself</div>
              </div>
            )}
            {!listed && (
              <div className="rounded-2xl border border-brassLight/25 bg-brassLight/[0.04] p-5 text-[13px] text-paper/65">
                {result?.recomputable
                  ? "Some tools didn't reproduce the rules, so the capability isn't fully listed. Fix the failing tool and resubmit."
                  : "None of this endpoint's tools have a recompute recipe yet — its outputs can't be independently re-derived, so it lists in the Attested lane, not Recomputable."}
              </div>
            )}
            {result?.receipt && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-deepink/50 p-4">
                <button onClick={() => downloadReceipt(result.receipt, listed)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-brassLight/40 bg-brassLight/10 px-4 py-2.5 font-display text-[13px] font-semibold text-brassLight transition hover:bg-brassLight/20">
                  <Download className="h-4 w-4" /> Download receipt
                </button>
                <div className="min-w-0 flex-1 text-[12px] leading-snug text-paper/55">
                  A portable <span className="font-mono text-[11px] text-paper/70">receiptos.evidence_capsule.v0</span> —
                  its root recomputes offline and every tool carries its rule + expected + got. Re-verify it yourself; no trust in this gate.
                </div>
              </div>
            )}
          </Step>
        )}

        {/* the recipe registry note */}
        <div className="mt-9 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-[13px] text-paper/60">
          <span className="font-semibold text-paper">The registry is the moat.</span> A tool is
          <span className="text-emerald-300"> Recomputable</span> only if the recompute-kit can independently derive its
          output from public rules (EIP-137 namehash, resolver ABI, keccak…). Every recipe we add makes one more slice of
          <em className="not-italic"> any</em> MCP auto-gradeable. Live-data tools (quotes, market reads) have no
          derivation → <span className="text-brassLight">Attested</span>, backed by the WYRIWE action-recompute on <span className="font-mono">/verify</span>.
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
