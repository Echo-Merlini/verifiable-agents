"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2, Check, X, Cpu, AlertTriangle } from "lucide-react";
import { TopNav } from "@/components/TopNav";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const SUITE = "communication_chain.v0";

type VecResult = { name: string; expected: any; got: any; ok: boolean };
type RunResult = {
  verdict: string; pass: boolean; gate?: string; tampered?: boolean;
  reproduced: number | null; total: number | null;
  run?: { results?: VecResult[]; vectors_sha256?: string };
  evidence?: string;
};

// The communication act, in the grammar humans already use. Inputs mirror the pinned suite;
// the recomputed hash comes from the live engine.
const LINKS = [
  { name: "who",       w: "Who",                   said: "dinamic.eth",                          note: "the agent's identity (ENS namehash)" },
  { name: "said_what", w: "Said what",             said: "“swap 1 ETH to USDC on Uniswap”",       tampered: "“swap 10 ETH to USDC …”",  note: "the exact instruction it acted on" },
  { name: "channel",   w: "Through which channel", said: "uniswap",                              note: "the MCP capability used" },
  { name: "to_whom",   w: "To whom",               said: "0xFf9a…ca14",                          note: "the recipient / counterparty" },
  { name: "effect",    w: "With what effect",      said: "exactInputSingle calldata · user signs", note: "the anchored outcome" },
];

const short = (h?: string) => (h && h.length > 16 ? `${h.slice(0, 12)}…${h.slice(-6)}` : h || "");

