"use client";

import { useEffect, useState } from "react";
import { getGatewayStatus, restartGateway, listRegistries, upsertRegistryConfig, deleteRegistryConfig } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useGatewayEnv, GATEWAY_ENVS, GatewayEnvKey } from "@/hooks/useGatewayEnv";
import { Copy, Check, ExternalLink, RefreshCw, RotateCcw, Rocket, Plus, Trash2, Bot, Terminal } from "lucide-react";

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || "0x0000000000000000000000000000000000000000";
const DEPLOYER_ADDRESS = "0xFf9a176577Fb42b6bc9c19fd05a241e8fCd0ca14";
const RPC = "https://ethereum.publicnode.com";

async function fetchChainData() {
  const [gasRes, balRes, codeRes] = await Promise.all([
    fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_gasPrice", id: 1 }) }),
    fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getBalance", params: [DEPLOYER_ADDRESS, "latest"], id: 2 }) }),
    fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_getCode", params: [FACTORY_ADDRESS, "latest"], id: 3 }) }),
  ]);
  const [gasData, balData, codeData] = await Promise.all([gasRes.json(), balRes.json(), codeRes.json()]);
  const gasPrice = parseInt(gasData.result, 16);
  const balance = parseInt(balData.result, 16);
  const deployed = codeData.result && codeData.result !== "0x";
  const estimatedGas = 5_100_000;
  const estimatedCostWei = gasPrice * estimatedGas;
  return { gasPrice, balance, deployed, estimatedCostWei };
}

const RESOLVER_CONTRACT = "0xB300e09e6C4f901409B809e7924CF68A2A429014";
const ETHERSCAN_URL = `https://etherscan.io/address/${RESOLVER_CONTRACT}`;

type GatewayStatus = { status?: string; signer?: string; gateway?: string };

