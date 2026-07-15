"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { Check, X, Loader2, Wallet, Settings, CheckCircle2 } from "lucide-react";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";
import { ProfileEditor } from "@/components/ProfileEditor";

const GW_URL       = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const PARENT_NAME  = process.env.NEXT_PUBLIC_ENS_NAME   || "dinamic.eth";

const REGISTRAR_ADDRESS = "0xe6741f7947ea2581413f84db617bf0e3dcdadc49" as const;

const REGISTRAR_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "label", type: "string" }],
    outputs: [],
  },
] as const;

const CLAIM_TOKEN_KEY = "ens-kit-claim-token";

// ── helpers ───────────────────────────────────────────────────────────────────

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

function isValidLabel(s: string) {
  return /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(s);
}

async function checkAvailability(label: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${GW_URL}/api/claim/check?label=${encodeURIComponent(label)}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.available ?? null;
  } catch { return null; }
}

// ── SIWE login for the claim context ─────────────────────────────────────────

async function claimLogin(
  address: string,
  signMessage: (args: { message: string }) => Promise<string>,
): Promise<string> {
  const nonceR = await fetch(`${GW_URL}/api/claim/nonce`);
  const { nonce } = await nonceR.json();

  const domain = window.location.host;
  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    `Sign in to manage your ${PARENT_NAME} subdomain`,
    "",
    `URI: ${window.location.origin}`,
    "Version: 1",
    "Chain ID: 1",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");

  const signature = await signMessage({ message });

  const loginR = await fetch(`${GW_URL}/api/claim/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const { token } = await loginR.json();
  if (!token) throw new Error("Login failed");
  return token;
}

// ── LabelInput with availability indicator ────────────────────────────────────

function LabelInput({
  value, onChange, status,
}: {
  value: string;
  onChange: (v: string) => void;
  status: "idle" | "checking" | "available" | "taken" | "invalid";
}) {
  const borderColor = {
    idle:      "border-white/10 focus-within:border-white/20",
    checking:  "border-white/20",
    available: "border-green-500/50 focus-within:border-green-500/70",
    taken:     "border-red-500/40  focus-within:border-red-500/60",
    invalid:   "border-white/10 focus-within:border-white/20",
  }[status];

  return (
    <div className={`liquid-glass rounded-2xl px-5 py-4 flex items-center gap-3 border transition-colors ${borderColor}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        placeholder="yourname"
        className="flex-1 bg-transparent text-white text-xl font-mono outline-none placeholder:text-white/20"
        spellCheck={false}
        autoComplete="off"
        maxLength={64}
      />
      <span className="text-white/30 text-base shrink-0">.{PARENT_NAME}</span>
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {status === "checking"  && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
        {status === "available" && <Check className="w-4 h-4 text-green-400" />}
        {status === "taken"     && <X className="w-4 h-4 text-red-400" />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const { open } = useWalletModal();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const tr       = usePageRecords("claim.dinamic.eth");
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [label, setLabel]           = useState("");
  const [status, setStatus]         = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimedLabel, setClaimedLabel] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErr, setLoginErr]     = useState<string | null>(null);
  const [existingClaim, setExistingClaim] = useState<string | null>(null);
  const [mineChecking, setMineChecking]   = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const checkTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── load stored token ────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(CLAIM_TOKEN_KEY);
    if (!stored) return;
    try {
      const payload = JSON.parse(atob(stored.split(".")[1]));
      if (payload.exp && payload.exp < Date.now() / 1000) {
        localStorage.removeItem(CLAIM_TOKEN_KEY); return;
      }
      setClaimToken(stored);
    } catch { localStorage.removeItem(CLAIM_TOKEN_KEY); }
  }, []);

  // ── check if connected wallet already has a claim ────────────────────────────
  useEffect(() => {
    if (!mounted || !address) { setExistingClaim(null); return; }
    setMineChecking(true);
    fetch(`${GW_URL}/api/claim/mine?address=${address}`)
      .then(r => r.json())
      .then(d => setExistingClaim(d.label ?? null))
      .catch(() => setExistingClaim(null))
      .finally(() => setMineChecking(false));
  }, [mounted, address]);

  // ── availability check (debounced) ──────────────────────────────────────────
  useEffect(() => {
    if (!label) { setStatus("idle"); return; }
    if (!isValidLabel(label)) { setStatus("invalid"); return; }
    setStatus("checking");
    clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      const avail = await checkAvailability(label);
      setStatus(avail === true ? "available" : avail === false ? "taken" : "idle");
    }, 400);
    return () => clearTimeout(checkTimer.current);
  }, [label]);

  // ── contract write ───────────────────────────────────────────────────────────
  const { writeContract, data: txHash, error: writeError, isPending: writePending } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // ── manual receipt polling fallback (wagmi default RPC can stall) ────────────
  useEffect(() => {
    if (!txHash || txSuccess || manualSuccess) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch("https://ethereum.publicnode.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash] }),
        });
        const d = await r.json();
        if (d.result?.status === "0x1") setManualSuccess(true);
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [txHash, txSuccess, manualSuccess]);

  const confirmed = txSuccess || manualSuccess;

  const doClaim = () => {
    if (status !== "available" || !label) return;
    writeContract({
      address: REGISTRAR_ADDRESS,
      abi: REGISTRAR_ABI,
      functionName: "claim",
      args: [label],
    });
  };

  // ── after tx confirmed, sign in so user can set records ─────────────────────
  useEffect(() => {
    if (!confirmed || !address) return;
    setClaimedLabel(label);
    setLoginLoading(true);
    setLoginErr(null);
    claimLogin(address, signMessageAsync)
      .then((token) => { localStorage.setItem(CLAIM_TOKEN_KEY, token); setClaimToken(token); })
      .catch((e) => setLoginErr(e.message))
      .finally(() => setLoginLoading(false));
  }, [confirmed, address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── sign in for wallets that already claimed ─────────────────────────────────
  const doExistingLogin = async () => {
    if (!address) return;
    setLoginLoading(true);
    setLoginErr(null);
    try {
      const token = await claimLogin(address, signMessageAsync);
      localStorage.setItem(CLAIM_TOKEN_KEY, token);
      setClaimToken(token);
      setClaimedLabel(existingClaim);
    } catch (e: any) {
      setLoginErr(e.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const statusMsg: Record<typeof status, string> = {
    idle:      "",
    checking:  "Checking…",
    available: `${label}.${PARENT_NAME} is available`,
    taken:     `${label}.${PARENT_NAME} is already taken`,
    invalid:   "Labels: a–z, 0–9, hyphens only; no leading/trailing hyphen",
  };

  const claimedName = `${claimedLabel || existingClaim || label}.${PARENT_NAME}`;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center font-display px-4">
      <NavMenu currentPath="claim" />

      {/* Background */}
      {videoUrl ? (
        <>
          <video src={videoUrl} autoPlay loop muted playsInline className="fixed inset-0 w-full h-full object-cover z-0" />
          <div className="fixed inset-0 z-0 bg-black/50" />
        </>
      ) : (
        <div className="fixed inset-0 z-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15), transparent 60%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(129,140,248,0.1), transparent 60%)" }} />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* Header bar */}
      <div className="fixed top-0 left-0 right-0 z-20 flex justify-between items-center px-6 py-4">
        <a href="/" className="text-white/40 hover:text-white/70 text-sm transition-colors">{PARENT_NAME}</a>
        {mounted && (
          isConnected && address ? (
            <button onClick={() => disconnect()}
              className="liquid-glass rounded-full px-4 py-2 text-xs text-white/60 hover:text-white/80 transition-colors font-mono">
              {shortAddr(address)}
            </button>
          ) : (
            <button onClick={() => open()}
              className="liquid-glass-strong rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-white">
              <Wallet className="w-3 h-3" /> Connect
            </button>
          )
        )}
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="liquid-glass rounded-3xl p-8 space-y-6">

          {/* Title */}
          <div className="text-center">
            <h1 className="text-2xl font-medium text-white tracking-tight">
              Claim your <span className="text-white/50">.{PARENT_NAME}</span>
            </h1>
            <p className="text-white/40 text-sm mt-2">
              One subdomain per wallet — resolves via CCIP Read, no gas for records
            </p>
          </div>

          {/* Post-claim: record editor */}
          {confirmed && claimToken && claimedLabel ? (
            <ProfileEditor token={claimToken} claimedName={claimedName} ownerAddress={address ?? ""} />
          ) : confirmed && loginLoading ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
              <p className="text-white/50 text-sm">Signing in…</p>
              {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
            </div>
          ) : confirmed ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <p className="text-white font-medium">Claimed!</p>
              <p className="text-white/50 text-sm">{claimedName}</p>
              <button
                onClick={doExistingLogin}
                disabled={loginLoading}
                className="liquid-glass-strong rounded-xl px-6 py-3 flex items-center gap-2 text-sm text-white hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                {loginLoading ? "Signing in…" : "Set up your profile"}
              </button>
              {loginErr && <p className="text-red-400 text-xs text-center">{loginErr}</p>}
            </div>

          ) : /* wallet already has a claim — show manage UI */ mounted && existingClaim && claimToken ? (
            <ProfileEditor token={claimToken} claimedName={`${existingClaim}.${PARENT_NAME}`} ownerAddress={address ?? ""} />

          ) : mounted && existingClaim ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-amber-400" />
              <p className="text-white font-medium">You already own</p>
              <p className="text-white/70 font-mono text-lg">{existingClaim}.{PARENT_NAME}</p>
              <button
                onClick={doExistingLogin}
                disabled={loginLoading}
                className="liquid-glass-strong rounded-xl px-6 py-3 flex items-center gap-2 text-sm text-white hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                Sign in to manage records
              </button>
              {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
            </div>

          ) : (
            <>
              {/* Label input */}
              <LabelInput value={label} onChange={setLabel} status={status} />

              {/* Status message */}
              <p className={`text-xs min-h-[1rem] transition-colors ${
                status === "available" ? "text-green-400" :
                status === "taken"     ? "text-red-400" :
                "text-white/30"
              }`}>
                {statusMsg[status]}
              </p>

              {/* Error */}
              {writeError && (
                <p className="text-red-400 text-xs bg-red-900/20 rounded-xl px-3 py-2">
                  {(writeError as any)?.shortMessage || writeError.message}
                </p>
              )}

              {/* Action — only render after mount to avoid hydration mismatch */}
              {!mounted ? (
                <button disabled className="w-full liquid-glass-strong rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-medium text-white opacity-0">
                  <Wallet className="w-4 h-4" /> Connect wallet to claim
                </button>
              ) : !isConnected ? (
                <button
                  onClick={() => open()}
                  className="w-full liquid-glass-strong rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-medium text-white hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <Wallet className="w-4 h-4" /> Connect wallet to claim
                </button>
              ) : (
                <button
                  onClick={doClaim}
                  disabled={status !== "available" || writePending || txLoading || mineChecking || !!existingClaim}
                  className="w-full liquid-glass-strong rounded-2xl py-4 flex items-center justify-center gap-2 text-sm font-medium text-white hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {mineChecking
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking wallet…</>
                    : writePending || txLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {txLoading ? "Confirming…" : "Confirm in wallet…"}</>
                    : <><Check className="w-4 h-4" /> Claim {label ? `${label}.${PARENT_NAME}` : "subdomain"}</>
                  }
                </button>
              )}

              <p className="text-white/20 text-xs text-center">
                One claim per wallet · gas required for the claim tx only
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