export default function ConformancePage() {
  const [running, setRunning] = useState<null | "compliant" | "tamper">(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function run(tamper: boolean) {
    if (running) return;
    setRunning(tamper ? "tamper" : "compliant"); setResult(null); setShown(0);
    try {
      const r = await fetch(`${GW_URL}/conformance/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite: SUITE, tamper }),
      });
      const d: RunResult = await r.json();
      setResult(d);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) setShown(LINKS.length);
      else { let i = 0; timer.current = setInterval(() => { i += 1; setShown(i); if (i >= LINKS.length && timer.current) clearInterval(timer.current); }, 260); }
    } catch (e) {
      setResult({ verdict: "unverifiable", pass: false, reproduced: null, total: null, evidence: String(e) });
    } finally { setRunning(null); }
  }

  const byName = new Map((result?.run?.results ?? []).map((r) => [r.name, r]));
  const done = result && shown >= LINKS.length;

  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="font-mono text-[12px] uppercase tracking-[0.24em] text-brassLight">Community lane · Machine gate</div>
        <h1 className="mt-4 text-3xl font-medium leading-[1.06] tracking-tight sm:text-[42px]">
          <span className="text-brassLight">Who</span> said what, to whom — <span className="text-brassLight">recomputed</span>.
        </h1>
        <p className="mt-4 max-w-[56ch] font-serif text-[18px] leading-relaxed text-paper/70">
          This is how a capability <span className="text-paper font-medium">lists in the marketplace</span> — graded
          against hash-pinned golden vectors, no committee. And it's the account of an agent's action in the grammar
          people already trust: <em className="text-paper not-italic">who said what, through which channel, to whom,
          with what effect</em> — every link re-derivable from public data, <span className="text-paper">none of it taken on faith.</span>
        </p>

        {/* how it's used */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { n: "01", t: "Submit an MCP", d: "Point the gate at a capability + the golden-vector suite it claims." },
            { n: "02", t: "Recompute", d: "Every link is re-derived and matched. Reproduce them all and it passes — no human." },
            { n: "03", t: "Auto-list", d: "Deterministic → Recomputable badge, listed. Live-data → the Attested lane." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-white/[0.07] bg-ink/40 p-4">
              <div className="font-mono text-[12px] text-brassLight">{s.n}</div>
              <div className="mt-1 font-semibold">{s.t}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-paper/55">{s.d}</div>
            </div>
          ))}
        </div>

        {/* the chain */}
        <div className="mt-9 rounded-2xl border border-brassLight/30 bg-ink/60 p-5"
             style={{ boxShadow: "0 20px 50px -30px rgba(224,162,76,.25)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-paper/50">Recomputable suite · communication_chain.v0</div>
              <div className="mt-1 text-lg font-semibold">The Communication Chain</div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> recomputable
            </span>
          </div>

          <div className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {LINKS.map((l, i) => {
              const r = byName.get(l.name);
              const revealed = result && i < shown;
              const failed = revealed && r && !r.ok;
              const said = result?.tampered && l.tampered ? l.tampered : l.said;
              return (
                <div key={l.name} className={`grid grid-cols-[130px_1fr_auto] items-center gap-3 py-3 transition-opacity ${revealed || !result ? "opacity-100" : "opacity-35"}`}>
                  <div className="font-mono text-[12px] uppercase tracking-wide text-brassLight/90">{l.w}</div>
                  <div className="min-w-0">
                    <div className={`truncate text-[13.5px] ${failed ? "text-red-300" : "text-paper/90"}`}>{said}</div>
                    <div className="truncate font-mono text-[11px] text-paper/40">
                      {revealed && r ? (failed ? "does not reproduce the pinned record" : short(r.got?.value)) : l.note}
                    </div>
                  </div>
                  <div className="w-6">
                    {revealed && r
                      ? <span className={`inline-grid h-5 w-5 place-items-center rounded ${r.ok ? "bg-emerald-400/12 text-emerald-300" : "bg-red-400/15 text-red-400"}`}>{r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>
                      : running && i < 1 ? <Loader2 className="h-4 w-4 animate-spin text-paper/40" /> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => run(false)} disabled={!!running}
              className="inline-flex items-center gap-2 rounded-xl bg-brassLight px-5 py-3 font-display text-[14px] font-semibold text-deepink transition hover:bg-[#ecb264] disabled:opacity-60">
              {running === "compliant" ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</> : <><Cpu className="h-4 w-4" /> Recompute the claim</>}
            </button>
            <button onClick={() => run(true)} disabled={!!running}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/40 bg-red-400/[0.06] px-5 py-3 font-display text-[14px] font-semibold text-red-300 transition hover:bg-red-400/[0.12] disabled:opacity-60">
              {running === "tamper" ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</> : <><AlertTriangle className="h-4 w-4" /> Recompute a tampered claim</>}
            </button>
          </div>
          {done && <Verdict result={result!} />}
        </div>

        {/* lane note */}
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-[13px] text-paper/60">
          <span className="font-semibold text-paper">Two honest lanes.</span> Golden-vector conformance fits{" "}
          <span className="text-emerald-300">deterministic</span> capabilities — hashes, encodings, this chain — the{" "}
          <span className="text-emerald-300">Recomputable</span> lane. Live-data MCPs (DEX quotes, market reads) are
          non-deterministic and sit in the <span className="text-brassLight">Attested</span> lane, where the evidence is the
          WYRIWE action-recompute on <span className="font-mono">/verify</span>, not a golden-vector match.
        </div>
      </main>
    </div>
  );
}

function Verdict({ result }: { result: RunResult }) {
  const good = result.verdict === "verified-good";
  const c = good
    ? { b: "border-emerald-400/40", bg: "bg-emerald-400/10", t: "text-emerald-300", glow: "rgba(76,190,147,.4)" }
    : { b: "border-red-400/40", bg: "bg-red-400/10", t: "text-red-400", glow: "rgba(229,87,77,.35)" };
  return (
    <div className="mt-5 rounded-xl border border-white/[0.08] bg-deepink/40 p-4">
      <div className="flex items-center gap-3.5">
        <div className={`grid place-items-center rounded-xl border ${c.b} ${c.bg} ${c.t}`} style={{ height: 44, width: 44, boxShadow: `0 0 30px -6px ${c.glow}` }}>
          {good ? <ShieldCheck className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </div>
        <div>
          <div className="text-[17px] font-semibold">
            {result.reproduced}/{result.total} links reproduced — <span className={c.t}>{good ? "Recomputable" : "Not conformant"}</span>
          </div>
          <div className="text-[13px] text-paper/60">
            {good
              ? <><span className="font-semibold text-emerald-300">Every link re-derived, none trusted.</span> A compliant capability auto-lists — no human approved it.</>
              : <><span className="font-semibold text-red-400">“Said what” doesn't recompute.</span> The tampered claim can't reproduce the pinned record, so it fails the gate — live.</>}
          </div>
        </div>
      </div>
    </div>
  );
}
