"use client";

import { useCallback, useEffect, useState } from "react";
import { useSignMessage } from "wagmi";
import { RefreshCw, Ban, Loader2, Check, AlertCircle, AlertTriangle, ChevronDown } from "lucide-react";

// Owner-facing key lifecycle. All three actions are authorised by the AGENT OWNER's signature — the
// gateway recovers the signer and requires it to equal the on-chain owner. None of them are admin
// operations and none of them cost gas; the on-chain cost is the gateway's batched seed-epoch anchor.
//
// Why terminate is here at all, given it is irreversible: the route accepts an owner signature whether or
// not this UI offers a button, so hiding it would be a control that isn't one — anyone could call it
// directly. Better to surface it honestly, behind friction, with an accurate description of what it does.
//
// What terminate actually does, stated precisely because the vague version is both scarier and wronger:
// an unlifted terminal makes /rotate fail closed. It does NOT delete the agent, does NOT stop it running,
// and does NOT invalidate attestations already produced — those keep verifying under the keys already
// bound. What is lost is the ability to ever bind a new key. terminal_incident is documented as liftable
// by a fleet seed_epoch_rotation, but that lift is marked "(roadmap)" in the gateway and no code path
// performs it today, so this UI does not offer incident terminals and does not promise recoverability.
const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

type Phase = "idle" | "working" | "done" | "error";
type Action = "rotate" | "revoke" | "terminate";

export function PqLifecycle({ registry, tokenId }: { registry: string; tokenId: string }) {
  const { signMessageAsync } = useSignMessage();
  const [open, setOpen] = useState(false);
  const [epoch, setEpoch] = useState<number | null>(null);
  const [terminated, setTerminated] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [armed, setArmed] = useState(false); // terminate: second-step confirmation

  const base = `${GW}/pq/agent/${registry}/${tokenId}`;

  const refresh = useCallback(async () => {
    try {
      const [b, g] = await Promise.all([
        fetch(`${base}/bindings`).then((r) => r.json()),
        fetch(`${base}/bind-gate`).then((r) => r.json()),
      ]);
      setEpoch(typeof b?.current_key_epoch === "number" ? b.current_key_epoch : null);
      setTerminated(g?.admit === false);
    } catch {
      /* read-only refresh; leave prior state */
    }
  }, [base]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function run(action: Action) {
    setBusyAction(action);
    setPhase("working");
    setErr("");
    setMsg("");
    try {
      const q =
        action === "revoke" ? `?key_epoch=${epoch ?? 0}` : action === "terminate" ? "?subtype=terminal_owner" : "";
      const m = await fetch(`${base}/${action}-message${q}`).then((r) => r.json());
      if (!m?.message) throw new Error("could not fetch the message to sign");

      const signature = await signMessageAsync({ message: m.message });

      const body: Record<string, unknown> = { signature, issued_at: m.issued_at };
      if (action === "revoke") body.key_epoch = m.key_epoch;
      if (action === "terminate") body.subtype = "terminal_owner";

      const r = await fetch(`${base}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());

      if (!r?.ok) throw new Error(r?.error || `${action} failed`);

      setPhase("done");
      setMsg(
        action === "rotate"
          ? `Rotated to key epoch ${r.rotated_to_epoch ?? "?"}. Everything signed under the previous key still verifies under that key — rotation adds a successor, it does not rewrite history. The new key becomes provable to outside verifiers at the next anchor.`
          : action === "revoke"
            ? `Key epoch ${m.key_epoch} revoked. It no longer governs anything anchored from now on. Rotate to bind a successor — until you do, new artifacts have no in-force key.`
            : "Terminated. No new key can be bound to this agent from here."
      );
      setArmed(false);
      await refresh();
    } catch (e: unknown) {
      setPhase("error");
      setErr(
        (e as { shortMessage?: string; message?: string })?.shortMessage ||
          (e as Error)?.message ||
          "cancelled"
      );
    } finally {
      setBusyAction(null);
    }
  }

  const busy = phase === "working";

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-gb-faint hover:text-gb-muted"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        Manage key
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="font-mono text-[10px] text-gb-faint">
            current key epoch {epoch ?? "—"}
            {terminated && <span className="ml-2 text-red-400">· terminated — rotation refused</span>}
          </p>

          {/* Rotate — additive and safe. */}
          <div>
            <button
              onClick={() => run("rotate")}
              disabled={busy || terminated}
              className="inline-flex items-center gap-2 rounded-xl border border-brassLight/40 bg-brassLight/[0.06] px-3.5 py-2 font-display text-[13px] text-brassLight hover:bg-brassLight/[0.12] disabled:opacity-40 transition-colors"
            >
              {busyAction === "rotate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Rotate key
            </button>
            <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-gb-faint">
              Binds a new key as epoch {(epoch ?? 0) + 1}. Nothing already signed changes — an artifact is
              judged under the key in force when it was anchored, so your existing attestations keep
              verifying under the old key. One signature, no gas.
            </p>
          </div>

          {/* Revoke — recoverable, but leaves a gap until a rotation follows. */}
          <div>
            <button
              onClick={() => run("revoke")}
              disabled={busy || epoch === null}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/[0.06] px-3.5 py-2 font-display text-[13px] text-amber-300 hover:bg-amber-400/[0.12] disabled:opacity-40 transition-colors"
            >
              {busyAction === "revoke" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
              Revoke key epoch {epoch ?? "—"}
            </button>
            <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-gb-faint">
              Ends this key&apos;s authority from now on — use it if you believe the key is compromised.
              Attestations anchored before the revocation are unaffected. It leaves your agent with no key
              in force, so <span className="text-amber-300/80">rotate straight afterwards</span> unless you
              intend it to stop producing verifiable work.
            </p>
          </div>

          {/* Terminate — irreversible. Two steps, and an accurate description of the loss. */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-3">
            <p className="inline-flex items-center gap-1.5 font-display text-[13px] text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Terminate this agent&apos;s key lineage
            </p>
            <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-gb-faint">
              Permanently prevents any new key from ever being bound to this agent. You will not be able to
              rotate again — <span className="text-red-300/90">including if the key is later compromised</span>.
              Your agent is not deleted and keeps running, and everything it has already attested stays
              verifiable under the keys already bound. What you give up is the recovery path.
              <span className="mt-1 block text-red-300/80">
                Neither you nor we can reverse this. There is no lift path in the system today.
              </span>
            </p>

            <label className="mt-2 flex max-w-md cursor-pointer items-start gap-2 text-[11px] text-gb-muted">
              <input
                type="checkbox"
                checked={armed}
                onChange={(e) => setArmed(e.target.checked)}
                disabled={busy || terminated}
                className="mt-0.5 accent-red-500"
              />
              I understand this cannot be undone, and that I am giving up the ability to rotate this key
              even if it is compromised.
            </label>

            <button
              onClick={() => run("terminate")}
              disabled={busy || !armed || terminated}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3.5 py-2 font-display text-[13px] text-red-300 hover:bg-red-500/20 disabled:opacity-30 disabled:hover:bg-red-500/10 transition-colors"
            >
              {busyAction === "terminate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {terminated ? "Already terminated" : "Terminate permanently"}
            </button>
          </div>

          {phase === "done" && msg && (
            <p className="inline-flex max-w-md items-start gap-1.5 text-[11px] leading-relaxed text-emerald-300">
              <Check className="mt-0.5 h-3 w-3 shrink-0" /> {msg}
            </p>
          )}
          {phase === "error" && (
            <p className="inline-flex items-start gap-1.5 text-[11px] text-red-400">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {err}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