function CopyableField({
  label,
  value,
  mono = true,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  link?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gb-muted uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-2 bg-gb-input rounded-lg px-3 py-2.5">
        <span className={`flex-1 text-sm text-gb-faint break-all ${mono ? "font-mono" : ""}`}>
          {value || "—"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-gb-muted hover:text-gb-faint hover:bg-[#1a1a1a] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={copy}
            className="p-1.5 rounded text-gb-muted hover:text-gb-faint hover:bg-[#1a1a1a] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Registry config panel ────────────────────────────────────────────────────

type RegistryRow = {
  registry_address: string; collection_address: string; name: string;
  mcp_endpoint: string; a2a_endpoint: string; chain_id: number;
};

function RegistryCard({
  reg, token, onSaved, onDeleted,
}: { reg: RegistryRow; token: string; onSaved: () => void; onDeleted: () => void }) {
  const [name, setName]       = useState(reg.name);
  const [mcp, setMcp]         = useState(reg.mcp_endpoint);
  const [a2a, setA2a]         = useState(reg.a2a_endpoint);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dirty = name !== reg.name || mcp !== reg.mcp_endpoint || a2a !== reg.a2a_endpoint;

  const save = async () => {
    setSaving(true);
    await upsertRegistryConfig(token, reg.registry_address, { name, mcp_endpoint: mcp, a2a_endpoint: a2a });
    setSaving(false);
    onSaved();
  };

  const remove = async () => {
    if (!confirm(`Remove registry ${reg.registry_address}?`)) return;
    setDeleting(true);
    await deleteRegistryConfig(token, reg.registry_address);
    onDeleted();
  };

  return (
    <div className="bg-gb-bg border border-gb-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{reg.name || "Unnamed registry"}</p>
          <p className="font-mono text-[11px] text-gb-muted truncate">{reg.registry_address}</p>
          {reg.collection_address && (
            <p className="font-mono text-[11px] text-[#444] truncate">collection: {reg.collection_address}</p>
          )}
        </div>
        <button onClick={remove} disabled={deleting} className="p-1.5 text-[#444] hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-[10px] text-gb-muted uppercase tracking-wide">Display name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pixel Goblins"
            className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-gb-muted uppercase tracking-wide">MCP Endpoint</label>
          <input value={mcp} onChange={(e) => setMcp(e.target.value)} placeholder="https://mcp.yourproject.com/"
            className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-gb-muted uppercase tracking-wide">A2A Endpoint</label>
          <input value={a2a} onChange={(e) => setA2a(e.target.value)} placeholder="https://a2a.yourproject.com/"
            className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gb-border">
        {dirty && <span className="text-[11px] text-amber-500 flex-1">Unsaved changes</span>}
        <button onClick={save} disabled={saving || !dirty}
          className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function AddRegistryForm({ token, onSaved }: { token: string; onSaved: () => void }) {
  const [open, setOpen]       = useState(false);
  const [address, setAddress] = useState("");
  const [collection, setCollection] = useState("");
  const [name, setName]       = useState("");
  const [mcp, setMcp]         = useState("");
  const [a2a, setA2a]         = useState("");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    if (!address.trim()) return;
    setSaving(true);
    await upsertRegistryConfig(token, address.trim(), {
      collection_address: collection || undefined,
      name: name || undefined,
      mcp_endpoint: mcp || undefined,
      a2a_endpoint: a2a || undefined,
    });
    setSaving(false);
    setAddress(""); setCollection(""); setName(""); setMcp(""); setA2a("");
    setOpen(false);
    onSaved();
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 w-full border border-dashed border-gb-border hover:border-gb-accent rounded-xl px-4 py-3 text-sm text-gb-muted hover:text-gb-accent transition-colors">
      <Plus className="w-4 h-4" /> Add registry
    </button>
  );

  return (
    <div className="bg-gb-surface border border-gb-accent rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-slate-100">New registry</p>
      {[
        { label: "Registry address", value: address, set: setAddress, placeholder: "0x… (deployed AgentIdentityRegistry)" },
        { label: "Collection address", value: collection, set: setCollection, placeholder: "0x… (source ERC-721)" },
        { label: "Display name", value: name, set: setName, placeholder: "Pixel Goblins", mono: false },
        { label: "MCP Endpoint", value: mcp, set: setMcp, placeholder: "https://mcp.yourproject.com/" },
        { label: "A2A Endpoint", value: a2a, set: setA2a, placeholder: "https://a2a.yourproject.com/" },
      ].map(({ label, value, set, placeholder, mono = true }) => (
        <div key={label} className="space-y-1">
          <label className="text-[10px] text-gb-muted uppercase tracking-wide">{label}</label>
          <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
            className={`w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors ${mono ? "font-mono" : ""}`} />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={() => setOpen(false)} className="text-xs text-gb-muted hover:text-gb-faint px-3 py-1.5 transition-colors">Cancel</button>
        <button onClick={save} disabled={saving || !address.trim()}
          className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Add"}
        </button>
      </div>
    </div>
  );
}


const FULL_RESTART_CMD = "bash '/volume1/docker/ENS Boiler/gateway/restart-gateway.sh'";

function FullRestartCard() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(FULL_RESTART_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="w-4 h-4 text-gb-muted" />
        <p className="text-sm font-semibold">Full Container Restart (NAS)</p>
      </div>
      <p className="text-xs text-gb-muted">
        Use this when env vars changed (e.g. wrong signing key, new API key). Stops the container, recreates it from
        {" "}<code className="text-gb-faint">ensboiler-gateway:latest</code>, and reads all secrets fresh from{" "}
        <code className="text-gb-faint">gateway/.env</code>. Run on the NAS or from a terminal with NAS SSH access.
      </p>
      <div className="bg-gb-input rounded-lg p-3 flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-gb-faint break-all">{FULL_RESTART_CMD}</code>
        <button onClick={copy} className="shrink-0 p-1.5 rounded text-gb-muted hover:text-gb-faint hover:bg-[#1a1a1a] transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="text-[11px] text-gb-muted space-y-0.5">
        <p>Container: <code className="text-gb-faint">ensboiler-gateway-1</code> · Image: <code className="text-gb-faint">ensboiler-gateway:latest</code></p>
        <p>Networks: <code className="text-gb-faint">ensboiler_default</code> + <code className="text-gb-faint">coolify</code> · Volume: <code className="text-gb-faint">gateway/data:/app/data</code></p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { token } = useAuth();
  const { envKey, env, setEnv } = useGatewayEnv();
  const [gwStatus, setGwStatus]       = useState<GatewayStatus | null>(null);
  const [registries, setRegistries]   = useState<RegistryRow[]>([]);

  const fetchRegistries = async () => {
    if (!token) return;
    const data = await listRegistries(token);
    if (Array.isArray(data)) setRegistries(data);
  };
  const [statusLoading, setStatusLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);

  type ChainData = { gasPrice: number; balance: number; deployed: boolean; estimatedCostWei: number };
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [deployCopied, setDeployCopied] = useState(false);

  const loadChainData = () => {
    setChainLoading(true);
    fetchChainData().then(setChainData).catch(() => {}).finally(() => setChainLoading(false));
  };

  const fetchStatus = () => {
    setStatusLoading(true);
    setGwStatus(null);
    getGatewayStatus()
      .then(setGwStatus)
      .catch(() => setGwStatus({ status: "unreachable" }))
      .finally(() => setStatusLoading(false));
  };

  useEffect(() => { fetchStatus(); }, [envKey]);
  useEffect(() => { loadChainData(); }, []);
  useEffect(() => { fetchRegistries(); }, [token]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-8 text-slate-100 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gb-faint text-sm mt-1">Gateway environment and configuration</p>
      </div>

      {/* Gateway Environment Switcher */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold">Gateway Environment</p>
        <p className="text-xs text-gb-muted">
          Switch which gateway the admin panel talks to. Stored in localStorage — no page reload needed.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(GATEWAY_ENVS) as [GatewayEnvKey, typeof GATEWAY_ENVS[GatewayEnvKey]][]).map(
            ([key, e]) => (
              <button
                key={key}
                onClick={() => setEnv(key)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  envKey === key
                    ? "border-gb-accent bg-gb-surface/40"
                    : "border-gb-border bg-gb-input hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${e.color}`} />
                  <span className="text-sm font-medium text-slate-100">{e.label}</span>
                  {envKey === key && (
                    <span className="ml-auto text-[10px] bg-gb-accentD text-white px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gb-muted font-mono break-all">{e.url}</p>
                <p className="text-xs text-[#444] mt-1">{e.rpc} · Chain {e.chainId}</p>
              </button>
            )
          )}
        </div>
      </div>

      {/* Contract & gateway */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-5">
        <p className="text-sm font-semibold">Contract & Gateway</p>
        <CopyableField
          label="Resolver Contract Address"
          value={RESOLVER_CONTRACT}
          link={ETHERSCAN_URL}
        />
        <CopyableField
          label="Gateway URL (active)"
          value={env.url}
          mono={false}
          link={env.url}
        />
        <CopyableField
          label="Signer Address"
          value={gwStatus?.signer || (statusLoading ? "Loading…" : "Unreachable")}
          link={
            gwStatus?.signer
              ? `https://etherscan.io/address/${gwStatus.signer}`
              : undefined
          }
        />
        <div className="space-y-1.5">
          <label className="text-xs text-gb-muted uppercase tracking-wide">Chain</label>
          <div className="flex items-center gap-2 bg-gb-input rounded-lg px-3 py-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${env.color}`} />
            <span className="text-sm text-gb-faint">{env.rpc}</span>
            <span className="text-xs text-[#444] ml-auto">Chain ID: {env.chainId}</span>
          </div>
        </div>
      </div>

      {/* Gateway status */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Gateway Status</p>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={statusLoading || restarting}
              className="flex items-center gap-1.5 text-xs text-gb-faint hover:text-gb-faint transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={async () => {
                if (!token || !confirm("Restart the gateway? It will be unavailable for a few seconds.")) return;
                setRestarting(true);
                setGwStatus(null);
                try { await restartGateway(token); } catch {}
                setTimeout(() => { fetchStatus(); setRestarting(false); }, 4000);
              }}
              disabled={restarting || statusLoading || !token}
              className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-300 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${restarting ? "animate-spin" : ""}`} />
              {restarting ? "Restarting…" : "Restart process"}
            </button>
          </div>
        </div>
        {gwStatus ? (
          <div
            className={`bg-gb-input rounded-lg p-3 font-mono text-xs overflow-auto ${
              gwStatus.status === "unreachable" ? "text-red-400" : "text-gb-faint"
            }`}
          >
            <pre>{JSON.stringify(gwStatus, null, 2)}</pre>
          </div>
        ) : (
          <p className="text-gb-muted text-sm">Loading…</p>
        )}
        <p className="text-[11px] text-gb-muted">
          <span className="text-amber-400 font-medium">Restart process</span> — kills and restarts the Bun process (fast, same container + env vars). For env var changes use <span className="text-slate-400 font-medium">Full Container Restart</span> below.
        </p>
      </div>

      {/* Full container restart */}
      <FullRestartCard />

      {/* ERC-8004 Factory Deployment */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-gb-accent" />
            <p className="text-sm font-semibold">ERC-8004 Factory Deployment</p>
          </div>
          <button
            onClick={loadChainData}
            disabled={chainLoading}
            className="text-xs text-gb-faint hover:text-gb-faint flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${chainLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${chainData?.deployed ? "bg-green-400" : "bg-amber-400"}`} />
          <span className="text-sm text-gb-faint">
            {chainLoading ? "Checking…" : chainData?.deployed ? "Factory deployed on mainnet" : "Factory not yet deployed"}
          </span>
        </div>

        <CopyableField
          label="Factory Address"
          value={FACTORY_ADDRESS}
          link={`https://etherscan.io/address/${FACTORY_ADDRESS}`}
        />

        {/* Gas stats */}
        {chainData && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Gas price", value: `${(chainData.gasPrice / 1e9).toFixed(2)} gwei` },
              { label: "Deployer balance", value: `${(chainData.balance / 1e18).toFixed(4)} ETH` },
              { label: "Est. cost", value: `${(chainData.estimatedCostWei / 1e18).toFixed(4)} ETH` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gb-input rounded-lg p-3">
                <p className="text-[10px] text-gb-muted uppercase tracking-wide">{label}</p>
                <p className="text-sm font-mono text-slate-100 mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Sufficient funds indicator */}
        {chainData && !chainData.deployed && (
          <div className={`rounded-lg px-3 py-2 text-xs ${
            chainData.balance >= chainData.estimatedCostWei
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
          }`}>
            {chainData.balance >= chainData.estimatedCostWei
              ? "✓ Deployer wallet has sufficient funds — ready to deploy"
              : `Need ${((chainData.estimatedCostWei - chainData.balance) / 1e18).toFixed(4)} more ETH in deployer wallet`}
          </div>
        )}

        {chainData?.deployed && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-400">
            ✓ Factory is live — use the <strong>Agents</strong> tab to onboard collections
          </div>
        )}

        {/* Deploy command */}
        {!chainData?.deployed && (
          <div className="space-y-2">
            <p className="text-xs text-gb-muted">Run this in your terminal when ready:</p>
            <div className="bg-gb-input rounded-lg p-3 relative">
              <pre className="text-xs text-gb-faint font-mono whitespace-pre-wrap break-all pr-8">{`cd '/Volumes/docker/ENS Boiler/contracts'
RPC_MAINNET="https://ethereum.publicnode.com" forge create src/AgentIdentityRegistryFactory.sol:AgentIdentityRegistryFactory \\
  --rpc-url mainnet \\
  --private-key $DEPLOYER_PRIVATE_KEY \\
  --constructor-args ${DEPLOYER_ADDRESS} \\
  --broadcast --verify`}</pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `cd '/Volumes/docker/ENS Boiler/contracts'\nRPC_MAINNET="https://ethereum.publicnode.com" ETHERSCAN_API_KEY=$ETHERSCAN_API_KEY forge create src/AgentIdentityRegistryFactory.sol:AgentIdentityRegistryFactory --rpc-url mainnet --private-key $DEPLOYER_PRIVATE_KEY --constructor-args ${DEPLOYER_ADDRESS} --broadcast --verify`
                  );
                  setDeployCopied(true);
                  setTimeout(() => setDeployCopied(false), 2000);
                }}
                className="absolute top-3 right-3 p-1.5 rounded text-gb-muted hover:text-gb-faint transition-colors"
              >
                {deployCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">External Links</p>
        <div className="space-y-2">
          {[
            { label: "View contract on Etherscan", href: ETHERSCAN_URL },
            { label: "ENS Manager App", href: "https://app.ens.domains" },
            { label: "CCIP-Read (EIP-3668) Docs", href: "https://docs.ens.domains/resolvers/ccip-read" },
            {
              label: "Blockscout (Local Dev)",
              href: "http://192.168.68.52:4000",
            },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 bg-gb-input hover:bg-[#1a1a1a] rounded-lg transition-colors group"
            >
              <span className="text-sm text-gb-faint">{label}</span>
              <ExternalLink className="w-4 h-4 text-gb-muted group-hover:text-gb-faint transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* ── ERC-8004 Registries ── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-gb-muted" />
          <p className="text-sm font-semibold">ERC-8004 Registries</p>
        </div>
        <p className="text-xs text-gb-muted">
          Configure MCP and A2A endpoints for each onboarded collection.
          These are shown to minters on the agent bridge and embedded in every agent minted from the registry.
        </p>
        <div className="space-y-3">
          {registries.length === 0 && (
            <p className="text-xs text-[#444] italic">No registries configured yet. Deploy a factory registry first, then add it here.</p>
          )}
          {registries.map((reg) => (
            <RegistryCard key={reg.registry_address} reg={reg} token={token!} onSaved={fetchRegistries} onDeleted={fetchRegistries} />
          ))}
          <AddRegistryForm token={token!} onSaved={fetchRegistries} />
        </div>
      </div>

    </div>
  );
}
