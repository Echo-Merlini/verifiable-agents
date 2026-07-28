"use client";

import { useEffect, useRef, useState } from "react";
import { Check as CheckIcon, X as XIcon, HelpCircle, Loader2, ShieldCheck, ArrowRight, Wand2, RotateCcw, RefreshCw, Radio, ExternalLink, Fingerprint } from "lucide-react";
import { verifyAll, keccakUtf8, readOwnerOf, resolveEnsIdentity, readEnsText, type Showcase, type Check } from "@/lib/verify";
import { readLiveRecord, refreshLiveRecord } from "@/lib/liveRecord";
import { TopNav } from "@/components/TopNav";
import { TeeInferenceEvidence, type TeeSummary } from "@/components/TeeInferenceEvidence";
import { EnclaveQuoteEvidence, type EnclaveSummary } from "@/components/EnclaveQuoteEvidence";

const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

// Self-contained: a real mainnet attestation baked to /showcase.json. The recompute
// still runs live in the browser + reads mainnet — only the record fetch is frozen,
// so the demo works offline / without the gateway. (Swap for a fresh run anytime.)
const SHOWCASE_URL = process.env.NEXT_PUBLIC_SHOWCASE_URL || "/showcase.json";
const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");

// Standards badge — surfaces which ERC / ENSIP / EIP each check or panel implements, so a
// judge watching /verify can see exactly which standard is being recomputed in real time.
function StdBadge({ children }: { children: string }) {
  return <span className="shrink-0 rounded-md border border-brassLight/25 bg-brassLight/[0.06] px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-brassLight/80">{children}</span>;
}
const CHECK_STANDARD: Record<string, string> = {
  raw: "ERC-8299", input: "ERC-8299", out: "ERC-8281", l3: "ERC-8281", l4: "EIP-712",
};

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
          <StdBadge>ERC-8281</StdBadge>
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
      // The where:{digest} filter means every returned anchor commits THIS digest. Tampering the
      // query → new digest → the filter returns nothing → red. An identical input is anchored by
      // many txs (each re-run calls record() again), so agreement = the commitment is indexed; the
      // exact tx match only strengthens the wording when this action's tx has been indexed.
      const anchors: Array<{ digest?: string; txHash?: string; blockNumber?: string }> = r.anchors ?? (r.anchor ? [r.anchor] : []);
      const indexed = anchors.filter((x) => x.digest?.toLowerCase() === digest.toLowerCase());
      if (!indexed.length) { setState("bad"); setMsg(`no anchor indexed for digest ${short(digest)} — this query was never committed`); return; }
      const exact = indexed.find((x) => x.txHash?.toLowerCase() === sc.l3Tx?.toLowerCase());
      setState("ok");
      setMsg(exact
        ? `The Graph returns the same anchor the RPC read did · tx ${short(exact.txHash!)} · block ${exact.blockNumber}`
        : `The Graph indexes this commitment · ${indexed.length} anchor${indexed.length > 1 ? "s" : ""} share this digest · latest tx ${short(indexed[0].txHash!)} · block ${indexed[0].blockNumber}`);
    } catch (e: unknown) { setState("err"); setMsg(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logos/thegraph.webp" alt="The Graph" className="h-5 w-5 rounded-full object-contain" />
          <span className="font-display text-[15px] text-paper">Queryable on The Graph</span>
          <StdBadge>ERC-8281</StdBadge>
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
          <StdBadge>ERC-8281</StdBadge>
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

// ERC-8323 Source-Token Agent Binding — the ACTOR's identity, recomputed. The agent NFT is only
// as sovereign as the source token behind it: the binding is live iff the source token is
// controlled by the agent's holder (case a). This re-reads BOTH ownerOf's in the visitor's
// browser — "a provable action, taken by a provably-bound identity." Peer mesh consensus (each
// node re-derives from its own RPC) is shown as non-self-attested corroboration.
type Binding = {
  registry: string; agentId: string;
  source_contract?: string; source_token_id?: string;
  ens_name?: string | null;
  status?: string; matchedCase?: string; sourceOwner?: string; agentHolder?: string;
  mesh?: { agree?: number; dissent?: number; consensus?: string };
};
function IdentityBindingEvidence({ sc }: { sc: Showcase }) {
  const [b, setB] = useState<Binding | null>(null);
  const [state, setState] = useState<"idle" | "recomputing" | "ok" | "bad" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [rec, setRec] = useState<{ so?: string | null; ah?: string | null } | null>(null);
  const [ens, setEns] = useState<{ name: string; verified: boolean } | null>(null);
  const [ensip, setEnsip] = useState<{ name: string; registered: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${GW}/agent/${sc.registry}/${sc.agentId}/binding?mesh=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Binding | null) => { if (alive && data && data.source_contract && data.source_token_id) setB(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sc.registry, sc.agentId]);
  if (!b || !b.source_contract || !b.source_token_id) return null;

  async function recompute() {
    setState("recomputing"); setMsg("");
    const [so, ah] = await Promise.all([
      readOwnerOf(b!.source_contract!, b!.source_token_id!),
      readOwnerOf(sc.registry, sc.agentId),
    ]);
    setRec({ so, ah });
    if (!so || !ah) { setState("err"); setMsg("could not read ownerOf — RPC unavailable, retry"); return; }
    // The human apex: reverse-resolve the holder to its ENS primary name (forward-verified).
    resolveEnsIdentity(ah).then(setEns).catch(() => setEns(null));
    // ENSIP-25 forward binding: the agent's registered ENS name declares THIS agent. Reconstruct
    // the agent-registration key (chain-1 EVM prefix + registry + agentId) and read it off the
    // name via the universal resolver — "1" ⇒ the name names this exact agent.
    if (b!.ens_name) {
      const key = `agent-registration[0x00010000010114${sc.registry.slice(2).toLowerCase()}][${sc.agentId}]`;
      readEnsText(b!.ens_name, key)
        .then((v) => setEnsip({ name: b!.ens_name as string, registered: v === "1" }))
        .catch(() => setEnsip(null));
    }
    if (so.toLowerCase() === ah.toLowerCase()) {
      setState("ok"); setMsg(`source token & agent both owned by ${short(ah)} — binding live (holder), recomputed in your browser`);
    } else if (b!.status === "valid") {
      // case (b) ERC-6551 TBA / (c) binding contract — the sovereign paths the gateway verdict covers
      setState("ok"); setMsg(`binding live (${b!.matchedCase}) — source owner ${short(so)} is the agent's ${b!.matchedCase}`);
    } else {
      setState("bad"); setMsg(`source owner ${short(so)} ≠ agent holder ${short(ah)} — binding no longer live`);
    }
  }

  const mesh = b.mesh;
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2">
        {b.ens_name
          ? <img src="/logos/ens.png" alt="ENS" className="h-4 w-auto" />
          : <Fingerprint className="h-4 w-4 text-brassLight" />}
        <span className="font-display text-[15px] text-paper">Identity binding · ERC-8323</span>
        <StdBadge>ERC-8004</StdBadge>
        <StdBadge>ENSIP-25</StdBadge>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">Who took this action is provable too. The agent NFT is bound to a <span className="text-paper/70">source token</span> — live only while the source is controlled by the agent&apos;s holder — and the holder carries an <span className="text-paper/70">ENS name</span>. Re-read both owners, and reverse-resolve the holder&apos;s name, in your browser.</p>
      <div className="mt-3 space-y-1 font-mono text-[11px]">
        <div>
          <span className="text-paper/40">source token </span>
          <a href={`https://opensea.io/assets/ethereum/${b.source_contract}/${b.source_token_id}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 break-all text-brassLight/80 underline decoration-brassLight/25 underline-offset-2 hover:text-brassLight">
            {short(b.source_contract)} #{b.source_token_id}<ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <div><span className="text-paper/40">agent </span><span className="text-paper/80">{short(sc.registry)} #{sc.agentId}</span></div>
        {b.ens_name && <div><span className="text-paper/40">ENS name </span><span className="text-paper/80">{b.ens_name}</span></div>}
        {rec?.so && <div><span className="text-paper/40">source owner </span><span className="break-all text-paper/80">{rec.so}</span></div>}
        {rec?.ah && <div><span className="text-paper/40">agent holder </span><span className="break-all text-paper/80">{rec.ah}</span></div>}
        {ens?.name && (
          <div>
            <span className="text-paper/40">ENS identity </span>
            <span className="text-paper/80">{ens.name}</span>{" "}
            {ens.verified
              ? <span className="text-emerald-300/80">· reverse + forward verified</span>
              : <span className="text-amber-300/70">· reverse only (unverified)</span>}
          </div>
        )}
        {ensip?.name && (
          <div>
            <span className="text-paper/40">ENSIP-25 </span>
            <span className="text-paper/80">{ensip.name}</span>{" "}
            {ensip.registered
              ? <span className="text-emerald-300/80">· names this agent (registered)</span>
              : <span className="text-amber-300/70">· no registration record for this agent</span>}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={recompute} disabled={state === "recomputing"}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {state === "recomputing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recompute the binding
        </button>
        {state === "ok" && <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300"><CheckIcon className="h-3.5 w-3.5" /> {msg}</span>}
        {state === "bad" && <span className="text-[12px] text-red-300">{msg}</span>}
        {state === "err" && <span className="text-[12px] text-amber-300">{msg}</span>}
      </div>
      {mesh && (mesh.agree ?? 0) > 0 && (
        <p className="mt-2 text-[11px] text-paper/40">Non-self-attested: {mesh.agree} peer node{mesh.agree === 1 ? "" : "s"} independently recomputed this from their own RPC · <span className={mesh.consensus === "confirmed" ? "text-emerald-300/70" : "text-paper/50"}>{mesh.consensus}</span></p>
      )}
    </div>
  );
}

// A printed-receipt keepsake summarising the whole recompute — the attested exchange (the
// EDITABLE query/reply, so a tamper shows here too), the 5 live checks, the anchoring surfaces
// (each a clickable link to its explorer), and the identity. Cream paper on the dark page.
function RecomputeReceipt({ sc, checks, query, reply, tee, enclave }: { sc: Showcase; checks: Check[]; query: string; reply: string; tee?: TeeSummary | null; enclave?: EnclaveSummary | null }) {
  const [ens, setEns] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${GW}/agent/${sc.registry}/${sc.agentId}/binding`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.ens_name) setEns(d.ens_name); })
      .catch(() => {});
    return () => { alive = false; };
  }, [sc.registry, sc.agentId]);
  const allPass = checks.length > 0 && checks.every((c) => c.status === "pass");
  const anyFail = checks.some((c) => c.status === "fail");
  const mk = (s: string) => (s === "pass" ? "✓" : s === "fail" ? "✗" : "~");
  const surfaceMark = anyFail ? "✗" : allPass ? "✓" : "·";
  const isBase = sc.l3ChainId === 84532;
  const chainLabel = isBase ? "Base Sepolia" : "mainnet";
  const scan = isBase ? "https://sepolia.basescan.org" : "https://etherscan.io";
  const graphUrl = `https://thegraph.com/studio/subgraph/recomputable-agents-anchor${isBase ? "-base" : ""}`;
  const trunc = (s: string, n = 150) => (s.length > n ? s.slice(0, n) + "…" : s);
  const Row = ({ label, val, href }: { label: string; val: string; href?: string }) => (
    <div className="flex items-baseline gap-1.5">
      {href
        ? <a href={href} target="_blank" rel="noreferrer" className="underline decoration-[#1a1a1a]/30 underline-offset-2 hover:decoration-[#1a1a1a]">{label} ↗</a>
        : <span>{label}</span>}
      <span className="min-w-[10px] flex-1 -translate-y-[3px] border-b border-dotted border-[#1a1a1a]/25" />
      <span className="tabular-nums">{val}</span>
    </div>
  );
  return (
    <div className="mx-auto mt-8 max-w-sm rounded-md bg-[#f6f2e8] text-[#1a1a1a] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)]">
      <div className="border-y-2 border-dashed border-[#1a1a1a]/20 px-7 py-6 font-mono text-[11px] leading-[1.7]">
        <div className="text-center">
          <p className="font-display text-[15px] tracking-tight">RECOMPUTE RECEIPT</p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-[#1a1a1a]/50">Don&apos;t trust. Recompute.</p>
        </div>
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <Row label={ens || sc.ens} val={`#${sc.agentId}`} href={ens ? `https://app.ens.domains/${ens}` : undefined} />
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#1a1a1a]/45">Attested exchange · the preimage</p>
        <p className="whitespace-pre-wrap break-words text-[#1a1a1a]/85"><span className="text-[#1a1a1a]/45">in&nbsp;&nbsp;</span>&ldquo;{query}&rdquo;</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[#1a1a1a]/85"><span className="text-[#1a1a1a]/45">out&nbsp;</span>&ldquo;{trunc(reply)}&rdquo;</p>
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#1a1a1a]/45">Recompute · in your browser</p>
        {checks.map((c) => <Row key={c.id} label={c.label} val={mk(c.status)} />)}
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#1a1a1a]/45">Surfaces · one action, verified across</p>
        <Row label={`Ethereum · ${chainLabel}`} val={surfaceMark} href={sc.l3Tx ? `${scan}/tx/${sc.l3Tx}` : undefined} />
        {sc.zerogChain && <Row label="0G Chain · 2nd commit" val={surfaceMark} href={`${sc.zerogChain.explorer}/tx/${sc.zerogChain.tx}`} />}
        {sc.zerog && <Row label="0G Storage · availability" val={surfaceMark} href={`https://chainscan-galileo.0g.ai/tx/${sc.zerog.tx}`} />}
        <Row label="The Graph · queryable" val={surfaceMark} href={graphUrl} />
        <Row label="Identity · ERC-8323 + ENS" val={ens ? "✓" : "·"} href={ens ? `https://app.ens.domains/${ens}` : undefined} />
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#1a1a1a]/45">0G TeeML relay · by evidence class</p>
        {(() => {
          const m = (st?: string) => (st === "verified" ? "✓" : st === "rejected" ? "✗" : st === "unverifiable" ? "~" : "·");
          return <>
            <Row label="broker signature · recomputed (EIP-191)" val={m(tee?.sig)} />
            <Row label="response binding · recomputed" val={m(tee?.resp)} />
            <Row label="request binding · broker-asserted" val={m(tee?.req)} />
            <Row label="enclave quote · no local quote" val={m(tee?.enclave)} />
          </>;
        })()}
        <p className="mt-1 text-[8px] leading-snug text-[#1a1a1a]/45">~ = honest amber: broker-asserted or no-local-quote (relay), never a silent ✓ — not an enclave attestation</p>
        <div className="my-3 border-t border-dotted border-[#1a1a1a]/25" />
        <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#1a1a1a]/45">0G TeeML enclave · mainnet GLM-5 (real TDX quote)</p>
        {(() => {
          const m = (st?: string) => (st === "verified" ? "✓" : st === "rejected" ? "✗" : st === "unverifiable" ? "~" : "·");
          return <>
            <Row label="enclave quote · TDX" val={m(enclave?.quote)} />
            <Row label="RTMR chain · recomputed" val={m(enclave?.rtmr)} />
            <Row label="signer binding · recomputed" val={m(enclave?.binding)} />
            <Row label="MRTD · recomputed" val={m(enclave?.mrtd)} />
          </>;
        })()}
        <p className="mt-1 text-[8px] leading-snug text-[#1a1a1a]/45">+ 2 residual trust roots (Intel PCS signature · known-good image) — honest amber, not yet closed</p>
        <div className="my-3 border-t border-dashed border-[#1a1a1a]/30" />
        <div className="text-center">
          <p className="font-display text-[13px]">{anyFail ? "✗  TAMPER DETECTED" : allPass ? "✓  RECOMPUTED" : "— PRESS VERIFY —"}</p>
          <p className="mt-2 break-all text-[8px] leading-snug text-[#1a1a1a]/45">{sc.rawInputHash}</p>
          <p className="mt-2 text-[9px] uppercase tracking-[0.22em] text-[#1a1a1a]/40">no trust required · shipped by Vértice</p>
        </div>
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
  const [tee, setTee] = useState<TeeSummary | null>(null);   // TEE-inference lane result → surfaced in the receipt
  const [enclave, setEnclave] = useState<EnclaveSummary | null>(null);   // genuine-enclave lane → receipt
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

  // Live 0G Storage / 0G Chain (and a late L3) anchors are written best-effort a few seconds AFTER
  // the action, so a record stashed the instant the reply landed can miss them — leaving the 0G
  // panels hidden. Poll the gateway and merge the fields in when they arrive, so the panels appear
  // without re-running the action. Stops once all present or after ~30s.
  const scRef = useRef<Showcase | null>(null);
  scRef.current = sc;
  useEffect(() => {
    if (!live) return;
    let cancelled = false, tries = 0;
    const id = setInterval(async () => {
      const cur = scRef.current;
      if (!cur || (cur.zerog && cur.zerogChain && cur.l3Tx) || tries >= 8) { clearInterval(id); return; }
      tries++;
      const merged = await refreshLiveRecord(cur);
      if (!cancelled && (merged.zerog !== cur.zerog || merged.zerogChain !== cur.zerogChain || merged.l3Tx !== cur.l3Tx)) setSc(merged);
    }, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [live]);

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
  // Swap the recompute perspective (user input ↔ agent output) IN-PAGE — no round-trip to /demo,
  // which re-mounts the chat and wipes it. Reset both preimages so the new side starts untampered,
  // and re-run if we'd already verified so the rows refresh green for the new focus.
  function swapFocus(f: "user" | "agent") {
    setFocus(f);
    if (!sc) return;
    setQuery(sc.query); setReply(sc.reply);
    if (ran) run(sc.query, sc.reply);
  }

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

              {/* Swap the recompute perspective in-page — no round-trip to /demo (which clears the chat). */}
              <div className="mt-5">
                <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1 text-[12px]" role="tablist" aria-label="Recompute perspective">
                  {([["user", "User action"], ["agent", "Agent action"]] as const).map(([f, label]) => {
                    const on = (focus ?? "user") === f;
                    return (
                      <button key={f} type="button" role="tab" aria-selected={on} onClick={() => swapFocus(f)}
                        className={`rounded-full px-4 py-1.5 font-medium transition-colors ${on ? "bg-brass text-ink" : "text-paper/60 hover:text-paper"}`}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-gb-faint">
                  {editingAgent
                    ? <>Recomputing the agent&apos;s <span className="text-paper/70">output</span> — tamper the reply below. Checks <span className="text-brassLight/80">3–5</span> prove it.</>
                    : <>Recomputing the user&apos;s <span className="text-paper/70">input</span> — tamper the query below. Checks <span className="text-brassLight/80">1–2</span> prove it.</>}
                  {" "}All five recompute either way.
                </p>
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
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display font-medium">{c.label} <span className="ml-1 font-mono text-[10px] text-brassLight/70">{c.recipe}</span></p>
                          {CHECK_STANDARD[c.id] && <StdBadge>{CHECK_STANDARD[c.id]}</StdBadge>}
                        </div>
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

                {sc && <IdentityBindingEvidence sc={sc} />}
                {sc?.zerog && <ZeroGEvidence sc={sc} />}
                {sc?.zerogChain && <ZeroGChainEvidence sc={sc} query={query} />}
                {sc && <GraphEvidence sc={sc} query={query} />}
                <TeeInferenceEvidence onResult={setTee} />
                <EnclaveQuoteEvidence onResult={setEnclave} />
                {sc && ran && <RecomputeReceipt sc={sc} checks={checks} query={query} reply={reply} tee={tee} enclave={enclave} />}
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
