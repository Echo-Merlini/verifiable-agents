"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getStats, getLogs, getGatewayStatus } from "@/lib/api";
import { shortAddr, timeAgo } from "@/lib/utils";
import { Database, Activity, CheckCircle2, XCircle, Key, RefreshCw } from "lucide-react";

type Stats = {
  total_records: number;
  total_lookups: number;
  lookups_today?: number;
  signer?: string;
};

type LogEntry = {
  ts: number;
  sender: string;
  selector: string;
  name?: string;
};

type GatewayStatus = {
  status?: string;
  signer?: string;
  gateway?: string;
};

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-gb-faint text-sm">{label}</p>
        <Icon className="w-4 h-4 text-[#444]" />
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-gb-muted truncate">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [gwStatus, setGwStatus] = useState<GatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, l, gw] = await Promise.allSettled([
        getStats(token),
        getLogs(token, 10),
        getGatewayStatus(),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (l.status === "fulfilled") setLogs(Array.isArray(l.value) ? l.value : []);
      if (gw.status === "fulfilled") setGwStatus(gw.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const gatewayOk = gwStatus !== null && (gwStatus?.status === "ok" || (gwStatus && Object.keys(gwStatus).length > 0));

  return (
    <div className="space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gb-faint text-sm mt-1">ENS gateway overview</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-gb-input hover:bg-[#1a1a1a] px-3 py-2 rounded-lg text-sm text-gb-faint transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Records"
          value={stats?.total_records ?? "—"}
          icon={Database}
        />
        <StatCard
          label="Total Lookups"
          value={stats?.total_lookups ?? "—"}
          icon={Activity}
        />
        <StatCard
          label="Gateway Status"
          value={
            gwStatus === null ? (
              <span className="text-gb-muted text-lg">—</span>
            ) : gatewayOk ? (
              <span className="flex items-center gap-2 text-green-400 text-lg font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-2 text-red-400 text-lg font-semibold">
                <XCircle className="w-5 h-5" /> Offline
              </span>
            )
          }
          icon={CheckCircle2}
          sub={process.env.NEXT_PUBLIC_GATEWAY_URL}
        />
        <StatCard
          label="Signer"
          value={
            <span className="text-base font-mono">
              {gwStatus?.signer
                ? shortAddr(gwStatus.signer)
                : stats?.signer
                ? shortAddr(stats.signer)
                : "—"}
            </span>
          }
          icon={Key}
          sub={gwStatus?.signer || stats?.signer || undefined}
        />
      </div>

      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gb-border flex items-center justify-between">
          <p className="text-sm font-semibold">Recent Lookups</p>
          <span className="text-xs text-gb-muted">Last 10 requests</span>
        </div>
        {logs.length === 0 ? (
          <div className="px-5 py-10 text-center text-[#444] text-sm">
            {loading ? "Loading…" : "No lookup logs yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Sender</th>
                <th className="px-5 py-3 text-left">Selector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gb-border">
              {logs.map((entry, i) => (
                <tr key={i} className="hover:bg-gb-input/50 transition-colors">
                  <td className="px-5 py-3 text-gb-muted text-xs whitespace-nowrap">
                    {entry.ts ? timeAgo(entry.ts) : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-gb-accent text-xs">
                    {entry.name || "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-gb-faint text-xs">
                    {entry.sender ? shortAddr(entry.sender) : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-gb-muted text-xs">
                    {entry.selector ? entry.selector.slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
