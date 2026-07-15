# Gateway endpoint the Verify hero needs

`GET /attestations/showcase` (public, read-only) — returns one **designated showcase**
agent execution with its **public preimages**, so the browser can recompute it.

The gateway already has everything: pick a showcase attestation from `agent_execution_log`,
join its `conversations` row (by `session_id`) for the query/reply text, and return:

```jsonc
{
  "ens": "dinamic.eth",
  "agentId": "1",
  "registry": "0x…",                 // ERC-8004 registry = EIP-712 verifyingContract
  "query": "…",                       // user message  → keccak256(utf8) == rawInputHash
  "reply": "…",                       // assistant reply → keccak256(utf8) == outputHash
  "rawInputHash": "0x…",
  "sanitizationPipelineHash": "0x…",
  "inputHash": "0x…",
  "outputHash": "0x…",
  "manifestHash": "0x…",
  "timestamp": 1752000000,            // uint64 seconds (must match what L4 signed)
  "l4Signature": "0x…",               // EIP-712 "KYA-L4" sig
  "attestor": "0x…",                  // gateway signer address (expected recover result)
  "l3Tx": "0x…",                      // OCP record() tx (optional)
  "ocpContract": "0x…"                // ERC-8281 OCP anchor (optional)
}
```

Notes:
- The showcase must be a **designated demo run** (not arbitrary user data) since it publishes
  the conversation preimages. Flag one `session_id` as the showcase, or run a fresh demo agent
  action whose preimages we intend to publish.
- `timestamp` MUST equal the value the gateway put in the signed EIP-712 struct, or L4 recovery
  won't match.
- Recompute spec + EIP-712 domain/types live in `src/lib/verify.ts`.
