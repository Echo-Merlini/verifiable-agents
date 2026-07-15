"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useDisconnect, useSendTransaction } from "wagmi";
import { useWalletModal } from "@/hooks/useWalletModal";
import { Wallet, Loader2, ArrowLeft, Eye, EyeOff, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { ProfileEditor, ProfileFields } from "@/components/ProfileEditor";
import { NavMenu } from "@/components/NavMenu";

const GW_URL      = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const PARENT_NAME = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";

const CLAIM_TOKEN_KEY = "ens-kit-claim-token";

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

async function loginSiwe(address: string): Promise<string> {
  const nonceR = await fetch(`${GW_URL}/api/claim/nonce`);
  const { nonce } = await nonceR.json();
  const domain  = window.location.host;
  const message = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address, "",
    `Sign in to manage your ${PARENT_NAME} subdomain`,
    "", `URI: ${window.location.origin}`, "Version: 1", "Chain ID: 1",
    `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
  const eth = (window as any).ethereum;
  const signature: string = await eth.request({ method: "personal_sign", params: [message, address] });
  const loginR = await fetch(`${GW_URL}/api/claim/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const { token } = await loginR.json();
  if (!token) throw new Error("Login failed");
  return token;
}

const PROPAGATION_SECS = 90;

// ── Publish section ───────────────────────────────────────────────────────────
function PublishSection({
  token, label, ownerAddress,
}: { token: string; label: string; ownerAddress: string }) {
  const [feeInfo, setFeeInfo]       = useState<{ feeEth: number; feeReceiver: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult]         = useState<{ cid: string; ipfsUri: string; profileUrl: string } | null>(null);
  const [countdown, setCountdown]   = useState(0);
  const [err, setErr]               = useState("");
  const { sendTransactionAsync, isPending: txPending } = useSendTransaction();

  // Countdown tick after successful publish
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Load fee config from gateway
  useEffect(() => {
    fetch(`${GW_URL}/api/claim/profile-fee`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFeeInfo(d); })
      .catch(() => {});
  }, []);

  const publish = async (paymentTxHash?: string) => {
    setPublishing(true);
    setErr("");
    try {
      const r = await fetch(`${GW_URL}/api/claim/publish-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paymentTxHash }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setResult(d);
      setCountdown(PROPAGATION_SECS);
    } catch (e: any) {
      setErr(e.message);
    }
    setPublishing(false);
  };

  const handlePublish = async () => {
    if (feeInfo && feeInfo.feeEth > 0 && feeInfo.feeReceiver) {
      // Send fee payment first
      try {
        setPublishing(true);
        setErr("");
        const hash = await sendTransactionAsync({
          to:    feeInfo.feeReceiver as `0x${string}`,
          value: BigInt(Math.round(feeInfo.feeEth * 1e18)),
        });
        await publish(hash);
      } catch (e: any) {
        setErr(e.message.includes("user rejected") ? "Payment cancelled." : e.message);
        setPublishing(false);
      }
    } else {
      await publish();
    }
  };

  if (result) {
    return (
      <div className="border border-emerald-500/20 rounded-2xl p-5 bg-emerald-500/5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium text-white">Profile published to IPFS!</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">CID</p>
          <p className="font-mono text-[10px] text-white/50 break-all">{result.cid}</p>
        </div>
        {countdown > 0 ? (
          <div className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10">
            <Loader2 className="w-4 h-4 animate-spin text-white/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/60">Propagating to eth.limo…</p>
              <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400/60 rounded-full transition-all duration-1000"
                  style={{ width: `${((PROPAGATION_SECS - countdown) / PROPAGATION_SECS) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-mono text-white/40 shrink-0">{countdown}s</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <a
              href={result.profileUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open profile
            </a>
          </div>
        )}
        <p className="text-[10px] text-white/30 text-center">
          Live via CCIP Read immediately · On-chain registration (Brave/Opera) is processed manually by the admin within 1–3 days
        </p>
      </div>
    );
  }

  return (
    <div className="border border-amber-500/20 rounded-2xl p-5 bg-amber-500/5 space-y-4">
      <div>
        <p className="text-sm font-medium text-white">Publish Profile Page</p>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">
          Pin your profile to IPFS and set it as the contenthash for{" "}
          <span className="font-mono text-white/60">{label}.{PARENT_NAME}</span>.
          Resolves at <span className="font-mono text-white/60">{label}.{PARENT_NAME}.limo</span> immediately.
        </p>
      </div>

      {feeInfo && feeInfo.feeEth > 0 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/50">Publishing fee</span>
          <span className="text-white font-medium">{feeInfo.feeEth} ETH</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-emerald-400/70">
          <CheckCircle2 className="w-3.5 h-3.5" /> Free during beta
        </div>
      )}

      {err && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {err}
        </div>
      )}

      <button
        onClick={handlePublish}
        disabled={publishing || txPending}
        className="w-full py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {publishing || txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {txPending ? "Confirm in wallet…" : publishing ? "Publishing…" : "Publish Profile"}
      </button>

      <p className="text-[10px] text-white/25 text-center">
        Save your records above first, then publish to bake them into the static page
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfileEditPage() {
  const { address, isConnected } = useAccount();
  const { open }       = useWalletModal();
  const { disconnect } = useDisconnect();

  const [mounted, setMounted]         = useState(false);
  const [token, setToken]             = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [label, setLabel]             = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErr, setLoginErr]       = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewFields, setPreviewFields] = useState<ProfileFields>({});
  const [previewSrcdoc, setPreviewSrcdoc] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setMounted(true), []);

  // Load stored JWT
  useEffect(() => {
    const stored = localStorage.getItem(CLAIM_TOKEN_KEY);
    if (!stored) return;
    try {
      const payload = JSON.parse(atob(stored.split(".")[1]));
      if (payload.exp && payload.exp < Date.now() / 1000) { localStorage.removeItem(CLAIM_TOKEN_KEY); return; }
      setToken(stored);
      if (payload.address) setTokenAddress(payload.address.toLowerCase());
    } catch { localStorage.removeItem(CLAIM_TOKEN_KEY); }
  }, []);

  // Fetch label — use wagmi address or fall back to address decoded from stored JWT
  const effectiveAddress = address ?? tokenAddress ?? null;
  useEffect(() => {
    if (!effectiveAddress) return;
    fetch(`${GW_URL}/api/claim/mine?address=${effectiveAddress}`)
      .then(r => r.json())
      .then(d => setLabel(d.label ?? null))
      .catch(() => {});
  }, [effectiveAddress]);

  // Fetch existing records for pre-fill
  const [initialFields, setInitialFields] = useState<ProfileFields | undefined>(undefined);
  useEffect(() => {
    if (!label) return;
    fetch(`${GW_URL}/record/${encodeURIComponent(`${label}.${PARENT_NAME}`)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setInitialFields(d?.text_records ? JSON.parse(d.text_records) : {}))
      .catch(() => setInitialFields({}));
  }, [label]);

  // Debounced live preview via render-profile
  useEffect(() => {
    if (!token) return;
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const r = await fetch(`${GW_URL}/api/claim/render-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(previewFields),
        });
        if (r.ok) {
          const html = await r.text();
          setPreviewSrcdoc(html);
          setPreviewErr(false);
        } else {
          setPreviewErr(true);
        }
      } catch { setPreviewErr(true); }
      setPreviewLoading(false);
    }, 800);
    return () => clearTimeout(previewTimer.current);
  }, [token, previewFields]); // eslint-disable-line

  const doLogin = async () => {
    if (!address) return;
    setLoginLoading(true);
    setLoginErr("");
    try {
      const t = await loginSiwe(address);
      localStorage.setItem(CLAIM_TOKEN_KEY, t);
      setToken(t);
    } catch (e: any) {
      setLoginErr(e.message);
    }
    setLoginLoading(false);
  };

  const claimedName = label ? `${label}.${PARENT_NAME}` : "";

  return (
    <div className="relative min-h-screen bg-black flex flex-col font-display">
      <NavMenu currentPath="profile-edit" />

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(129,140,248,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 flex justify-between items-center px-6 py-4">
        <a href="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> {PARENT_NAME}
        </a>
        {mounted && (
          isConnected && address ? (
            <button onClick={() => disconnect()}
              className="bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white/60 hover:text-white/80 transition-colors font-mono">
              {shortAddr(address)}
            </button>
          ) : (
            <button onClick={() => open()}
              className="bg-white/8 border border-white/15 rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-white">
              <Wallet className="w-3 h-3" /> Connect
            </button>
          )
        )}
      </div>

      <div className="relative z-10 flex-1 flex flex-col lg:flex-row pt-16">

        {/* ── Left: Editor ── */}
        <div className="w-full lg:w-[52%] p-4 lg:p-8 flex flex-col gap-6 lg:max-h-screen lg:overflow-y-auto bg-black [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div>
            <h1 className="text-2xl font-medium text-white tracking-tight">Edit Profile</h1>
            {claimedName && (
              <p className="text-white/40 text-sm mt-1 font-mono">{claimedName}</p>
            )}
          </div>

          {!mounted ? null : !isConnected ? (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
              <Wallet className="w-8 h-8 text-white/20" />
              <p className="text-white/50 text-sm">Connect the wallet that owns your subdomain</p>
              <button onClick={() => open()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm transition-colors">
                <Wallet className="w-4 h-4" /> Connect Wallet
              </button>
            </div>

          ) : !label ? (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
              <p className="text-white/50 text-sm">This wallet hasn't claimed a subdomain yet</p>
              <a href="/claim"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-sm transition-colors">
                Claim yours →
              </a>
            </div>

          ) : !token ? (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-6 flex flex-col gap-4">
              <p className="text-white/60 text-sm">Sign in to edit your profile for <span className="font-mono text-white/80">{claimedName}</span></p>
              <button onClick={doLogin} disabled={loginLoading}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/15 text-white text-sm transition-colors disabled:opacity-50">
                {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Sign in with wallet
              </button>
              {loginErr && <p className="text-red-400 text-xs">{loginErr}</p>}
            </div>

          ) : (
            <>
              {initialFields === undefined ? (
                <div className="flex items-center justify-center py-10 gap-2 text-white/30 text-sm">
                  <span className="animate-pulse">Loading your profile…</span>
                </div>
              ) : (
                <ProfileEditor
                  initial={initialFields}
                  ownerAddress={address}
                  token={token}
                  claimedName={claimedName}
                  onSaved={setPreviewFields}
                />
              )}

              <PublishSection token={token} label={label!} ownerAddress={address ?? ""} />
            </>
          )}
        </div>

        {/* ── Right: Live preview ── */}
        <div className="hidden lg:flex w-full lg:w-[48%] p-4 lg:p-8 lg:pl-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40 uppercase tracking-widest">Preview</p>
            <p className="text-[10px] text-white/25">Updates as you type</p>
          </div>
          <div className="flex-1 rounded-2xl border border-white/8 overflow-hidden bg-black">
            {previewSrcdoc ? (
              <iframe
                srcDoc={previewSrcdoc}
                className="w-full h-full"
                title="Profile preview"
                style={{ background: "black" }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {previewLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                ) : previewErr ? (
                  <p className="text-white/15 text-xs text-center px-4">Preview unavailable—publish your profile first</p>
                ) : !token ? (
                  <p className="text-white/20 text-xs">Sign in to see preview</p>
                ) : (
                  <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                )}
              </div>
            )}
          </div>
          {label && (
            <a
              href={`https://${label}.dinamic.eth.limo`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open full profile
            </a>
          )}
        </div>

        {/* Mobile preview toggle */}
        <div className="lg:hidden fixed bottom-4 right-4 z-30">
          <button
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 border border-white/20 text-xs text-white backdrop-blur-sm"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Hide" : "Preview"}
          </button>
        </div>
        {showPreview && label && (
          <div className="lg:hidden fixed inset-0 z-40 bg-black">
            <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 z-50 text-white/50 hover:text-white">
              <span className="text-sm">✕ Close</span>
            </button>
            <iframe srcDoc={previewSrcdoc} className="w-full h-full" title="Profile preview" />
          </div>
        )}
      </div>
    </div>
  );
}
