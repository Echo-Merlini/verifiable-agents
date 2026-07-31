"use client";

import { useState } from "react";
import { useSignMessage } from "wagmi";
import { ShieldCheck, Loader2, Check, AlertCircle } from "lucide-react";

// Per-agent PQ Phase 4 (b) — owner-authorized delegation. One free wallet signature binds the agent to its
// gateway-derived ML-DSA key, so the per-attestation companion is *owner-authorized*, not just
// gateway-attested. The gateway recovers the signer and requires it to equal the agent's on-chain owner;
// nothing here is custodial beyond signing — the owner consents to this exact key. Recomputable after: the
// binding then carries the signature, and anyone can recover the signer == owner.
const GW = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

export function PqAuthorize({ registry, tokenId }: { registry: string; tokenId: string }) {
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function authorize() {
    setState("signing"); setErr("");
    try {
      const a = await fetch(`${GW}/pq/agent/${registry}/${tokenId}/authorization-message`).then((r) => r.json());
      if (!a?.message) throw new Error("could not fetch the authorization message");
      const signature = await signMessageAsync({ message: a.message });
      const r = await fetch(`${GW}/pq/agent/${registry}/${tokenId}/authorize`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature, issued_at: a.issued_at }),
      }).then((r) => r.json());
      if (r?.ok) setState("done");
      else { setState("error"); setErr(r?.error || "authorization failed"); }
    } catch (e: unknown) {
      setState("error");
      setErr((e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "cancelled");
    }
  }

  if (state === "done")
    return (
      <p className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-emerald-300">
        <Check className="h-4 w-4" /> Post-quantum key authorized — your agent&apos;s attestation companions are now signed under a key you consented to.
      </p>
    );

  return (
    <div className="mt-5">
      <button onClick={authorize} disabled={state === "signing"}
        className="inline-flex items-center gap-2 rounded-2xl border border-brassLight/40 bg-brassLight/[0.06] px-5 py-2.5 font-display text-[14px] text-brassLight hover:bg-brassLight/[0.12] disabled:opacity-50 transition-colors">
        {state === "signing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Authorize your agent&apos;s post-quantum key
      </button>
      <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-gb-faint">
        One free signature (no gas) binds your agent to its own ML-DSA key — makes its per-attestation post-quantum companion <span className="text-paper/60">owner-authorized</span>, not just gateway-attested. Optional; you can also do it later.
      </p>
      {state === "error" && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-red-400"><AlertCircle className="h-3 w-3" /> {err}</p>
      )}
    </div>
  );
}
