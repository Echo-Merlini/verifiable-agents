import { getGatewayUrl } from "@/hooks/useGatewayEnv";

const TOKEN_KEY = "ens-kit-admin-token";

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function safeJson(r: Response, authenticated = false): Promise<any> {
  if (r.status === 401 && authenticated) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event("ens-kit-unauthorized"));
    return null;
  }
  if (!r.ok) return null;
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try { return await r.json(); } catch { return null; }
}

async function authedJson(token: string, req: () => Promise<Response>): Promise<any> {
  if (!token) return null;
  try { return safeJson(await req(), true); } catch { return null; }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function getNonce(): Promise<string> {
  const r = await fetch(`${getGatewayUrl()}/admin/auth/nonce`);
  const d = await r.json();
  return d.nonce;
}

export async function verifySiwe(message: string, signature: string, password?: string) {
  const r = await fetch(`${getGatewayUrl()}/admin/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature, password }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<{ token: string; address: string }>;
}

// ─── Records ──────────────────────────────────────────────────────────────────
export const getRecords = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/records`, { headers: authHeaders(token) }));

export const upsertRecord = (token: string, name: string, data: { contenthash?: string; address?: string; text_records?: Record<string, string> }) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/records/${encodeURIComponent(name)}`, { method: "PUT", headers: authHeaders(token), body: JSON.stringify(data) }));

export const deleteRecord = (token: string, name: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/records/${encodeURIComponent(name)}`, { method: "DELETE", headers: authHeaders(token) }));

// ─── Stats & Logs ─────────────────────────────────────────────────────────────
export const getStats = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/stats`, { headers: authHeaders(token) }));

export const getLogs = (token: string, limit = 50) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/logs?limit=${limit}`, { headers: authHeaders(token) }));

// ─── Skills ───────────────────────────────────────────────────────────────────
export const getSkills = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/`, { headers: authHeaders(token) }));

export const getSkillsByRegistry = (token: string, registry: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/?registry=${encodeURIComponent(registry)}`, { headers: authHeaders(token) }));

export const createSkill = (token: string, data: Record<string, any>) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }));

export const updateSkill = (token: string, id: string, data: Record<string, any>) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/${id}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(data) }));

export const deleteSkill = (token: string, id: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/${id}`, { method: "DELETE", headers: authHeaders(token) }));

export const testSkill = async (token: string, id: string, message: string, sessionId?: string) => {
  if (!token) return null;
  try {
    const r = await fetch(`${getGatewayUrl()}/admin/skills/${id}/test`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ message, sessionId }) });
    if (r.status === 401) { localStorage.removeItem("ens-kit-admin-token"); window.dispatchEvent(new Event("ens-kit-unauthorized")); return null; }
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) { const d = await r.json(); return d; } // return error body too (for 500)
    return null;
  } catch { return null; }
};

export const getRedactionStats = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/redaction-stats`, { headers: authHeaders(token) }));

export const getSkillSettings = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/settings`, { headers: authHeaders(token) }));

export const saveSkillSettings = (token: string, data: Record<string, string>) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/skills/settings`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(data) }));

// ─── IPFS / Pinata ───────────────────────────────────────────────────────────
export const getIpfsSettings = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/ipfs/settings`, { headers: authHeaders(token) }));

export const saveIpfsSettings = (token: string, data: { pinata_jwt?: string }) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/ipfs/settings`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(data) }));

// ─── Consult platform-fee settings ───────────────────────────────────────────
export const getConsultSettings = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/consult/settings`, { headers: authHeaders(token) }));

export const saveConsultSettings = (token: string, data: { minFeeWei?: string; treasury?: string }) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/consult/settings`, { method: "POST", headers: authHeaders(token), body: JSON.stringify(data) }));

export const setContenthashOnchain = (token: string, cid: string, name?: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/ipfs/set-onchain`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ cid, ...(name ? { name } : {}) }) }));

export const pinCidToPinata = (token: string, cid: string, name?: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/ipfs/pin`, { method: "POST", headers: authHeaders(token), body: JSON.stringify({ cid, name }) }));

// ─── ERC-8004 Agent Owner (self-service) ─────────────────────────────────────
export async function getAgentAuthNonce(): Promise<string> {
  const r = await fetch(`${getGatewayUrl()}/agent/auth/nonce`);
  const d = await r.json();
  return d.nonce;
}

export async function verifyAgentOwner(message: string, signature: string) {
  const r = await fetch(`${getGatewayUrl()}/agent/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json() as Promise<{ token: string; address: string }>;
}

export async function getMyAgents(address: string) {
  try { return safeJson(await fetch(`${getGatewayUrl()}/agent/owned/${address.toLowerCase()}`)); }
  catch { return null; }
}

export const updateMyAgent = (
  token: string,
  registry: string,
  agentId: string,
  data: { name?: string; description?: string; image?: string; services?: Array<{ name: string; endpoint: string; version?: string }>; personality_id?: string; custom_prompt?: string; consult_price?: string; completion_window?: number; linked_ens_name?: string; mcp_server_ids?: string[] }
) =>
  authedJson(token, () =>
    fetch(`${getGatewayUrl()}/agent/${registry}/${agentId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(data),
    })
  );

// ─── ERC-8004 Agents ──────────────────────────────────────────────────────────
export const getAgents = (token: string, registry?: string) =>
  authedJson(token, () =>
    fetch(`${getGatewayUrl()}/agent${registry ? `?registry=${encodeURIComponent(registry)}` : ""}`, {
      headers: authHeaders(token),
    })
  );

// ─── Gateway control ──────────────────────────────────────────────────────────
export const restartGateway = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/restart`, { method: "POST", headers: authHeaders(token) }));

// ─── Public ───────────────────────────────────────────────────────────────────
export async function getRegistryPersonalities(registry: string) {
  return safeJson(await fetch(`${getGatewayUrl()}/agent/${encodeURIComponent(registry)}/personalities`));
}

export async function getGatewayStatus() {
  return safeJson(await fetch(getGatewayUrl()));
}

// ─── Registry config (ERC-8004) ───────────────────────────────────────────────
export const listRegistries = (token: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/registries`, { headers: authHeaders(token) }));

export const getRegistryConfig = (token: string, address: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/registries/${address}`, { headers: authHeaders(token) }));

export const upsertRegistryConfig = (token: string, address: string, data: {
  collection_address?: string; name?: string; mcp_endpoint?: string; a2a_endpoint?: string; chain_id?: number;
}) => authedJson(token, () => fetch(`${getGatewayUrl()}/admin/registries/${address}`, {
  method: "PUT", headers: authHeaders(token), body: JSON.stringify(data),
}));

export const deleteRegistryConfig = (token: string, address: string) =>
  authedJson(token, () => fetch(`${getGatewayUrl()}/admin/registries/${address}`, { method: "DELETE", headers: authHeaders(token) }));

export async function getPublicRegistry(address: string) {
  return safeJson(await fetch(`${getGatewayUrl()}/registry/${address}`));
}

export async function setEnsip25TextRecord(
  token: string, key: string, value: string,
  registry?: string, agentId?: string
) {
  const r = await fetch(`${getGatewayUrl()}/api/claim/set-ensip25`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, registry, agent_id: agentId }),
  });
  if (r.status === 401) return { error: "Unauthorized" };
  return r.json();
}
