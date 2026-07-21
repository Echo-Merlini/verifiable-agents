"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Loader2, Check, X, Link2, Cpu } from "lucide-react";
import { TopNav } from "@/components/TopNav";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

type Suite = {
  id: string; suite: string; label: string; tagline: string;
  vectors: number; vectorsSha256: string; lane: string;
};
type VecResult = { name: string; expected: any; got: any; ok: boolean };
type RunResult = {
  verdict: string; pass: boolean; gate?: string;
  reproduced: number | null; total: number | null;
  suiteMeta?: Suite; run?: { results?: VecResult[]; vectors_sha256?: string };
  evidence?: string;
};

const short = (h?: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");
const reason = (o: any) =>
  o && typeof o === "object" ? o.reason_code ?? JSON.stringify(o) : String(o);

export default function ConformancePage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [sel, setSel] = useState<Suite | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [shown, setShown] = useState(0); // how many vector rows revealed (animation)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${GW_URL}/conformance/suites`)
      .then((r) => r.json())
      .then((d) => { setSuites(d.suites || []); setSel((d.suites || [])[0] || null); })
      .catch(() => {});
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  async function run() {
    if (!sel || running) return;
    setRunning(true); setResult(null); setShown(0);
    try {
      const r = await fetch(`${GW_URL}/conformance/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite: sel.id }),
      });
      const d: RunResult = await r.json();
      setResult(d);
      // reveal the real per-vector results one by one (visual only; the run already happened)
      const rows = d.run?.results ?? [];
      const reduce = typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || rows.length === 0) { setShown(rows.length); }
      else {
        let i = 0;
        timer.current = setInterval(() => {
          i += 1; setShown(i);
          if (i >= rows.length && timer.current) clearInterval(timer.current);
        }, 120);
      }
    } catch (e) {
      setResult({ verdict: "unverifiable", pass: false, gate: "fail-closed (defer/deny)",
        reproduced: null, total: null, evidence: String(e) });
    } finally {
      setRunning(false);
    }
  }

  const rows = result?.run?.results ?? [];
  const verdict = result?.verdict;
  const done = result && shown >= rows.length;

  return (
    <div className="min-h-screen bg-deepink text-paper font-display">
      <TopNav />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        {/* header */}
        <div className="font-mono text-[12px] uppercase tracking-[0.24em] text-brassLight">
          Community lane · Machine gate
        </div>
        <h1 className="mt-4 text-3xl font-medium leading-[1.06] tracking-tight sm:text-[42px]">
          Listing is a <span className="text-brassLight">predicate</span>, not a permission.
        </h1>
        <p className="mt-4 max-w-[54ch] font-serif text-[18px] leading-relaxed text-paper/70">
          No committee reviews a submission. A capability is graded against a{" "}
          <span className="text-paper">hash-pinned</span> set of golden vectors — reproduce every one
          and it lists itself. <span className="text-paper">The vectors decide, not a human.</span>
        </p>

        {/* suite card */}
        {sel && (
          <div className="mt-8 rounded-2xl border border-brassLight/30 bg-ink/60 p-5"
               style={{ boxShadow: "0 20px 50px -30px rgba(224,162,76,.25)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-paper/50">
                  Recomputable suite
                </div>
                <div className="mt-1 text-lg font-semibold">{sel.label}</div>
                <div className="text-[13.5px] text-paper/60">{sel.tagline}</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> {sel.lane}
              </span>
            </div>
            <div className="mt-4 space-y-1.5 rounded-xl border border-dashed border-white/10 p-3.5">
              <Row k="vectors" v={`${sel.vectors} golden vectors`} />
              <Row k="vectors sha256" v={short(sel.vectorsSha256)} mono />
            </div>
            <div className="mt-3 flex items-start gap-2 text-[12px] text-paper/60">
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brassLight" />
              <span>Graded against this exact hash, not a moving file. A mismatch is{" "}
                <span className="font-mono">unverifiable</span>, never a silent pass.</span>
            </div>
            <button onClick={run} disabled={running}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brassLight px-5 py-3 font-display text-[14.5px] font-semibold text-deepink transition hover:bg-[#ecb264] disabled:opacity-60">
              {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Recomputing…</>
                       : <><Cpu className="h-4 w-4" /> Run conformance</>}
            </button>
          </div>
        )}

        {/* run panel */}
        {result && rows.length > 0 && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-ink/50 p-5">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold">
                Recomputing {rows.length} vectors — no human in the loop
                <div className="mt-0.5 font-mono text-[12px] font-normal text-paper/50">
                  suite verified · sha256 {short(result.run?.vectors_sha256)} ✓ matches
                </div>
              </div>
              <div className="font-mono text-[14px] text-emerald-300 tabular-nums">
                {Math.min(shown, rows.length)}/{rows.length}
              </div>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-gradient-to-r from-brass to-emerald-400 transition-[width] duration-200"
                   style={{ width: `${(Math.min(shown, rows.length) / rows.length) * 100}%` }} />
            </div>
            <div className="mt-3 border-t border-white/[0.06]">
              {rows.slice(0, shown).map((v) => (
                <div key={v.name}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.06] py-2 font-mono text-[12.5px]">
                  <span className="truncate text-paper/80">{v.name}</span>
                  <span className={`inline-grid h-5 w-5 place-items-center rounded ${v.ok ? "bg-emerald-400/12 text-emerald-300" : "bg-red-400/12 text-red-400"}`}>
                    {v.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* verdict */}
        {done && (
          <Verdict result={result!} />
        )}

        {/* lane note */}
        <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-[13px] text-paper/60">
          <span className="font-semibold text-paper">Two honest lanes.</span> Golden-vector conformance
          fits <span className="text-emerald-300">deterministic</span> capabilities — hashes,
          canonicalization, this continuity gate — the <span className="text-emerald-300">Recomputable</span> lane.
          Live-data MCPs (DEX quotes, market reads) are non-deterministic and sit in the{" "}
          <span className="text-brassLight">Attested</span> lane, where the evidence is the WYRIWE
          action-recompute on <span className="font-mono">/verify</span>, not a golden-vector match.
        </div>
      </main>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-[12.5px]">
      <span className="text-paper/50">{k}</span>
      <span className={mono ? "font-mono text-[12px] text-[#cdb58c]" : "text-paper/80"}>{v}</span>
    </div>
  );
}

function Verdict({ result }: { result: RunResult }) {
  const good = result.verdict === "verified-good";
  const bad = result.verdict === "verified-bad";
  const tone = good ? "emerald" : bad ? "red" : "amber";
  const c = {
    emerald: { b: "border-emerald-400/40", bg: "bg-emerald-400/10", t: "text-emerald-300", glow: "rgba(76,190,147,.4)" },
    red: { b: "border-red-400/40", bg: "bg-red-400/10", t: "text-red-400", glow: "rgba(229,87,77,.35)" },
    amber: { b: "border-brassLight/40", bg: "bg-brassLight/10", t: "text-brassLight", glow: "rgba(224,162,76,.35)" },
  }[tone];
  return (
    <div className="mt-6 rounded-2xl border border-white/[0.08] bg-ink/50 p-5">
      <div className="flex items-center gap-4">
        <div className={`grid h-13 w-13 shrink-0 place-items-center rounded-2xl border ${c.b} ${c.bg} ${c.t}`}
             style={{ height: 52, width: 52, boxShadow: `0 0 34px -6px ${c.glow}` }}>
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <div className="text-[20px] font-semibold">
            {result.reproduced}/{result.total} reproduced —{" "}
            <span className={c.t}>{good ? "Recomputable" : bad ? "Not conformant" : "Unverifiable"}</span>
          </div>
          <div className="text-[13.5px] text-paper/60">
            {good ? <><span className="font-semibold text-emerald-300">Auto-listed.</span> No human approved this — the vectors did.</>
              : bad ? "A vector didn't reproduce — not listed. The failing vector says where."
              : <><span className="font-semibold text-brassLight">Fail-closed.</span> The gate couldn't establish the result — never a silent pass.</>}
          </div>
        </div>
      </div>
      {result.suiteMeta && good && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 font-mono text-[11.5px] text-paper/60">
          recorded against {result.suiteMeta.id} · {short(result.suiteMeta.vectorsSha256)} · re-run it yourself
        </div>
      )}
    </div>
  );
}
