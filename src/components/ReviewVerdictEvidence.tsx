"use client";

import { useEffect, useState } from "react";
import { schnorr } from "@noble/curves/secp256k1";
import { Check as CheckIcon, X as XIcon, Loader2, ScrollText, RefreshCw, Wand2, RotateCcw, ExternalLink } from "lucide-react";
import { surfaceFor, fromLegacy } from "@/lib/panel-contract";

// The Review Gate, recomputed in your browser. An independent reviewer (invinoveritas / babyblueviper) signs a
// verdict over Vértice's own work; this panel re-derives the WHOLE proof from public bytes — no trust in the
// reviewer OR in Vértice: the BIP-340 Schnorr signature over the NIP-01 event id, the reviewer key pinned +
// checked live against the rotation/revocation manifest, the decision_ref, and the reviewed artifact re-hashed
// from its published source. The one lane that stays honest-amber until the reviewer promotes it: public-ledger
// inclusion (Nostr relays + OpenTimestamps Bitcoin anchor + the signed hash-chain). Never a silent green.

const PINNED_VERIFIER = "6786e18a864893a900bd9858e650f67ccc3513f248fed374b591e2ff6922fbb7"; // pin the reviewer key
const VERDICT_URL = process.env.NEXT_PUBLIC_REVIEW_VERDICT_URL || "/review-verdict.json";
const KEYS_PROXY = "/api/verifier-keys"; // same-origin relay of the cross-origin rotation manifest
const LEDGER_PROXY = "/api/review-ledger"; // same-origin relay of the reviewer's public verdict ledger
const LEDGER_URL = "https://api.babyblueviper.com/ledger";

type Issue = { severity: string; category: string; description: string; suggested_fix?: string };
type NostrEvent = { id: string; pubkey: string; created_at: number; kind: number; tags: string[][]; content: string; sig: string };
type Verdict = {
  verdict: string; confidence: number; summary: string; issues: Issue[];
  artifact_hash: string; verifier_pubkey: string; decision_ref: string;
  published_artifact_url: string; event: NostrEvent;
};

type Basis = "recomputed" | "fetched" | "pending";
type St = "idle" | "verified" | "rejected" | "unverifiable";
type Row = { id: string; label: string; basis: Basis; std: string; status: St; detail: string; href?: string };

