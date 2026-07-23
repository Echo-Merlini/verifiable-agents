"use client";

import { useState } from "react";
import {
  Database, HardDrive, Loader2, CheckCircle2, AlertTriangle,
  Fingerprint, UploadCloud, DownloadCloud, Copy, Check,
} from "lucide-react";

// A recompute artifact = exactly the text an agent action is re-derived from
// (raw input / output / manifest). Prefilled with a manifest-shaped record.
const SAMPLE = JSON.stringify(
  {
    action: "tool_call",
    agent: "pixel-goblins.dinamic.eth",
    tool: "uniswap_swap",
    raw_input_hash: "0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2f6f26d90a859e1e6f8d0f0a1",
    output_hash: "0x3b1e2a0c8e7d6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f10",
    manifest_hash: "0x1e2a118a9f8e7d6c5b4a3928170615243342516078695a4b3c2d1e0f9a8b7c6d",
    ts: 1690000000,
  },
  null,
  2,
);

type RootRes = { rootHash?: string; bytes?: number; network?: string; note?: string; error?: string };
type StoreRes = RootRes & { stored?: boolean; tx?: string };
type FetchRes = { fetched?: boolean; rootHash?: string; bytes?: number; content?: string; error?: string };

async function call(action: string, body: Record<string, unknown>) {
  const r = await fetch("/api/storage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  return r.json();
}

function Mono({ v }: { v?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!v) return <span className="text-gb-muted">—</span>;
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      title="Copy"
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-300 hover:text-gb-accent break-all text-left"
    >
      {v}
      {copied ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />}
    </button>
  );
}

