"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getLogs } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

type LogEntry = { id: number; name: string; selector: string; ts: number };

const SELECTOR_NAMES: Record<string, string> = {
  "0x3b3b57de": "addr()",
  "0xbc1c58d1": "contenthash()",
  "0x59d1d43c": "text()",
};

export default function LogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setLogs((await getLogs(token, 100)) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  return (
    <div className="space-y-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CCIP Lookup Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Recent resolution requests (last 100)</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 border border-gray-700 hover:border-gray-500 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Sender / Name</th>
              <th className="px-4 py-3 text-left">Call Type</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-600 text-xs">{l.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-300 truncate max-w-[220px]">{l.name}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-800 text-amber-400 font-mono text-xs px-2 py-0.5 rounded">
                    {SELECTOR_NAMES[l.selector] || l.selector}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(l.ts)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-600">No lookups yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
