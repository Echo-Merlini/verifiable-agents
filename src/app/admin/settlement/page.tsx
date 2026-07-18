"use client";
import { useEffect, useState, useCallback } from "react";
import { useSignMessage } from "wagmi";
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { keccak256, toHex, parseEther, formatEther } from "viem";
import { useAuth } from "@/hooks/useAuth";
import { getConsultSettings, saveConsultSettings } from "@/lib/api";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { Coins, ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle2, Clock, AlertCircle, Network, Wifi, WifiOff, PenLine, History } from "lucide-react";

const PERIOD_DURATION = 604800; // 1 week in seconds

type SnapshotRow = {
  source:   string;
  records:  number;
  nodeType: "Origin" | "Router" | "Hybrid";
  isLocal:  boolean;
  share:    number;
};

type Snapshot = {
  period:       number;
  periodStart:  number;
  periodEnd:    number;
  namespace:    string;
  totalRecords: number;
  rows:         SnapshotRow[];
  status:            "pending" | "signed" | "submitted";
  peerConfirmations: number;
  frozen_at?:        number | null;
  signature?:        string;
  signer?:           string;
  signed_at?:        number;
};

type SnapshotRecord = {
  period:        number;
  namespace:     string;
  snapshot_hash: string | null;
  signer:        string | null;
  signed_at:     number | null;
  on_chain_tx:   string | null;
  status:        "pending" | "signed" | "submitted";
};

type PeerConfirmation = {
  source:        string;
  signer:        string;
  snapshot_hash: string | null;
  received_at:   number;
};

type MeshNode = {
  url:           string;
  signerAddress: string | null;
  nodeType:      string | null;
  isLocal:       boolean;
  online:        boolean;
};

const NODE_TYPE_STYLE: Record<string, string> = {
  Origin: "text-amber-400 border-amber-400/30",
  Router: "text-amber-400 border-amber-400/30",
  Hybrid: "text-teal-400 border-teal-400/30",
};

function fmt(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtFull(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: Snapshot["status"] }) {
  if (status === "submitted") return (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border text-emerald-400 border-emerald-400/30">
      <CheckCircle2 className="w-3 h-3" /> submitted
    </span>
  );
  if (status === "signed") return (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border text-amber-400 border-amber-400/30">
      <CheckCircle2 className="w-3 h-3" /> signed
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border text-gb-muted border-gb-border">
      <Clock className="w-3 h-3" /> pending
    </span>
  );
}

// ── Consult Escrow (agent axis) — pay-on-verified-proof monitor ────────────────
const CONSULT_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS || "");
const ESCROW_JOBS_ABI = [{
  type: "function", name: "jobs", stateMutability: "view",
  inputs: [{ name: "", type: "bytes32" }],
  outputs: [
    { name: "consumer", type: "address" }, { name: "provider", type: "address" },
    { name: "attestor", type: "address" }, { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" }, { name: "status", type: "uint8" },
  ],
}] as const;
const ESCROW_STATUS = ["None", "Open", "Released", "Refunded"];
const ESCROW_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ESCROW_CHAIN_ID || "11155111"); // Sepolia
const ESCROW_WRITE_ABI = [
  { type: "function", name: "refund", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }], outputs: [] },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [{ name: "jobId", type: "bytes32" }, { name: "commitmentHash", type: "bytes32" }, { name: "signature", type: "bytes" }], outputs: [] },
] as const;

// Public RPCs cap eth_getLogs at ~50k blocks — scan in chunks from the contract's era.
const ESCROW_FROM_BLOCK = process.env.NEXT_PUBLIC_ESCROW_FROM_BLOCK ? BigInt(process.env.NEXT_PUBLIC_ESCROW_FROM_BLOCK) : null;
function eraFromBlock(latest: bigint): bigint {
  if (ESCROW_FROM_BLOCK !== null) return ESCROW_FROM_BLOCK;
  return latest > 300000n ? latest - 300000n : 0n; // ~6 weeks of mainnet — covers the current contracts' lifetime
}
async function getLogsChunked(client: any, params: { address: `0x${string}`; event: any }, fromBlock: bigint, toBlock: bigint, step = 45000n): Promise<any[]> {
  const out: any[] = [];
  for (let start = fromBlock; start <= toBlock; start += step) {
    const end = start + step - 1n > toBlock ? toBlock : start + step - 1n;
    try { out.push(...await client.getLogs({ ...params, fromBlock: start, toBlock: end })); }
    catch { /* skip a bad window rather than fail the whole feed */ }
  }
  return out;
}