export default function StoragePage() {
  const [content, setContent] = useState(SAMPLE);
  const [computed, setComputed] = useState<RootRes | null>(null);
  const [stored, setStored] = useState<StoreRes | null>(null);
  const [fetched, setFetched] = useState<FetchRes | null>(null);
  const [busy, setBusy] = useState<"" | "root" | "store" | "fetch">("");
  const [err, setErr] = useState("");

  const computedRoot = computed?.rootHash;
  // proofs
  const handleMatches = !!(stored?.rootHash && computedRoot && stored.rootHash === computedRoot);
  const roundTripRoot = fetched?.rootHash && computedRoot ? fetched.rootHash === computedRoot : null;

  async function doRoot() {
    setBusy("root"); setErr(""); setStored(null); setFetched(null);
    const j = await call("root", { content });
    setBusy("");
    if (j.error) return setErr(j.error);
    setComputed(j);
  }
  async function doStore() {
    if (!computedRoot) await doRoot();
    setBusy("store"); setErr("");
    const j = await call("store", { content });
    setBusy("");
    if (j.error) return setErr(j.error);
    setStored(j);
  }
  async function doFetch() {
    const root = stored?.rootHash || computedRoot;
    if (!root) return setErr("Compute or store a root first.");
    setBusy("fetch"); setErr("");
    const dl: FetchRes = await call("fetch", { rootHash: root });
    if (dl.error) { setBusy(""); return setErr(dl.error); }
    // recompute the root of the bytes 0G handed back — the round-trip proof
    const re: RootRes = dl.content != null ? await call("root", { content: dl.content }) : {};
    setBusy("");
    setFetched({ ...dl, rootHash: re.rootHash ?? dl.rootHash });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-gb-accent" />
          Storage — 0G decentralized storage proofs
        </h1>
        <p className="text-xs text-gb-muted mt-0.5">
          An agent action&apos;s recompute artifacts (raw input · output · manifest) live on <span className="text-slate-300">0G decentralized Storage</span>,
          content-addressed by a flow-merkle <span className="text-slate-300">rootHash</span> anyone can recompute from the bytes — not a single pinning server.
        </p>
      </div>

      {/* Explainer strip */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { icon: Fingerprint, t: "Deterministic root", d: "256-byte chunks · keccak256 leaves · 0G flow-merkle. Recomputable offline, no gas." },
          { icon: UploadCloud, t: "Handle = root", d: "The upload returns the exact same root — the store handle is the content address." },
          { icon: DownloadCloud, t: "Round-trip proof", d: "Fetch by root, recompute the bytes 0G returns → must match. No trust in the server." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="bg-gb-surface border border-gb-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-200 text-xs font-semibold mb-1">
              <Icon className="w-4 h-4 text-gb-accent" /> {t}
            </div>
            <p className="text-[11px] text-gb-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </div>

      {/* Artifact input */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200">Recompute artifact</label>
          <button onClick={() => { setContent(SAMPLE); setComputed(null); setStored(null); setFetched(null); setErr(""); }}
            className="text-[11px] text-gb-muted hover:text-slate-300">reset sample</button>
        </div>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setComputed(null); setStored(null); setFetched(null); }}
          spellCheck={false}
          className="w-full h-44 bg-gb-input border border-gb-border rounded-lg px-3 py-2.5 font-mono text-[11px] text-slate-200 outline-none focus:border-gb-accent resize-y leading-relaxed"
        />
        <div className="flex flex-wrap gap-2.5">
          <button onClick={doRoot} disabled={!!busy}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg bg-gb-accent/15 border border-gb-accent/30 text-gb-accent hover:bg-gb-accent/25 disabled:opacity-50 transition-colors">
            {busy === "root" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
            Compute 0G root
          </button>
          <button onClick={doStore} disabled={!!busy}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-gb-border text-slate-300 hover:text-slate-100 hover:border-gb-accent/40 disabled:opacity-50 transition-colors">
            {busy === "store" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
            Store to 0G <span className="text-gb-muted">(~15s · testnet gas)</span>
          </button>
          <button onClick={doFetch} disabled={!!busy || !(stored?.rootHash || computedRoot)}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border border-gb-border text-slate-300 hover:text-slate-100 hover:border-gb-accent/40 disabled:opacity-50 transition-colors">
            {busy === "fetch" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
            Fetch &amp; verify round-trip
          </button>
        </div>
        {err && (
          <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span className="break-all">{err}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {(computed || stored || fetched) && (
        <div className="bg-gb-surface border border-gb-border rounded-xl divide-y divide-gb-border">
          {computed && (
            <Row label="Content-addressed root" proof="deterministic · recomputable offline" ok>
              <Mono v={computed.rootHash} />
              <Meta>{computed.bytes} bytes · {computed.network}</Meta>
            </Row>
          )}
          {stored && (
            <Row
              label="Stored on 0G"
              proof={handleMatches ? "upload handle == computed root" : "handle differs from computed root"}
              ok={handleMatches}
            >
              <Mono v={stored.rootHash} />
              <Meta>tx <span className="font-mono text-slate-400">{stored.tx ? stored.tx.slice(0, 14) + "…" : "—"}</span> · {stored.network}</Meta>
            </Row>
          )}
          {fetched && (
            <Row
              label="Fetched back & recomputed"
              proof={roundTripRoot ? "bytes 0G returned recompute to the same root" : "root mismatch — investigate"}
              ok={!!roundTripRoot}
            >
              <Mono v={fetched.rootHash} />
              <Meta>{fetched.bytes} bytes retrieved from 0G</Meta>
            </Row>
          )}
        </div>
      )}

      <p className="text-[11px] text-gb-muted flex items-center gap-1.5">
        <Database className="w-3.5 h-3.5" />
        0G Galileo testnet storage. The root is the same primitive graded in the <span className="text-gb-accent">/conformance</span> gate
        (<span className="font-mono">og_root</span> recompute recipe) — this tab proves it end-to-end: recompute → store → fetch → recompute.
      </p>
    </div>
  );
}

function Row({ label, proof, ok, children }: { label: string; proof?: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="sm:w-56 shrink-0">
        <div className="text-xs font-semibold text-slate-200">{label}</div>
        {proof && (
          <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${ok === false ? "text-amber-300" : "text-emerald-400"}`}>
            {ok === false ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />} {proof}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}
function Meta({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-gb-muted">{children}</div>;
}
