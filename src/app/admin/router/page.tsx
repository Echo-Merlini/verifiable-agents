"use client";

import { AttestationMeshPanel } from "@/components/AttestationMeshPanel";

export default function RouterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Gateway / Router</h1>
        <p className="text-xs text-gb-muted mt-0.5">
          The attestation mesh — each node&apos;s tier status. Attestations propagate across the mesh via Chainlink CCIP, so no single node is the source of truth.
        </p>
      </div>
      <AttestationMeshPanel />
    </div>
  );
}