function PlatformFeePanel() {
  const { token } = useAuth();
  const [feeEth, setFeeEth]     = useState("");
  const [treasury, setTreasury] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const s = await getConsultSettings(token);
        setFeeEth(s?.minFeeWei ? formatEther(BigInt(s.minFeeWei)) : "0");
        setTreasury(s?.treasury || "");
      } catch (e: any) { setErr(e?.message ?? String(e)); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function save() {
    setErr(null); setSaved(false); setSaving(true);
    try {
      const minFeeWei = parseEther((feeEth || "0").trim()).toString();
      const payload: { minFeeWei: string; treasury?: string } = { minFeeWei };
      if (treasury.trim()) payload.treasury = treasury.trim();
      await saveConsultSettings(token!, payload);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { setErr(e?.shortMessage || e?.message || String(e)); }
    finally { setSaving(false); }
  }

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-slate-200">Consult platform fee</h3>
        <span className="ml-auto text-[10px] text-slate-500">platform-wide · non-refundable</span>
      </div>
      <p className="text-xs text-slate-500">The min-fee leg charged on every paid consult, on top of the escrow stake — paid to the treasury and not refundable. Set to 0 to disable.</p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> loading…</div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] text-slate-400">Fee (ETH)</span>
            <input value={feeEth} onChange={(e) => setFeeEth(e.target.value)} placeholder="0"
              className="mt-1 w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors" />
          </label>
          <label className="block">
            <span className="text-[11px] text-slate-400">Treasury address</span>
            <input value={treasury} onChange={(e) => setTreasury(e.target.value)} placeholder="0x…"
              className="mt-1 w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors" />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Save fee
            </button>
            {saved && <span className="text-xs text-green-400">saved</span>}
            {err && <span className="text-xs text-amber-400 break-all">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ConsultEscrowPanel() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTx, setActionTx] = useState<string | null>(null);
  const [showRelease, setShowRelease] = useState(false);
  const [relHash, setRelHash] = useState("");
  const [relSig, setRelSig] = useState("");
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<null | { consumer: string; provider: string; attestor: string; amount: bigint; deadline: bigint; status: number }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<Array<{ jobId: string; provider: string; amount: bigint; deadline: bigint; status: number }>>([]);
  const [stats, setStats] = useState<null | { open: number; released: number; refunded: number; tvl: bigint; settled: bigint }>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const makeClient = async (): Promise<any> => {
    const rpc = process.env.NEXT_PUBLIC_ESCROW_RPC;
    if (rpc) { const { createPublicClient, http } = await import("viem"); return createPublicClient({ transport: http(rpc) }); }
    return publicClient;
  };

  const lookup = async (explicitId?: string) => {
    const raw = explicitId ?? jobId;
    if (!CONSULT_ESCROW_ADDRESS || !raw) return;
    setLoading(true); setError(null); setJob(null);
    try {
      const client = await makeClient();
      if (!client) throw new Error("no RPC — set NEXT_PUBLIC_ESCROW_RPC or connect a wallet on the escrow's chain");
      const id = (/^0x[0-9a-fA-F]{64}$/.test(raw) ? raw : keccak256(toHex(raw))) as `0x${string}`;
      const r = await client.readContract({ address: CONSULT_ESCROW_ADDRESS as `0x${string}`, abi: ESCROW_JOBS_ABI, functionName: "jobs", args: [id] }) as readonly [string, string, string, bigint, bigint, number];
      setJob({ consumer: r[0], provider: r[1], attestor: r[2], amount: r[3], deadline: r[4], status: Number(r[5]) });
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  };

  const loadFeed = async () => {
    if (!CONSULT_ESCROW_ADDRESS) return;
    setFeedLoading(true); setFeedError(null);
    try {
      const client = await makeClient();
      if (!client) throw new Error("no RPC — set NEXT_PUBLIC_ESCROW_RPC");
      const { parseAbiItem } = await import("viem");
      const addr = CONSULT_ESCROW_ADDRESS as `0x${string}`;
      const latest = await client.getBlockNumber();
      const from = eraFromBlock(latest);
      const [opened, released, refunded] = await Promise.all([
        getLogsChunked(client, { address: addr, event: parseAbiItem("event Opened(bytes32 indexed jobId, address indexed consumer, address indexed provider, address attestor, uint256 amount, uint256 deadline)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event Released(bytes32 indexed jobId, bytes32 commitmentHash, address provider, uint256 amount)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event Refunded(bytes32 indexed jobId, address consumer, uint256 amount)") }, from, latest),
      ]);
      const rel = new Set(released.map((l: any) => l.args.jobId));
      const ref = new Set(refunded.map((l: any) => l.args.jobId));
      const jobs: Array<{ jobId: string; provider: string; amount: bigint; deadline: bigint; status: number }> = opened.map((l: any) => ({
        jobId: l.args.jobId as string, provider: l.args.provider as string,
        amount: l.args.amount as bigint, deadline: l.args.deadline as bigint,
        status: ref.has(l.args.jobId) ? 3 : rel.has(l.args.jobId) ? 2 : 1,
      }));
      const tvl = jobs.filter(j => j.status === 1).reduce((a, j) => a + j.amount, 0n);
      const settled = jobs.filter(j => j.status === 2).reduce((a, j) => a + j.amount, 0n);
      setStats({ open: jobs.filter(j => j.status === 1).length, released: jobs.filter(j => j.status === 2).length, refunded: jobs.filter(j => j.status === 3).length, tvl, settled });
      setFeed(jobs.reverse());
    } catch (e: any) { setFeedError(e?.message ?? String(e)); }
    finally { setFeedLoading(false); }
  };

  const currentJobId = () => (/^0x[0-9a-fA-F]{64}$/.test(jobId) ? jobId : keccak256(toHex(jobId))) as `0x${string}`;
  const ensureChain = async () => {
    if (!walletClient) throw new Error("connect a wallet first");
    if (chainId !== ESCROW_CHAIN_ID) await switchChainAsync({ chainId: ESCROW_CHAIN_ID });
  };
  const sendWrite = async (fn: "refund" | "release", args: any[]) => {
    setActing(true); setActionError(null); setActionTx(null);
    try {
      await ensureChain();
      const hash = await walletClient!.writeContract({ address: CONSULT_ESCROW_ADDRESS as `0x${string}`, abi: ESCROW_WRITE_ABI, functionName: fn, args } as any);
      setActionTx(hash);
      const client = await makeClient();
      if (client?.waitForTransactionReceipt) await client.waitForTransactionReceipt({ hash });
      await lookup(); await loadFeed();
    } catch (e: any) { setActionError(e?.shortMessage ?? e?.message ?? String(e)); }
    finally { setActing(false); }
  };
  const doRefund = () => sendWrite("refund", [currentJobId()]);
  const doRelease = () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(relHash)) { setActionError("commitmentHash must be 0x + 64 hex"); return; }
    if (!/^0x[0-9a-fA-F]+$/.test(relSig)) { setActionError("signature must be 0x hex"); return; }
    return sendWrite("release", [currentJobId(), relHash as `0x${string}`, relSig as `0x${string}`]);
  };
  useEffect(() => { if (CONSULT_ESCROW_ADDRESS) loadFeed(); /* eslint-disable-next-line */ }, []);

  const nowSec = Math.floor(Date.now() / 1000);
  const sColor = (s: number) => s === 1 ? "text-amber-400" : s === 2 ? "text-green-400" : s === 3 ? "text-red-400" : "text-gb-faint";
  const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-green-400" />
        <p className="text-sm font-semibold text-slate-100">Consult Escrow — per-consult settlement (1:1)</p>
        {CONSULT_ESCROW_ADDRESS && (
          <button onClick={loadFeed} disabled={feedLoading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
            {feedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        )}
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        Pay-on-verified-proof: payment releases only against an attestor-signed signature over the result commitment (WYRIWE), or refunds after the deadline. Pay for provable work, not asserted work.
      </p>
      {!CONSULT_ESCROW_ADDRESS ? (
        <div className="flex items-start gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>No escrow deployed. Deploy <code className="bg-gb-input px-1 rounded">ConsultEscrow</code> in the Deploy tab, then set <code className="bg-gb-input px-1 rounded">NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS</code>.</span>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-5 gap-2 text-center">
              {[["Open", stats.open, "text-amber-400"], ["Released", stats.released, "text-green-400"], ["Refunded", stats.refunded, "text-red-400"], ["TVL", (Number(stats.tvl) / 1e18).toFixed(4), "text-slate-100"], ["Settled", (Number(stats.settled) / 1e18).toFixed(4), "text-slate-100"]].map(([label, val, cls]) => (
                <div key={String(label)} className="bg-gb-input/40 rounded-lg py-2">
                  <p className={`text-sm font-semibold ${cls}`}>{val as any}</p>
                  <p className="text-[10px] text-gb-muted uppercase tracking-wide">{label as any}{(label === "TVL" || label === "Settled") ? " ETH" : ""}</p>
                </div>
              ))}
            </div>
          )}
          {feedError && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {feedError}</div>}
          {feed.length > 0 && (
            <div className="border border-gb-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide border-b border-gb-border">
                <span>Job</span><span>Status</span><span className="text-right">Amount</span><span className="text-right">Deadline</span>
              </div>
              {feed.map((j) => {
                const expired = j.status === 1 && Number(j.deadline) < nowSec;
                return (
                  <div key={j.jobId} onClick={() => { setJobId(j.jobId); setShowRelease(false); setActionError(null); setActionTx(null); lookup(j.jobId); }} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-xs border-b border-gb-border/40 last:border-0 items-center cursor-pointer hover:bg-gb-input/30 transition-colors">
                    <span className="font-mono text-slate-300 truncate" title={j.jobId}>{short(j.jobId)}</span>
                    <span className={sColor(j.status)}>{ESCROW_STATUS[j.status]}{expired ? " · expired" : ""}</span>
                    <span className="text-right font-mono text-slate-200">{(Number(j.amount) / 1e18).toFixed(4)}</span>
                    <span className={`text-right ${expired ? "text-red-400" : "text-gb-muted"}`}>{new Date(Number(j.deadline) * 1000).toLocaleDateString()}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!feedLoading && feed.length === 0 && !feedError && <p className="text-xs text-gb-muted">No jobs yet on <code className="text-gb-accent bg-gb-input px-1 rounded">{short(CONSULT_ESCROW_ADDRESS)}</code>.</p>}

          <div className="pt-1 space-y-2 border-t border-gb-border/40">
            <p className="text-[11px] font-semibold text-gb-faint uppercase tracking-wide">Look up a job</p>
            <div className="flex items-center gap-2">
              <input value={jobId} onChange={(e) => setJobId(e.target.value)} placeholder="jobId (0x… bytes32, or a label to hash)"
                className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
              <button onClick={() => lookup()} disabled={loading || !jobId} className="px-4 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent disabled:opacity-40 text-sm font-medium transition-colors">{loading ? "…" : "Look up"}</button>
            </div>
            {error && <div className="flex items-start gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
            {job && (
              <div className="space-y-1.5 text-xs bg-gb-input/40 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-gb-muted">Status</span><span className={sColor(job.status)}>{ESCROW_STATUS[job.status] ?? job.status}</span></div>
                <div className="flex justify-between"><span className="text-gb-muted">Amount</span><span className="text-slate-200 font-mono">{(Number(job.amount) / 1e18).toFixed(6)} ETH</span></div>
                <div className="flex justify-between gap-4"><span className="text-gb-muted shrink-0">Consumer</span><span className="text-slate-300 font-mono break-all">{job.consumer}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gb-muted shrink-0">Provider</span><span className="text-slate-300 font-mono break-all">{job.provider}</span></div>
                <div className="flex justify-between gap-4"><span className="text-gb-muted shrink-0">Attestor</span><span className="text-slate-300 font-mono break-all">{job.attestor}</span></div>
                <div className="flex justify-between"><span className="text-gb-muted">Deadline</span><span className="text-slate-300">{job.deadline > 0n ? new Date(Number(job.deadline) * 1000).toLocaleString() : "—"}</span></div>
                {job.status === 1 && (
                  <div className="pt-2 mt-1 border-t border-gb-border/40 space-y-2">
                    {walletClient && chainId !== ESCROW_CHAIN_ID && (
                      <p className="text-[10px] text-amber-400">Wallet on chain {chainId} — actions will prompt a switch to the escrow chain ({ESCROW_CHAIN_ID}).</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={doRefund} disabled={acting || !walletClient || Number(job.deadline) > nowSec}
                        title={Number(job.deadline) > nowSec ? "Refundable only after the deadline" : "Refund the consumer (permissionless keeper)"}
                        className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 disabled:opacity-40 text-xs font-medium transition-colors">
                        {acting ? "…" : "Refund"}
                      </button>
                      <button onClick={() => setShowRelease(v => !v)} disabled={acting || !walletClient}
                        className="px-3 py-1.5 rounded-lg border border-green-400/30 text-green-400 hover:bg-green-400/10 disabled:opacity-40 text-xs font-medium transition-colors">
                        Release…
                      </button>
                      {Number(job.deadline) > nowSec && <span className="text-[10px] text-gb-muted">refundable after {new Date(Number(job.deadline) * 1000).toLocaleDateString()}</span>}
                    </div>
                    {showRelease && (
                      <div className="space-y-1.5 bg-gb-bg/40 rounded-lg p-2.5">
                        <p className="text-[10px] text-gb-muted leading-relaxed">Release pays the provider — requires the attestor’s signature over the result commitment (WYRIWE). Paste both from the completed consult.</p>
                        <input value={relHash} onChange={(e) => setRelHash(e.target.value.trim())} placeholder="commitmentHash (0x… bytes32)" className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
                        <input value={relSig} onChange={(e) => setRelSig(e.target.value.trim())} placeholder="attestorSignature (0x…)" className="w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-100 placeholder-zinc-600 outline-none transition-colors" />
                        <button onClick={doRelease} disabled={acting || !relHash || !relSig}
                          className="px-3 py-1.5 rounded-lg bg-green-600/80 hover:bg-green-600 disabled:opacity-40 text-xs font-medium transition-colors">
                          {acting ? "Releasing…" : "Release to provider"}
                        </button>
                      </div>
                    )}
                    {actionError && <p className="text-[11px] text-red-400 break-all">{actionError}</p>}
                    {actionTx && <p className="text-[11px] text-green-300 break-all">tx sent: {actionTx}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── CommitRevealSettler (M3) — on-chain commit-reveal of the period snapshot ────
const COMMIT_REVEAL_ADDRESS = (process.env.NEXT_PUBLIC_COMMIT_REVEAL_SETTLER_ADDRESS || "");

function CommitRevealPanel() {
  const publicClient = usePublicClient();
  const [feed, setFeed] = useState<Array<{ periodId: bigint; node: string; state: "committed" | "revealed" | "mismatch"; rowCount?: bigint }>>([]);
  const [stats, setStats] = useState<null | { committed: number; revealed: number; mismatch: number }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeClient = async (): Promise<any> => {
    const rpc = process.env.NEXT_PUBLIC_ESCROW_RPC;
    if (rpc) { const { createPublicClient, http } = await import("viem"); return createPublicClient({ transport: http(rpc) }); }
    return publicClient;
  };

  const load = async () => {
    if (!COMMIT_REVEAL_ADDRESS) return;
    setLoading(true); setError(null);
    try {
      const client = await makeClient();
      if (!client) throw new Error("no RPC — set NEXT_PUBLIC_ESCROW_RPC");
      const { parseAbiItem } = await import("viem");
      const addr = COMMIT_REVEAL_ADDRESS as `0x${string}`;
      const latest = await client.getBlockNumber();
      const from = eraFromBlock(latest);
      const [committed, revealed, mismatch] = await Promise.all([
        getLogsChunked(client, { address: addr, event: parseAbiItem("event Committed(uint256 indexed periodId, address indexed nodeAddress, bytes32 commitmentHash)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event Revealed(uint256 indexed periodId, address indexed nodeAddress, bytes32 snapshotRoot, uint256 rowCount)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event RevealMismatch(uint256 indexed periodId, address indexed nodeAddress, bytes32 expected, bytes32 actual)") }, from, latest),
      ]);
      const key = (p: bigint, n: string) => `${p}:${n.toLowerCase()}`;
      const revMap = new Map<string, any>(revealed.map((l: any) => [key(l.args.periodId, l.args.nodeAddress), l]));
      const misSet = new Set<string>(mismatch.map((l: any) => key(l.args.periodId, l.args.nodeAddress)));
      const rows: Array<{ periodId: bigint; node: string; state: "committed" | "revealed" | "mismatch"; rowCount?: bigint }> = committed.map((l: any) => {
        const k = key(l.args.periodId, l.args.nodeAddress);
        const rev = revMap.get(k);
        const state: "committed" | "revealed" | "mismatch" = misSet.has(k) ? "mismatch" : rev ? "revealed" : "committed";
        return { periodId: l.args.periodId as bigint, node: l.args.nodeAddress as string, state, rowCount: rev?.args.rowCount as bigint | undefined };
      });
      setStats({ committed: committed.length, revealed: revealed.length, mismatch: mismatch.length });
      setFeed(rows.reverse());
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (COMMIT_REVEAL_ADDRESS) load(); /* eslint-disable-next-line */ }, []);
  const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
  const stateColor = (s: string) => s === "revealed" ? "text-green-400" : s === "mismatch" ? "text-red-400" : "text-amber-400";

  if (!COMMIT_REVEAL_ADDRESS) return null; // hidden in this build until deployed
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-gb-accent" />
        <p className="text-sm font-semibold text-slate-100">CommitRevealSettler (M3) — on-chain snapshot commit-reveal</p>
        {COMMIT_REVEAL_ADDRESS && (
          <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        )}
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        The on-chain leg of the Contribution Snapshot: each node commits <code className="bg-gb-input px-1 rounded">keccak256(snapshotRoot, periodId, node)</code>, then reveals the rows. The chain re-derives the root and flags any reveal that doesn&apos;t match its commit — settlement asserts delivery, never quality.
      </p>
      {!COMMIT_REVEAL_ADDRESS ? (
        <div className="flex items-start gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Not deployed. Deploy <code className="bg-gb-input px-1 rounded">CommitRevealSettler</code> in the Deploy tab, then set <code className="bg-gb-input px-1 rounded">NEXT_PUBLIC_COMMIT_REVEAL_SETTLER_ADDRESS</code>.</span>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Committed", stats.committed, "text-amber-400"], ["Revealed", stats.revealed, "text-green-400"], ["Mismatch", stats.mismatch, "text-red-400"]].map(([label, val, cls]) => (
                <div key={String(label)} className="bg-gb-input/40 rounded-lg py-2">
                  <p className={`text-sm font-semibold ${cls}`}>{val as any}</p>
                  <p className="text-[10px] text-gb-muted uppercase tracking-wide">{label as any}</p>
                </div>
              ))}
            </div>
          )}
          {error && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
          {feed.length > 0 && (
            <div className="border border-gb-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide border-b border-gb-border">
                <span>Period</span><span>Node</span><span>State</span><span className="text-right">Rows</span>
              </div>
              {feed.map((r, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-3 py-2 text-xs border-b border-gb-border/40 last:border-0 items-center">
                  <span className="font-mono text-slate-300">#{String(r.periodId)}</span>
                  <span className="font-mono text-gb-faint truncate" title={r.node}>{short(r.node)}</span>
                  <span className={stateColor(r.state)}>{r.state}</span>
                  <span className="text-right font-mono text-slate-200">{r.rowCount !== undefined ? String(r.rowCount) : "—"}</span>
                </div>
              ))}
            </div>
          )}
          {!loading && feed.length === 0 && !error && <p className="text-xs text-gb-muted">No commits yet on <code className="text-gb-accent bg-gb-input px-1 rounded">{short(COMMIT_REVEAL_ADDRESS)}</code>.</p>}
        </>
      )}
    </div>
  );
}

// ── EscrowV1 (M4) — agent order escrow with dispute/arbitration ─────────────────
const ESCROW_V1_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_V1_ADDRESS || "");
const ORDER_STATUS = ["Pending", "Confirmed", "Disputed", "Refunded", "Resolved"];

function EscrowV1Panel() {
  const publicClient = usePublicClient();
  const [feed, setFeed] = useState<Array<{ orderId: string; agentId: string; amount: bigint; status: number }>>([]);
  const [stats, setStats] = useState<null | { pending: number; confirmed: number; disputed: number; resolved: number; refunded: number; tvl: bigint; settled: bigint }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeClient = async (): Promise<any> => {
    const rpc = process.env.NEXT_PUBLIC_ESCROW_RPC;
    if (rpc) { const { createPublicClient, http } = await import("viem"); return createPublicClient({ transport: http(rpc) }); }
    return publicClient;
  };

  const load = async () => {
    if (!ESCROW_V1_ADDRESS) return;
    setLoading(true); setError(null);
    try {
      const client = await makeClient();
      if (!client) throw new Error("no RPC — set NEXT_PUBLIC_ESCROW_RPC");
      const { parseAbiItem } = await import("viem");
      const addr = ESCROW_V1_ADDRESS as `0x${string}`;
      const latest = await client.getBlockNumber();
      const from = eraFromBlock(latest);
      const [created, confirmed, disputed, resolved, refunded] = await Promise.all([
        getLogsChunked(client, { address: addr, event: parseAbiItem("event OrderCreated(bytes32 indexed orderId, bytes32 indexed agentId, address indexed client, uint256 amount)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event OrderConfirmed(bytes32 indexed orderId)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event OrderDisputed(bytes32 indexed orderId, bytes reason)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event OrderResolved(bytes32 indexed orderId, uint8 resolution)") }, from, latest),
        getLogsChunked(client, { address: addr, event: parseAbiItem("event OrderRefunded(bytes32 indexed orderId)") }, from, latest),
      ]);
      const conf = new Set(confirmed.map((l: any) => l.args.orderId));
      const disp = new Set(disputed.map((l: any) => l.args.orderId));
      const reso = new Set(resolved.map((l: any) => l.args.orderId));
      const refu = new Set(refunded.map((l: any) => l.args.orderId));
      const statusOf = (id: string) => refu.has(id) ? 3 : reso.has(id) ? 4 : conf.has(id) ? 1 : disp.has(id) ? 2 : 0;
      const orders: Array<{ orderId: string; agentId: string; amount: bigint; status: number }> = created.map((l: any) => ({
        orderId: l.args.orderId as string, agentId: l.args.agentId as string,
        amount: l.args.amount as bigint, status: statusOf(l.args.orderId),
      }));
      const tvl = orders.filter(o => o.status === 0 || o.status === 2).reduce((a, o) => a + o.amount, 0n);
      const settled = orders.filter(o => o.status === 1 || o.status === 4).reduce((a, o) => a + o.amount, 0n);
      setStats({
        pending: orders.filter(o => o.status === 0).length, confirmed: orders.filter(o => o.status === 1).length,
        disputed: orders.filter(o => o.status === 2).length, resolved: orders.filter(o => o.status === 4).length,
        refunded: orders.filter(o => o.status === 3).length, tvl, settled,
      });
      setFeed(orders.reverse());
    } catch (e: any) { setError(e?.message ?? String(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (ESCROW_V1_ADDRESS) load(); /* eslint-disable-next-line */ }, []);
  const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
  const sColor = (s: number) => s === 0 ? "text-amber-400" : s === 1 ? "text-green-400" : s === 2 ? "text-orange-400" : s === 3 ? "text-red-400" : "text-amber-400";

  if (!ESCROW_V1_ADDRESS) return null; // hidden in this build until deployed
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="w-4 h-4 text-gb-accent" />
        <p className="text-sm font-semibold text-slate-100">EscrowV1 (M4) — agent order escrow</p>
        {ESCROW_V1_ADDRESS && (
          <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        )}
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        Per-order escrow with dispute + arbitration: a client funds an order to an agent, confirms delivery to release, or disputes for an arbitrator to resolve. Refundable after the deadline. The order-level ledger under the per-period aggregate.
      </p>
      {!ESCROW_V1_ADDRESS ? (
        <div className="flex items-start gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Not deployed. Deploy <code className="bg-gb-input px-1 rounded">EscrowV1</code> in the Deploy tab, then set <code className="bg-gb-input px-1 rounded">NEXT_PUBLIC_ESCROW_V1_ADDRESS</code>.</span>
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-5 gap-2 text-center">
              {[["Pending", stats.pending, "text-amber-400"], ["Confirmed", stats.confirmed, "text-green-400"], ["Disputed", stats.disputed, "text-orange-400"], ["TVL", (Number(stats.tvl) / 1e18).toFixed(4), "text-slate-100"], ["Settled", (Number(stats.settled) / 1e18).toFixed(4), "text-slate-100"]].map(([label, val, cls]) => (
                <div key={String(label)} className="bg-gb-input/40 rounded-lg py-2">
                  <p className={`text-sm font-semibold ${cls}`}>{val as any}</p>
                  <p className="text-[10px] text-gb-muted uppercase tracking-wide">{label as any}{(label === "TVL" || label === "Settled") ? " ETH" : ""}</p>
                </div>
              ))}
            </div>
          )}
          {error && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
          {feed.length > 0 && (
            <div className="border border-gb-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide border-b border-gb-border">
                <span>Order</span><span>Agent</span><span>Status</span><span className="text-right">Amount</span>
              </div>
              {feed.map((o) => (
                <div key={o.orderId} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 px-3 py-2 text-xs border-b border-gb-border/40 last:border-0 items-center">
                  <span className="font-mono text-slate-300 truncate" title={o.orderId}>{short(o.orderId)}</span>
                  <span className="font-mono text-gb-faint truncate" title={o.agentId}>{short(o.agentId)}</span>
                  <span className={sColor(o.status)}>{ORDER_STATUS[o.status]}</span>
                  <span className="text-right font-mono text-slate-200">{(Number(o.amount) / 1e18).toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
          {!loading && feed.length === 0 && !error && <p className="text-xs text-gb-muted">No orders yet on <code className="text-gb-accent bg-gb-input px-1 rounded">{short(ESCROW_V1_ADDRESS)}</code>.</p>}
        </>
      )}
    </div>
  );
}

// ── Consult jobs — gateway settlement ledger (backend audit view) ──────────────
function ConsultJobsAuditPanel() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ escrow: string | null; chainId: number }>({ escrow: null, chainId: 1 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/consult/jobs`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setJobs(d.jobs ?? []); setMeta({ escrow: d.escrow ?? null, chainId: d.chainId ?? 1 });
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const explorer = meta.chainId === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";
  const short = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
  const eth = (wei: string) => { try { return (Number(BigInt(wei)) / 1e18).toFixed(4); } catch { return "0"; } };
  const statusPill = (s: string) => {
    const m: Record<string, string> = { released: "text-green-400 border-green-400/30", open: "text-amber-400 border-amber-400/30", refunded: "text-red-400 border-red-400/30" };
    return <span className={`text-[10px] px-2 py-0.5 rounded border ${m[s] ?? "text-gb-muted border-gb-border"}`}>{s}</span>;
  };

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-green-400" />
        <p className="text-sm font-semibold text-slate-100">Consult jobs — gateway settlement ledger</p>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        Every paid consult the gateway processed, with its on-chain settlement — the backend audit trail. Correlate a job to its release tx and recompute result → commitment → attestor from the proof artifact.
      </p>
      {err && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}</div>}
      {!loading && jobs.length === 0 && !err && <p className="text-xs text-gb-muted">No consult jobs recorded yet.</p>}
      {jobs.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gb-border">
          <table className="w-full text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-gb-border bg-gb-bg text-[10px] text-gb-muted uppercase tracking-wide">
                <th className="text-left px-3 py-2">Job</th>
                <th className="text-left px-3 py-2">Consumer</th>
                <th className="text-left px-3 py-2">Agent</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Release tx</th>
                <th className="text-right px-3 py-2">Proof</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId} className="border-b border-gb-border/40 last:border-0 hover:bg-gb-bg/50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-slate-300" title={j.jobId}>{short(j.jobId)}</td>
                  <td className="px-3 py-2.5 font-mono text-gb-faint" title={j.consumer}>{short(j.consumer)}</td>
                  <td className="px-3 py-2.5 font-mono text-gb-faint" title={`${j.registry}/${j.agentId}`}>#{j.agentId}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-200">{eth(j.amountWei)}</td>
                  <td className="px-3 py-2.5">{statusPill(j.status)}</td>
                  <td className="px-3 py-2.5">
                    {j.releaseTx
                      ? <a href={`${explorer}/tx/${j.releaseTx}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:text-brass">{short(j.releaseTx)}</a>
                      : <span className="text-gb-muted">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {j.resultHash
                      ? <a href={`${getGatewayUrl()}/agent/consult/job/${j.jobId}/proof`} target="_blank" rel="noreferrer" className="text-brassLight hover:text-brass">recompute →</a>
                      : <span className="text-gb-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta.escrow && <p className="text-[10px] text-gb-muted">escrow <code className="bg-gb-input px-1 rounded font-mono">{short(meta.escrow)}</code> · chain {meta.chainId}</p>}
    </div>
  );
}

// ── Attestation Mesh — every node's 6 tiers; attestations shared via Chainlink CCIP ──
const MESH_TIERS: { key: string; label: string }[] = [
  { key: "signed", label: "signed" }, { key: "erc8004", label: "8004" }, { key: "wyriwe", label: "wyriwe" },
  { key: "erc8281", label: "8281" }, { key: "vni", label: "vni" }, { key: "onChain", label: "on-chain" },
];
function AttestationMeshPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<{ nodes: any[]; attestationIndex: string | null; nodeRegistry: string | null; chainId: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/mesh/health`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const short = (a?: string | null) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "—");
  const explorer = data?.chainId === 11155111 ? "https://sepolia.etherscan.io" : "https://etherscan.io";
  const nodes = data?.nodes ?? [];
  const online = nodes.filter((n) => n.online).length;

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-gb-accent" />
        <p className="text-sm font-semibold text-slate-100">Attestation Mesh</p>
        <span className="text-[10px] text-gb-muted">{online}/{nodes.length || "…"} online</span>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 text-xs text-gb-muted hover:text-slate-300 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>
      <p className="text-xs text-gb-muted leading-relaxed">
        Every attestation this gateway signs is propagated across the mesh via Chainlink CCIP — no single node is the source of truth. Each node independently satisfies the six tiers, so any node can serve the recompute.
      </p>
      {err && <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}</div>}
      {nodes.length > 0 && (
        <div className="space-y-2">
          {nodes.map((n, i) => (
            <div key={i} className="border border-gb-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.online ? "bg-emerald-400" : "bg-red-400/60"}`} />
                <span className="font-mono text-xs text-slate-300 truncate">{(n.url || "").replace(/^https?:\/\//, "") || "—"}</span>
                {n.isLocal && <span className="text-[9px] px-1.5 py-0.5 rounded border text-gb-accent border-gb-accent/30 shrink-0">this node</span>}
                {typeof n.records === "number" && <span className="ml-auto text-[10px] text-gb-muted shrink-0">{n.records} records</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MESH_TIERS.map(({ key, label }) => {
                  const ok = n.tiers?.[key];
                  return (
                    <span key={key} className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${ok ? "text-emerald-400 border-emerald-400/30" : n.online ? "text-gb-muted border-gb-border" : "text-gb-faint/40 border-gb-border/40"}`}>
                      {ok ? "✓" : "·"} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && nodes.length === 0 && !err && <p className="text-xs text-gb-muted">No mesh nodes configured.</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[10px] text-gb-muted">
        {data?.attestationIndex && <span>AttestationIndex <a href={`${explorer}/address/${data.attestationIndex}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:text-brass">{short(data.attestationIndex)}</a></span>}
        {data?.nodeRegistry && <span>NodeRegistry <a href={`${explorer}/address/${data.nodeRegistry}`} target="_blank" rel="noreferrer" className="font-mono text-brassLight hover:text-brass">{short(data.nodeRegistry)}</a></span>}
        <span>· anchored on mainnet</span>
      </div>
    </div>
  );
}

export default function SettlementPage() {
  const { token }                     = useAuth();
  const { address }                   = useAccount();
  const { signMessageAsync }          = useSignMessage();
  const now                           = Math.floor(Date.now() / 1000);
  const currentPeriod                 = Math.floor(now / PERIOD_DURATION);
  const [period, setPeriod]           = useState(currentPeriod);
  const [snapshot, setSnapshot]       = useState<Snapshot | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [signing, setSigning]         = useState(false);
  const [signError, setSignError]     = useState<string | null>(null);
  const [peerConfs, setPeerConfs]         = useState<PeerConfirmation[]>([]);
  const [showPeerConfs, setShowPeerConfs] = useState(false);
  const [nodes, setNodes]               = useState<MeshNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [history, setHistory]           = useState<SnapshotRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSnapshot = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getGatewayUrl()}/contributions/snapshot?period=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSnapshot(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Failed to load snapshot");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNodes = useCallback(async () => {
    setNodesLoading(true);
    try {
      const res = await fetch(`${getGatewayUrl()}/admin/mesh/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNodes(data.nodes ?? []);
    } catch {
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, [token]);

  const fetchPeerConfs = useCallback(async (p: number) => {
    try {
      const res = await fetch(`${getGatewayUrl()}/contributions/snapshot/peers?period=${p}`);
      if (!res.ok) return;
      const data = await res.json();
      setPeerConfs(data.peers ?? []);
    } catch { setPeerConfs([]); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${getGatewayUrl()}/contributions/snapshots`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data.snapshots ?? []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { fetchSnapshot(period); fetchPeerConfs(period); }, [period, fetchSnapshot, fetchPeerConfs]);
  useEffect(() => { fetchNodes(); fetchHistory(); }, [fetchNodes, fetchHistory]);

  const isCurrent = period === currentPeriod;

  // The Mesh Nodes card must never show emptier than the (public) Contribution
  // Snapshot above it. The authed /admin/mesh/nodes call enriches with signer +
  // live online status, but it can race the JWT and 401 → []. Fall back to the
  // snapshot rows (same peers, always available) so the two cards stay consistent.
  const snapshotNodes: MeshNode[] = (snapshot?.rows ?? []).map((r) => ({
    url: r.source, signerAddress: null, nodeType: r.nodeType as string, isLocal: r.isLocal, online: true,
  }));
  const displayNodes = nodes.length ? nodes : snapshotNodes;

  const handleSign = async () => {
    if (!snapshot || !address) return;
    setSigning(true);
    setSignError(null);
    try {
      // Freeze first (idempotent) to lock the rows before hashing
      const freezeRes = await fetch(`${getGatewayUrl()}/contributions/snapshot/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: snapshot.period, namespace: snapshot.namespace }),
      });
      if (!freezeRes.ok) throw new Error("Failed to freeze snapshot");
      const { rows: frozenRows } = await freezeRes.json();

      const payload = JSON.stringify({
        period:    snapshot.period,
        namespace: snapshot.namespace,
        rows:      [...frozenRows].sort((a: any, b: any) => a.source.localeCompare(b.source)),
      });
      const hash = keccak256(toHex(payload));
      const signature = await signMessageAsync({ message: hash });
      const res = await fetch(`${getGatewayUrl()}/contributions/snapshot/sign`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ period: snapshot.period, namespace: snapshot.namespace, hash, signature, signer: address }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchSnapshot(period);
      await fetchPeerConfs(period);
    } catch (e: any) {
      setSignError(e.message ?? "Signing failed");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Coins className="w-5 h-5 text-gb-accent" />
            Settlement
          </h1>
          <p className="text-xs text-gb-muted mt-0.5">
            ERC-8275 settlement (Step 6), two granularities — per-consult escrow (1:1) + per-period mesh compensation. Kept independent of Reputation (Step 7).
          </p>
        </div>
        <button onClick={() => { fetchSnapshot(period); fetchNodes(); fetchHistory(); fetchPeerConfs(period); }} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* ══ Settlement · per-consult granularity (1:1) ══ */}
      <PlatformFeePanel />
      <ConsultEscrowPanel />
      <ConsultJobsAuditPanel />

      {/* ══ Mesh Node Economics — per-period settlement (aggregate) (ERC-8275) ══ */}
      <p className="text-[11px] font-semibold text-gb-faint uppercase tracking-wider pt-2">Infra axis — attestation mesh</p>
      <AttestationMeshPanel />

      {/* ── Section 1: Contribution Snapshot ─────────────────────────── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">Contribution Snapshot</p>
          {snapshot && <StatusBadge status={snapshot.status} />}
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-3">
          <button onClick={() => setPeriod(p => p - 1)}
            className="p-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-slate-100">
              Period #{period}
              {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gb-accent/20 text-gb-accent font-mono">current</span>}
            </p>
            {snapshot && (
              <p className="text-[11px] text-gb-muted mt-0.5">
                {fmt(snapshot.periodStart)} → {fmt(snapshot.periodEnd)}
              </p>
            )}
          </div>
          <button onClick={() => setPeriod(p => p + 1)} disabled={isCurrent}
            className="p-1.5 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Summary */}
        {snapshot && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gb-bg rounded-lg px-4 py-3">
              <p className="text-[10px] text-gb-muted uppercase tracking-wide">Total records</p>
              <p className="text-2xl font-bold text-slate-100 mt-0.5">{snapshot.totalRecords}</p>
            </div>
            <div className="bg-gb-bg rounded-lg px-4 py-3">
              <p className="text-[10px] text-gb-muted uppercase tracking-wide">Peer confirmations</p>
              <p className="text-2xl font-bold text-slate-100 mt-0.5">{snapshot.peerConfirmations}</p>
            </div>
            <div className="bg-gb-bg rounded-lg px-4 py-3">
              <p className="text-[10px] text-gb-muted uppercase tracking-wide">Namespace</p>
              <p className="text-xs font-mono text-slate-300 mt-1 truncate">{snapshot.namespace}</p>
            </div>
          </div>
        )}

        {/* Rows table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gb-muted" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        ) : snapshot?.rows.length ? (
          <div className="overflow-hidden rounded-lg border border-gb-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gb-border bg-gb-bg">
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Node</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Type</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Records</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Share</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.rows.map((row, i) => (
                  <tr key={i} className="border-b border-gb-border/50 last:border-0 hover:bg-gb-bg/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {row.isLocal && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border text-gb-accent border-gb-accent/30 shrink-0">this node</span>
                        )}
                        <span className="font-mono text-gb-faint truncate max-w-[200px]">
                          {row.source.replace(/^https?:\/\//, "")}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${NODE_TYPE_STYLE[row.nodeType] ?? "text-gb-muted border-gb-border"}`}>
                        {row.nodeType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-100">{row.records}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gb-border rounded-full overflow-hidden">
                          <div className="h-full bg-gb-accent rounded-full" style={{ width: `${row.share}%` }} />
                        </div>
                        <span className="text-gb-muted w-10 text-right">{row.share}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gb-muted text-center py-6">No records for this period</p>
        )}

        {/* Frozen indicator */}
        {snapshot?.frozen_at && snapshot.status === "pending" && (
          <div className="flex items-center gap-2 text-[11px] text-amber-400/70 bg-amber-400/5 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Rows frozen · {fmtFull(snapshot.frozen_at)} — hash will be reproducible
          </div>
        )}

        {/* Sign snapshot */}
        {snapshot && snapshot.status === "pending" && (
          <div className="pt-1 space-y-2">
            {signError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {signError}
              </div>
            )}
            <button onClick={handleSign} disabled={signing || !address}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 disabled:opacity-40 transition-colors">
              {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
              {signing ? "Waiting for signature…" : "Sign Snapshot"}
            </button>
          </div>
        )}

        {snapshot?.status === "signed" && snapshot.signed_at && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] text-amber-400/70 bg-amber-400/5 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Signed by <span className="font-mono truncate max-w-[160px]">{snapshot.signer}</span>
              &nbsp;· {fmtFull(snapshot.signed_at)}
              {peerConfs.length > 0 && (
                <button onClick={() => setShowPeerConfs(v => !v)}
                  className="ml-auto text-[10px] text-gb-muted hover:text-slate-300 underline underline-offset-2 transition-colors">
                  {peerConfs.length} peer confirmation{peerConfs.length !== 1 ? "s" : ""} {showPeerConfs ? "▲" : "▼"}
                </button>
              )}
            </div>
            {showPeerConfs && peerConfs.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-gb-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gb-border bg-gb-bg">
                      <th className="text-left px-3 py-1.5 text-[10px] text-gb-muted uppercase tracking-wide">Source</th>
                      <th className="text-left px-3 py-1.5 text-[10px] text-gb-muted uppercase tracking-wide">Signer</th>
                      <th className="text-left px-3 py-1.5 text-[10px] text-gb-muted uppercase tracking-wide">Hash</th>
                      <th className="text-right px-3 py-1.5 text-[10px] text-gb-muted uppercase tracking-wide">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peerConfs.map((p, i) => (
                      <tr key={i} className="border-b border-gb-border/30 last:border-0">
                        <td className="px-3 py-2 font-mono text-gb-faint truncate max-w-[140px]">{p.source.replace(/^https?:\/\//, "")}</td>
                        <td className="px-3 py-2 font-mono text-gb-faint">{p.signer ? `${p.signer.slice(0,6)}…${p.signer.slice(-4)}` : "—"}</td>
                        <td className="px-3 py-2 font-mono text-gb-faint/60">{p.snapshot_hash ? `${p.snapshot_hash.slice(0,10)}…` : "—"}</td>
                        <td className="px-3 py-2 text-right text-gb-muted">{fmtFull(p.received_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Section 1a: CommitRevealSettler (M3) — on-chain leg of the snapshot ── */}
      <CommitRevealPanel />

      {/* ── Section 1c: EscrowV1 (M4) — agent order escrow ─────────────────────── */}
      <EscrowV1Panel />

      {/* ── Section 1b: Snapshot History ─────────────────────────────── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-gb-accent" />
          Snapshot History
        </p>
        {historyLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gb-muted" />
          </div>
        ) : history.length ? (
          <div className="overflow-hidden rounded-lg border border-gb-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gb-border bg-gb-bg">
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Period</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Signed by</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Date</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Hash</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.period} className="border-b border-gb-border/50 last:border-0 hover:bg-gb-bg/50 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-slate-300">#{h.period}</td>
                    <td className="px-3 py-2.5 font-mono text-gb-faint">
                      {h.signer ? `${h.signer.slice(0, 6)}…${h.signer.slice(-4)}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-gb-muted">
                      {h.signed_at ? fmtFull(h.signed_at) : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gb-faint/60">
                      {h.snapshot_hash ? `${h.snapshot_hash.slice(0, 10)}…` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <StatusBadge status={h.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gb-muted text-center py-6">No signed snapshots yet</p>
        )}
      </div>

      {/* ── Section 2: Mesh Nodes ─────────────────────────────────────── */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Network className="w-4 h-4 text-gb-accent" />
            Mesh Nodes
          </p>
          <span className="text-[10px] text-gb-muted">{displayNodes.length} node{displayNodes.length !== 1 ? "s" : ""}</span>
        </div>

        {nodesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gb-muted" />
          </div>
        ) : displayNodes.length ? (
          <div className="overflow-hidden rounded-lg border border-gb-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gb-border bg-gb-bg">
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Node</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Type</th>
                  <th className="text-left px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Signer</th>
                  <th className="text-right px-3 py-2 text-[10px] text-gb-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayNodes.map((node, i) => (
                  <tr key={i} className="border-b border-gb-border/50 last:border-0 hover:bg-gb-bg/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {node.isLocal && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border text-gb-accent border-gb-accent/30 shrink-0">this node</span>
                        )}
                        <span className="font-mono text-gb-faint truncate max-w-[180px]">
                          {node.url.replace(/^https?:\/\//, "") || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {node.nodeType ? (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${NODE_TYPE_STYLE[node.nodeType] ?? "text-gb-muted border-gb-border"}`}>
                          {node.nodeType}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gb-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-gb-faint truncate max-w-[140px]">
                      {node.signerAddress
                        ? `${node.signerAddress.slice(0, 6)}…${node.signerAddress.slice(-4)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {node.online ? (
                        <span className="flex items-center justify-end gap-1 text-emerald-400">
                          <Wifi className="w-3 h-3" />
                          <span className="text-[10px]">online</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1 text-red-400/60">
                          <WifiOff className="w-3 h-3" />
                          <span className="text-[10px]">offline</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gb-muted text-center py-6">No peers configured</p>
        )}
        <div className="rounded-lg border border-gb-border/40 bg-gb-bg/40 px-4 py-3 text-[11px] text-gb-muted/60">
          On-chain NodeRegistry (M2) coming once Sepolia contracts are deployed. Node types currently read from <span className="font-mono">NODE_TYPE</span> env var.
        </div>
      </div>
    </div>
  );
}
