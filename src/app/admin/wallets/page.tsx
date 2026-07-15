"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayStatus } from "@/lib/api";
import { shortAddr } from "@/lib/utils";
import { Wallet, Shield, Info, Users, CheckCircle } from "lucide-react";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.dinamic.eth.limo";

type GatewayStatus = {
  status?: string;
  signer?: string;
};

type ClaimEntry = {
  label: string;
  name: string;
  owner: string;
  claimedAt: number;
  txHash: string;
  hasRecords: boolean;
};

function AddressCard({
  label,
  address,
  badge,
}: {
  label: string;
  address: string;
  badge?: string;
}) {
  return (
    <div className="bg-gb-input rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-gb-faint text-sm">{label}</span>
        {badge && (
          <span className="text-xs bg-gb-accentD/30 text-gb-accent px-2 py-0.5 rounded-full border border-amber-600/40">
            {badge}
          </span>
        )}
      </div>
      <p className="font-mono text-slate-100 text-sm break-all">{address}</p>
      <p className="font-mono text-gb-muted text-xs">{shortAddr(address)}</p>
    </div>
  );
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts * 1000) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function UsersTab({ token }: { token: string | null }) {
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${GATEWAY_URL}/admin/claims`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setClaims(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load claims");
        setLoading(false);
      });
  }, [token]);

  if (!token) return <p className="text-gb-muted text-sm">Not authenticated.</p>;
  if (loading) return <p className="text-gb-muted text-sm">Loading users…</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (claims.length === 0)
    return <p className="text-gb-muted text-sm">No subdomains claimed yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gb-faint text-xs border-b border-gb-border">
            <th className="text-left py-2 pr-4">Name</th>
            <th className="text-left py-2 pr-4">Owner</th>
            <th className="text-left py-2 pr-4">Claimed</th>
            <th className="text-left py-2 pr-4">Records</th>
            <th className="text-left py-2">Tx</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((cl) => (
            <tr key={cl.label} className="border-b border-gb-border/50 hover:bg-gb-input/40">
              <td className="py-2 pr-4 font-mono text-slate-100">{cl.name}</td>
              <td className="py-2 pr-4 font-mono text-gb-muted">{shortAddr(cl.owner)}</td>
              <td className="py-2 pr-4 text-gb-faint">
                {cl.claimedAt ? timeAgo(cl.claimedAt) : "—"}
              </td>
              <td className="py-2 pr-4">
                {cl.hasRecords ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <span className="text-gb-muted">—</span>
                )}
              </td>
              <td className="py-2">
                {cl.txHash ? (
                  <a
                    href={`https://etherscan.io/tx/${cl.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gb-accent hover:underline font-mono text-xs"
                  >
                    {cl.txHash.slice(0, 8)}…
                  </a>
                ) : (
                  <span className="text-gb-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WalletsPage() {
  const { address, token } = useAuth();
  const [gwStatus, setGwStatus] = useState<GatewayStatus | null>(null);
  const [tab, setTab] = useState<"wallets" | "users">("wallets");

  useEffect(() => {
    getGatewayStatus().then(setGwStatus).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 text-slate-100 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Wallets</h1>
        <p className="text-gb-faint text-sm mt-1">Admin wallet addresses, gateway signer, and registered users</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gb-border">
        <button
          onClick={() => setTab("wallets")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "wallets"
              ? "border-gb-accent text-gb-accent"
              : "border-transparent text-gb-faint hover:text-slate-100"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Wallets
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "users"
              ? "border-gb-accent text-gb-accent"
              : "border-transparent text-gb-faint hover:text-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
      </div>

      {tab === "wallets" && (
        <div className="space-y-6">
          {/* Connected admin wallet */}
          <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gb-accent" />
              <p className="text-sm font-semibold">Connected Admin Wallet</p>
            </div>
            {address ? (
              <AddressCard label="Your wallet" address={address} badge="Admin" />
            ) : (
              <p className="text-gb-muted text-sm">No wallet connected.</p>
            )}
          </div>

          {/* Gateway signer */}
          <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gb-accent" />
              <p className="text-sm font-semibold">Gateway Signer</p>
            </div>
            <p className="text-gb-faint text-sm">
              The server-side address used to sign CCIP-Read responses. Derived from
              SIGNER_KEY env var in the gateway.
            </p>
            {gwStatus?.signer ? (
              <AddressCard label="Gateway signer address" address={gwStatus.signer} badge="Signer" />
            ) : (
              <p className="text-gb-muted text-sm">Loading signer…</p>
            )}
          </div>

          {/* How to add wallets */}
          <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-gb-muted mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-semibold">Adding Admin Wallets</p>
                <p className="text-gb-faint text-sm">
                  Admin wallets are controlled via the{" "}
                  <code className="bg-gb-input px-1.5 py-0.5 rounded text-gb-faint text-xs font-mono">
                    ADMIN_WALLETS
                  </code>{" "}
                  environment variable in the gateway.
                </p>
                <div className="bg-gb-input rounded-lg p-3 mt-2">
                  <code className="text-xs font-mono text-gb-faint">
                    ADMIN_WALLETS=0xYourAddress,0xAnotherAddress
                  </code>
                </div>
                <p className="text-gb-muted text-xs">
                  Update this in Coolify under the gateway service environment variables, then redeploy.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gb-accent" />
            <p className="text-sm font-semibold">Registered Subdomains</p>
          </div>
          <UsersTab token={token ?? null} />
        </div>
      )}
    </div>
  );
}