const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "—");
const enc = new TextEncoder();
async function sha256hex(bytes: Uint8Array | string): Promise<string> {
  const b = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  const d = await crypto.subtle.digest("SHA-256", b as BufferSource);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// RFC-8785-ish for this proof: sorted keys, compact JSON, string/null values only (matches the reviewer's rule)
function jcs(obj: Record<string, unknown>): string {
  return JSON.stringify(Object.keys(obj).sort().reduce((a, k) => ((a[k] = obj[k]), a), {} as Record<string, unknown>));
}

function BasisChip({ basis }: { basis: Basis }) {
  const tone =
    basis === "recomputed" ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300/80"
    : basis === "fetched" ? "border-brassLight/25 bg-brassLight/[0.06] text-brassLight/80"
    : "border-amber-400/30 bg-amber-400/[0.06] text-amber-300/80";
  return <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${tone}`}>{basis}</span>;
}

export type ReviewSummary = { sig: St; key: St; decision: St; subject: St; ledger: St; verdict: string };

export function ReviewVerdictEvidence({ onResult }: { onResult?: (r: ReviewSummary) => void }) {
  const [v, setV] = useState<Verdict | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(false);
  const [tampered, setTampered] = useState(false);

  useEffect(() => {
    fetch(VERDICT_URL).then((r) => (r.ok ? r.json() : null)).then(setV).catch(() => setV(null));
  }, []);
  useEffect(() => { if (v && !ran) recompute(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [v]);

  if (!v) return null;

  async function recompute(tamper: boolean) {
    setRunning(true); setTampered(tamper);
    const ev = v!.event;
    // tamper flips one char of the signed content → the event id changes → the Schnorr sig no longer verifies
    const content = tamper ? ev.content.replace(/recompute/, "recomputed") : ev.content;

    // 1 — verdict signature: recompute the NIP-01 event id, then BIP-340 schnorr verify against the pinned key
    const idCalc = await sha256hex(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, content]));
    let sigOk = false;
    try { sigOk = idCalc === ev.id && schnorr.verify(ev.sig, ev.id, ev.pubkey); } catch { sigOk = false; }

    // 2 — reviewer key: pinned (anti-substitution, recomputed) + live rotation/revocation window (fetched)
    const pinOk = ev.pubkey.toLowerCase() === PINNED_VERIFIER;
    let freshMsg = "pinned key matched; freshness — verify at /.well-known/verifier-keys.json"; let freshBad = false; let freshConfirmed = false;
    try {
      const m = await fetch(KEYS_PROXY, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      const keys: any[] = m?.keys || [];
      const revoked: string[] = m?.revocation?.revoked_key_ids || [];
      const e = keys.find((k) => (k.verifier_pubkey || "").toLowerCase() === ev.pubkey.toLowerCase());
      if (e) {
        const from = e.valid_from ? Date.parse(e.valid_from) / 1000 : 0;
        const to = e.valid_to ? Date.parse(e.valid_to) / 1000 : Infinity;
        const inWindow = ev.created_at >= from && ev.created_at <= to;
        const live = e.status !== "revoked" && !revoked.includes(e.key_id) && inWindow;
        if (live) { freshConfirmed = true; freshMsg = "active in the rotation manifest, non-revoked, window contains created_at"; }
        else { freshBad = true; freshMsg = "manifest says revoked or out-of-window for this created_at"; }
      }
    } catch { /* CORS/static — keep the pin-only note */ }
    const keyOk = pinOk && !freshBad;

    // 3 — decision_ref: sha256(JCS over the named preimage fields; absent → null)
    let decOk = false, decCalc = "";
    try {
      const p = JSON.parse(ev.content);
      const fields: string[] = p.decision_ref_preimage_fields || [];
      const obj: Record<string, unknown> = {};
      for (const k of fields) obj[k] = k in p ? p[k] : null;
      decCalc = "sha256:" + (await sha256hex(jcs(obj)));
      decOk = decCalc === v!.decision_ref;
    } catch { decOk = false; }

    // 4 — subject binding: re-fetch the published reviewed artifact and re-hash it → must equal artifact_hash
    let subOk = false, subDetail = "";
    try {
      const txt = await fetch(v!.published_artifact_url, { cache: "no-store" }).then((r) => r.text());
      const h = await sha256hex(txt);
      subOk = h === v!.artifact_hash;
      subDetail = subOk ? `sha256(published string) = ${short("0x" + h)} = artifact_hash — the verdict is bound to this exact release`
                        : `recomputed ${short("0x" + h)} ≠ artifact_hash — the published artifact isn't what was reviewed`;
    } catch { subDetail = "could not fetch the published artifact to re-hash"; }

    // 5 — public-ledger inclusion: fetch the reviewer's OWN verdict ledger and confirm THIS verdict's event
    // id is a real entry — matched by the recomputed event id, not by trusting a label on the card. The
    // entry carries an OTS/Bitcoin commitment_proof; deep in-browser OTS/chain replay is the next lane.
    let ledgerSt: St = "unverifiable", ledgerDetail = "";
    try {
      const lg = await fetch(LEDGER_PROXY, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      const entries: Array<{ entry?: number; event_id?: string }> = lg?.entries || [];
      const hit = entries.find((e) => (e.event_id || "").toLowerCase() === ev.id.toLowerCase());
      if (hit) {
        ledgerSt = "verified";
        ledgerDetail = `this verdict's event id is entry #${hit.entry} of the reviewer's ${entries.length}-entry public ledger — inclusion confirmed by matching the recomputed event id, not a label. The entry carries an OTS/Bitcoin commitment_proof; deep OTS/chain replay is the next lane.`;
      } else {
        ledgerDetail = `event id not found in the reviewer's published ledger (rotated, or predates it) — verify independently at ${LEDGER_URL}`;
      }
    } catch { ledgerDetail = `could not fetch the reviewer's ledger (CORS/offline) — verify independently at ${LEDGER_URL}`; }

    const R: Row[] = [
      { id: "sig", label: "Reviewer signature", basis: "recomputed", std: "BIP-340 · NIP-01",
        status: sigOk ? "verified" : "rejected",
        detail: sigOk ? `re-derived the NIP-01 event id + verified the Schnorr signature against ${short(ev.pubkey)} — the reviewer signed this, not the /ledger UI`
                      : `${tamper ? "tampered content" : "mismatch"} — event id or Schnorr signature does not verify` },
      { id: "key", label: "Reviewer key (pinned + active)", basis: freshConfirmed ? "fetched" : "recomputed", std: "rotation manifest",
        status: keyOk ? "verified" : "rejected",
        detail: pinOk ? `verifier_pubkey == pinned ${short(PINNED_VERIFIER)} — ${freshMsg}` : `verifier_pubkey ${short(ev.pubkey)} ≠ the pinned reviewer key — forged or wrong signer` },
      { id: "decision", label: "Decision binding (decision_ref)", basis: "recomputed", std: "JCS · sha256",
        status: decOk ? "verified" : "rejected",
        detail: decOk ? `sha256(JCS of the named fields) = ${short(decCalc)} = decision_ref — the verdict is bound to its inputs` : `recomputed ${short(decCalc)} ≠ decision_ref` },
      { id: "subject", label: "Subject binding", basis: "recomputed", std: "sha256",
        status: subOk ? "verified" : (subDetail.startsWith("could not") ? "unverifiable" : "rejected"),
        detail: subDetail },
      { id: "ledger", label: "Public-ledger inclusion", basis: ledgerSt === "verified" ? "fetched" : "pending", std: "Nostr · OTS · chain",
        status: ledgerSt, detail: ledgerDetail, href: LEDGER_URL },
    ];
    onResult?.({ sig: R[0].status, key: R[1].status, decision: R[2].status, subject: R[3].status, ledger: R[4].status, verdict: v!.verdict });
    setRows(R); setRunning(false); setRan(true);
  }

  const Icon = ({ st }: { st: St }) =>
    st === "verified" ? <CheckIcon className="h-3.5 w-3.5" /> : st === "rejected" ? <XIcon className="h-3.5 w-3.5" /> : <span className="text-[13px] leading-none">◑</span>;

  // Was: v.verdict === "approve" ? green : v.verdict.includes("concern") ? brass : red
  // A SUBSTRING match with everything unmatched falling to red — so an unrecognised verdict
  // from a future version rendered as a rejection, and "no_concerns_raised" would have gone
  // brass by accident. Unknown now resolves to COULD_NOT_CHECK, which is neither.
  const vSurface = surfaceFor(fromLegacy(v.verdict));
  const vt = vSurface.tone === "green" ? "text-emerald-300"
    : vSurface.tone === "red" ? "text-red-300" : "text-brassLight";

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-brassLight/80" />
          <span className="font-display text-[15px] text-paper">Independent review — recomputed</span>
          <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${vSurface.tone === "green" ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300/80" : vSurface.tone === "red" ? "border-red-500/30 bg-red-500/[0.06] text-red-300/80" : "border-brassLight/30 bg-brassLight/[0.06] text-brassLight/80"}`}>{v.verdict.replace(/_/g, " ")}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper/40">invinoveritas</span>
      </div>
      <p className="mt-1.5 text-[12px] text-gb-muted">
        An independent reviewer signed a verdict over Vértice&apos;s own flagship claim. Don&apos;t trust the verdict — or us:
        this recomputes the whole proof <span className="text-paper/70">in your browser</span> — the <span className="text-paper/70">Schnorr signature</span> over the event id,
        the reviewer key <span className="text-paper/70">pinned + checked against the live revocation manifest</span>, the decision binding, and the reviewed artifact
        <span className="text-paper/70"> re-hashed from its published source</span>. One lane stays honest-amber until ledger promotion.
      </p>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-baseline gap-2">
          <span className={`font-display text-[15px] ${vt}`}>{v.verdict.replace(/_/g, " ")}</span>
          <span className="font-mono text-[11px] text-paper/50">confidence {v.confidence}</span>
        </div>
        <p className="mt-1 text-[12px] text-paper/80">{v.summary}</p>
        {v.issues?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {v.issues.map((is, i) => (
              <li key={i} className="text-[11px] text-brassLight/80">
                <span className="font-mono uppercase tracking-wider text-[9px] text-brassLight/60">{is.severity} · {is.category}</span> — {is.description}
                {is.suggested_fix && <span className="text-paper/50"> → {is.suggested_fix}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-2">
        <div><span className="text-paper/40">reviewer </span><span className="text-paper/80">{short(v.verifier_pubkey)}</span></div>
        <div><span className="text-paper/40">event </span><span className="text-paper/80">{short(v.event.id)}</span></div>
        <div><span className="text-paper/40">artifact </span><span className="text-paper/80">{short(v.artifact_hash)}</span></div>
        <div><span className="text-paper/40">signed </span><span className="text-paper/80">{new Date(v.event.created_at * 1000).toISOString().slice(0, 16).replace("T", " ")}Z</span></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button onClick={() => recompute(false)} disabled={running}
          className="inline-flex items-center gap-1.5 rounded-full border border-brassLight/30 px-3.5 py-1.5 text-[12px] text-brassLight hover:border-brassLight/50 disabled:opacity-50">
          {running && !tampered ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Recompute in your browser
        </button>
        {ran && (
          <button onClick={() => recompute(!tampered)} disabled={running}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-paper/70 hover:border-white/30 disabled:opacity-50">
            {tampered ? <><RotateCcw className="h-3.5 w-3.5" /> restore</> : <><Wand2 className="h-3.5 w-3.5" /> tamper the verdict</>}
          </button>
        )}
      </div>

      {ran && (
        <div className="mt-3 space-y-2">
          {rows.map((r) => {
            const pass = r.status === "verified", rej = r.status === "rejected";
            return (
              <div key={r.id} className={`rounded-xl border p-3 ${pass ? "border-emerald-400/20 bg-emerald-400/[0.03]" : rej ? "border-red-500/30 bg-red-500/[0.03]" : "border-amber-400/25 bg-amber-400/[0.03]"}`}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${pass ? "bg-emerald-400/15 text-emerald-300" : rej ? "bg-red-500/15 text-red-300" : "bg-amber-400/15 text-amber-300"}`}>
                    <Icon st={r.status} />
                  </span>
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-brassLight hover:text-brass underline-offset-2 hover:underline">{r.label} ↗</a>
                  ) : (
                    <span className="text-[13px] text-paper">{r.label}</span>
                  )}
                  <BasisChip basis={r.basis} />
                  <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wider text-paper/35">{r.std}</span>
                </div>
                <p className={`mt-1.5 pl-7 font-mono text-[11px] break-all ${pass ? "text-emerald-300/80" : rej ? "text-red-300/90" : "text-amber-300/80"}`}>{r.detail}</p>
              </div>
            );
          })}
          <p className="pt-1 text-[11px] text-paper/40">
            Four recomputed lanes + one honest-amber (ledger inclusion) — the reviewer&apos;s verdict on Vértice&apos;s own claim, re-derived from public bytes with no trust in either party.{" "}
            <a href={v.published_artifact_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brassLight/70 hover:text-brassLight">reviewed artifact <ExternalLink className="h-3 w-3" /></a>{" · "}
            <a href="https://api.babyblueviper.com/verify-proof" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brassLight/70 hover:text-brassLight">verify-proof <ExternalLink className="h-3 w-3" /></a>
          </p>
        </div>
      )}
    </div>
  );
}
