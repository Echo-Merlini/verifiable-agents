"use client";

import { useEffect, useState } from "react";
import { Check as CheckIcon, X as XIcon, HelpCircle, Loader2, ShieldCheck, ArrowRight, Wand2, RotateCcw, RefreshCw, Radio, ExternalLink } from "lucide-react";
import { verifyAll, keccakUtf8, type Showcase, type Check } from "@/lib/verify";
import { readLiveRecord } from "@/lib/liveRecord";
import { TopNav } from "@/components/TopNav";

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

// The showcase action's recompute artifact is really stored on 0G — fetch it back, recompute its
// content-addressed root, AND bind the bytes to the Ethereum anchor: the manifest 0G serves must
// declare the exact hashes /verify confirmed on-chain. So each surface proves a different property —
// Ethereum the commitment, 0G the availability — and they're bound to the same action.
function ZeroGEvidence({ sc }: { sc: Showcase }) {
  const z = sc.zerog;
  const [state, setState] = useState<"idle" | "fetching" | "ok" | "bad" | "err">("idle");
  const [msg, setMsg] = useState("");
  if (!z) return null;
  // The anchor these bytes are bound to lives on mainnet (showcase) or Base Sepolia (live actions).
  const anchorTxUrl = sc.l3ChainId === 84532
    ? `https://sepolia.basescan.org/tx/${sc.l3Tx}`
    : `https://etherscan.io/tx/${sc.l3Tx}`;
  const anchorChain = sc.l3ChainId === 84532 ? "Base Sepolia" : "mainnet";
  async function post(body: object) {
    return fetch("/api/storage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  }
  async function fetchVerify() {
    setState("fetching"); setMsg("");
    try {
      // 1 · pull the bytes back FROM 0G by root (availability)
      const f = await post({ action: "fetch", rootHash: z!.root });
      if (f.error || f.content == null) { setState("err"); setMsg(f.error || "no content"); return; }
      // 2 · recompute 0G's content-addressed root from those bytes (content-addressing)
      const re = await post({ action: "root", content: f.content });
      if (re.rootHash !== z!.root) { setState("bad"); setMsg(`recomputed ${re.rootHash} ≠ committed root`); return; }
      // 3 · bind: the manifest 0G serves must declare the SAME hashes Ethereum anchored — else 0G is
      //     just holding *some* bytes, unconnected to the on-chain commitment.
      const eq = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
      const fields: [string, string | undefined, string | undefined][] = (() => {
        try {
          const m = JSON.parse(f.content);
          return [
            ["rawInputHash", m.rawInputHash, sc.rawInputHash],
            ["inputHash", m.inputHash, sc.inputHash],
            ["outputHash", m.outputHash, sc.outputHash],
            ["manifestHash", m.manifestHash, sc.manifestHash],
            ["l3Tx", m.l3Tx, sc.l3Tx],
            ["ocpContract", m.ocpContract, sc.ocpContract],
          ];
        } catch { return []; }
      })();
      if (!fields.length) { setState("bad"); setMsg(`fetched ${f.bytes} bytes · 0G root matches · but the manifest isn't the expected JSON`); return; }
      const mism = fields.filter(([, a, b]) => !eq(a, b)).map(([k]) => k);
      const bound = mism.length === 0;
      setState(bound ? "ok" : "bad");
      setMsg(bound
        ? `fetched ${f.bytes} bytes · 0G root matches · ${fields.length}/${fields.length} anchor fields bound to ${anchorChain}`
        : `fetched ${f.bytes} bytes · 0G root matches · but the manifest diverges from the on-chain anchor: ${mism.join(", ")}`);
    } catch (e: unknown) { setState("err"); setMsg(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logos/0g.jpg" alt="0G" className="h-5 w-5 rounded-md object-cover" />
          <span className="font-display text-[15px] text-paper">Evidence on 0G</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">{z.network}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">Ethereum proves the <span className="text-paper/70">commitment</span>; 0G proves <span className="text-paper/70">availability</span>. The manifest anyone recomputes this action from ({z.bytes} bytes) lives on decentralized storage, content-addressed — and its hashes bind back to the on-chain anchor.</p>
      <div className="mt-3 space-y-1 font-mono text-[11px]">
        <div><span className="text-paper/40">root </span><span className="break-all text-paper/80">{z.root}</span></div>
        <div>
          <span className="text-paper/40">store tx </span>
          <a href={`https://chainscan-galileo.0g.ai/tx/${z.tx}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-brassLight/80 underline decoration-brassLight/25 underline-offset-2 hover:text-brassLight">
            {z.tx}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <div>
          <span className="text-paper/40">binds to </span>
          <a href={anchorTxUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-brassLight/80 underline decoration-brassLight/25 underline-offset-2 hover:text-brassLight">
            {anchorChain} anchor {sc.l3Tx}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={fetchVerify} disabled={state === "fetching"}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {state === "fetching" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Fetch, recompute &amp; bind
        </button>
        {state === "ok" && <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300"><CheckIcon className="h-3.5 w-3.5" /> {msg}</span>}
        {state === "bad" && <span className="text-[12px] text-red-300">{msg}</span>}
        {state === "err" && <span className="text-[12px] text-amber-300">could not reach 0G — {msg}</span>}
      </div>
    </div>
  );
}

// The same OCP anchor, indexed and queryable via The Graph — an independent read-path.
// Queries by the digest RECOMPUTED from the (maybe edited) query, so a tamper makes the
// subgraph return nothing (red), exactly like the on-chain spine. Ethereum proves the
// commitment; The Graph proves it's queryable — and the two reads must agree.
function GraphEvidence({ sc, query }: { sc: Showcase; query: string }) {
  const [state, setState] = useState<"idle" | "querying" | "ok" | "bad" | "err">("idle");
  const [msg, setMsg] = useState("");
  // A subgraph per network indexes the OCP anchor — mainnet (showcase) or Base Sepolia (live).
  if (!sc.l3Tx) return null;
  const chainLabel = sc.l3ChainId === 84532 ? "Base Sepolia" : "mainnet";
  async function queryIndex() {
    setState("querying"); setMsg("");
    try {
      const digest = keccakUtf8(query); // recomputed from the editable query — tamper-sensitive
      const r = await fetch("/api/anchor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ digest, chainId: sc.l3ChainId }) }).then((x) => x.json());
      if (r.error) { setState("err"); setMsg(r.error); return; }
      const a = r.anchor;
      if (!a) { setState("bad"); setMsg(`no anchor indexed for digest ${short(digest)} — this query was never committed`); return; }
      const agree = a.digest?.toLowerCase() === digest.toLowerCase() && a.txHash?.toLowerCase() === sc.l3Tx?.toLowerCase();
      setState(agree ? "ok" : "bad");
      setMsg(agree
        ? `The Graph returns the same anchor the RPC read did · tx ${short(a.txHash)} · block ${a.blockNumber}`
        : `subgraph anchor disagrees with the on-chain read (tx ${short(a.txHash)})`);
    } catch (e: unknown) { setState("err"); setMsg(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logos/thegraph.webp" alt="The Graph" className="h-5 w-5 rounded-full object-contain" />
          <span className="font-display text-[15px] text-paper">Queryable on The Graph</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">Subgraph · {chainLabel}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">Ethereum proves the <span className="text-paper/70">commitment</span>; The Graph proves it&apos;s <span className="text-paper/70">queryable</span>. A subgraph indexes the OCP <span className="font-mono text-paper/70">Recorded</span> events — an independent read-path that must agree with the raw RPC log read.</p>
      <div className="mt-3 space-y-1 font-mono text-[11px]">
        <div><span className="text-paper/40">query </span><span className="break-all text-paper/80">{"anchors(where: { digest }) { txHash · committer · blockNumber }"}</span></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={queryIndex} disabled={state === "querying"}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {state === "querying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Query the index
        </button>
        {state === "ok" && <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300"><CheckIcon className="h-3.5 w-3.5" /> {msg}</span>}
        {state === "bad" && <span className="text-[12px] text-red-300">{msg}</span>}
        {state === "err" && <span className="text-[12px] text-amber-300">could not reach The Graph — {msg}</span>}
      </div>
    </div>
  );
}

// A SECOND on-chain commitment: the same digest anchored on 0G Chain (Galileo EVM testnet).
// Reads the record() tx's Recorded event via a same-origin proxy and confirms topic1 equals
// the digest recomputed from the (maybe edited) query — so a tamper breaks this too. One
// action, two independent chains: Ethereum and 0G Chain both hold the same commitment.
function ZeroGChainEvidence({ sc, query }: { sc: Showcase; query: string }) {
  const zc = sc.zerogChain;
  const [state, setState] = useState<"idle" | "reading" | "ok" | "bad" | "err">("idle");
  const [msg, setMsg] = useState("");
  if (!zc) return null;
  async function read() {
    setState("reading"); setMsg("");
    try {
      const digest = keccakUtf8(query); // recomputed from the editable query — tamper-sensitive
      const r = await fetch("/api/anchor-0g", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: zc!.tx }) }).then((x) => x.json());
      if (r.error) { setState("err"); setMsg(r.error); return; }
      if (r.status !== "0x1") { setState("bad"); setMsg(`record() tx did not succeed (status ${r.status})`); return; }
      const agree = r.digest?.toLowerCase() === digest.toLowerCase();
      setState(agree ? "ok" : "bad");
      setMsg(agree
        ? `0G Chain holds the same digest · block ${r.blockNumber} · committer ${short(r.committer)}`
        : `0G Chain digest ${short(r.digest)} ≠ recomputed ${short(digest)}`);
    } catch (e: unknown) { setState("err"); setMsg(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logos/0g.jpg" alt="0G Chain" className="h-5 w-5 rounded-md object-cover" />
          <span className="font-display text-[15px] text-paper">Second anchor on 0G Chain</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">{zc.network}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">The same commitment, anchored a <span className="text-paper/70">second time on an independent chain</span>. One action; Ethereum and 0G Chain both hold its digest — tamper the query and neither matches.</p>
      <div className="mt-3 space-y-1 font-mono text-[11px]">
        <div>
          <span className="text-paper/40">contract </span>
          <a href={`${zc.explorer}/address/${zc.contract}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-brassLight/80 underline decoration-brassLight/25 underline-offset-2 hover:text-brassLight">
            {zc.contract}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <div>
          <span className="text-paper/40">record tx </span>
          <a href={`${zc.explorer}/tx/${zc.tx}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-brassLight/80 underline decoration-brassLight/25 underline-offset-2 hover:text-brassLight">
            {zc.tx}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={read} disabled={state === "reading"}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {state === "reading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Read the 0G Chain anchor
        </button>
        {state === "ok" && <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300"><CheckIcon className="h-3.5 w-3.5" /> {msg}</span>}
        {state === "bad" && <span className="text-[12px] text-red-300">{msg}</span>}
        {state === "err" && <span className="text-[12px] text-amber-300">could not reach 0G Chain — {msg}</span>}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const [sc, setSc] = useState<Showcase | null>(null);
  const [query, setQuery] = useState("");          // editable → powers the user-side tamper test
  const [reply, setReply] = useState("");          // editable when focus=agent → powers the output-side tamper
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [focus, setFocus] = useState<"user" | "agent" | null>(null);

  useEffect(() => {
    // ?live=1 → recompute the action the agent JUST took (stashed by /demo), not the baked showcase.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("live") === "1") {
      const f = new URLSearchParams(window.location.search).get("focus");
      if (f === "user" || f === "agent") setFocus(f);
      const rec = readLiveRecord();
      if (rec) { setSc(rec); setQuery(rec.query); setReply(rec.reply); setLive(true); return; }
    }
    fetch(SHOWCASE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Showcase) => { setSc(d); setQuery(d.query); setReply(d.reply); })
      .catch(() => setErr("Couldn't load the showcase attestation."));
  }, []);

  const editingAgent = focus === "agent";   // agent-side view → tamper the reply (output), not the query
  const tampered = !!sc && (query !== sc.query || reply !== sc.reply);

  // Recompute against specific query/reply values (so tamper/restore can run the new value
  // immediately, without waiting on a state update).
  async function run(q: string = query, r: string = reply) {
    if (!sc) return;
    setRunning(true); setRan(false);
    const result = await verifyAll({ ...sc, query: q, reply: r });   // recompute against the (maybe edited) preimages
    setChecks(result);
    setRunning(false); setRan(true);
  }

  function tamper() {
    if (!sc) return;
    if (editingAgent) { const r = tamperOneChar(reply || sc.reply); setReply(r); run(query, r); }
    else { const q = tamperOneChar(query || sc.query); setQuery(q); run(q, reply); }
  }
  function restore() { if (!sc) return; setQuery(sc.query); setReply(sc.reply); run(sc.query, sc.reply); }

  const allOk = ran && checks.length > 0 && checks.every((c) => c.status === "pass");
  const anyFail = ran && checks.some((c) => c.status === "fail");
  const anyAmber = ran && checks.some((c) => c.status === "unverifiable");
  const failed = anyFail;                    // a real mismatch
  const amber = !anyFail && anyAmber;        // couldn't fully check, but nothing mismatched

  return (
    <main className="min-h-screen bg-deepink text-paper">
      <TopNav />
      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brassLight/80">Don&apos;t trust. Recompute.</span>

        <h1 className="mt-4 font-display font-medium tracking-tightest text-4xl sm:text-5xl">
          Verify it <span className="brass-text">yourself.</span>
        </h1>
        <p className="mt-4 text-gb-muted max-w-xl">
          A real on-chain agent action, attested in and out. Every hash is re-derived
          <span className="text-paper"> in your browser</span>, the anchor is read straight from {sc?.l3ChainId === 84532 ? "Base" : "mainnet"},
          and the attestation signer is recovered. Nothing is trusted — so don&apos;t take our word for it, break it.
        </p>

        {live && sc && (
          <div className="mt-5 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/5 px-3.5 py-1.5 text-[12px] text-emerald-300">
              <Radio className="w-3.5 h-3.5" /> Live — recomputing the action <span className="font-medium">{sc.ens}</span> just took. Not a saved demo; the one you watched.
            </div>
            {focus && (
              <p className="max-w-xl text-[12px] text-gb-muted">
                {focus === "user"
                  ? <>Focus: the <span className="text-paper">user&apos;s action</span> — the exact input the agent received. Checks <span className="text-brassLight">1–2</span> (raw input + provenance) prove it; all five still recompute below.</>
                  : <>Focus: the <span className="text-paper">agent&apos;s action</span> — its output, anchored on-chain and signed. Checks <span className="text-brassLight">3–5</span> (output + on-chain anchor + signature) prove it; all five still recompute below.</>}
              </p>
            )}
          </div>
        )}

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
                <label className="block font-mono text-[11px] uppercase tracking-wide text-gb-muted">
                  {editingAgent ? "Reply — the agent's output (edit to tamper)" : "Query — the public input the agent was given"}
                </label>
                <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full shrink-0 ${tampered ? "bg-red-500/15 text-red-300" : "bg-emerald-400/10 text-emerald-300/80"}`}>
                  {tampered ? "tampered" : "original"}
                </span>
              </div>
              <textarea
                value={editingAgent ? reply : query}
                onChange={(e) => (editingAgent ? setReply(e.target.value) : setQuery(e.target.value))}
                rows={editingAgent ? 4 : 3}
                spellCheck={false}
                className={`mt-2 w-full rounded-xl border bg-black/20 px-4 py-3 text-sm font-mono outline-none transition-colors ${tampered ? "border-red-500/50 text-red-300" : "border-white/10 text-paper focus:border-brassLight/50"}`}
              />
              <p className="mt-1.5 text-[11px] text-gb-faint">Type in here to change the {editingAgent ? "agent's reply" : "input"} — or use <span className="text-brassLight/80">Tamper a byte</span> below. The committed hash on-chain doesn&apos;t move, so any change must break the match.</p>

              <p className="mt-4 font-mono text-[11px] uppercase tracking-wide text-gb-muted">{editingAgent ? "Query — the input the agent was given" : "Reply — what the agent returned"}</p>
              <p className="mt-1 text-sm text-gb-faint whitespace-pre-wrap line-clamp-4">{editingAgent ? sc.query : sc.reply}</p>
            </div>

            {/* Live keccak of the currently-edited preimage */}
            <div className="mt-3 font-mono text-[11px] text-gb-faint">
              keccak256(utf8({editingAgent ? "reply" : "query"})) = <span className={tampered ? "text-red-300" : "text-brassLight/90"}>{short(keccakUtf8(editingAgent ? reply : query))}</span>
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

                {sc?.zerog && <ZeroGEvidence sc={sc} />}
                {sc?.zerogChain && <ZeroGChainEvidence sc={sc} query={query} />}
                {sc && <GraphEvidence sc={sc} query={query} />}
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
