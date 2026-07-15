"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGatewayEnv } from "@/hooks/useGatewayEnv";
import { getLogs } from "@/lib/api";
import { shortAddr, timeAgo } from "@/lib/utils";
import { RefreshCw, ChevronLeft, ChevronRight, Copy, Check, Zap, GitBranch, Webhook, Globe } from "lucide-react";

type LogEntry = { ts: number; sender: string; selector: string; name?: string };

const PAGE_SIZE = 20;

const GITHUB_ACTIONS_SNIPPET = `# .github/workflows/deploy.yml
- name: Update ENS record
  run: |
    curl -X POST \${{ secrets.ENS_GATEWAY_URL }}/update \\
      -H "x-api-key: \${{ secrets.ENS_UPDATE_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{
        "name": "app.yourname.eth",
        "contenthash": "ipfs://\${{ steps.deploy.outputs.cid }}"
      }'`;

function CopyBlock({ code, lang = "" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="text-xs font-mono text-gb-faint bg-gb-bg rounded-lg p-4 overflow-auto border border-gb-border pr-10 leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="absolute top-3 right-3 p-1.5 rounded bg-gb-input hover:bg-[#1a1a1a] text-gb-muted hover:text-gb-faint transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: {
  icon: any; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gb-border flex items-center gap-3">
        <Icon className="w-4 h-4 text-gb-muted shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          {subtitle && <p className="text-xs text-gb-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function DataPage() {
  const { token } = useAuth();
  const { env } = useGatewayEnv();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getLogs(token, 50);
      setLogs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const gw = env.url;
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const paged = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-8 text-slate-100 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Data</h1>
        <p className="text-gb-faint text-sm mt-1">
          Connect external data sources to the gateway and observe what's being resolved
        </p>
      </div>

      {/* Push API */}
      <Section icon={Zap} title="Push API" subtitle="Write records from any backend — instant, no gas">
        <p className="text-sm text-gb-faint">
          Any service that can make an HTTP POST can update ENS records. Think of it as a write endpoint
          for your ENS namespace — backends, cron jobs, CI pipelines, webhooks, n8n workflows.
        </p>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">Endpoint</p>
          <div className="flex items-center gap-2 bg-gb-input rounded-lg px-3 py-2.5 font-mono text-sm">
            <span className="text-amber-400 text-xs">POST</span>
            <span className="text-gb-faint">{gw}/update</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">Payload</p>
          <CopyBlock code={`{
  "name": "subdomain.yourname.eth",   // required
  "address": "0x...",                 // optional
  "contenthash": "ipfs://...",        // optional
  "text_records": {                   // optional
    "url": "https://...",
    "avatar": "ipfs://...",
    "description": "..."
  }
}`} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">curl</p>
          <CopyBlock code={`curl -X POST ${gw}/update \\
  -H "x-api-key: YOUR_UPDATE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "app.yourname.eth",
    "address": "0xYourWallet",
    "text_records": { "url": "https://yourapp.com" }
  }'`} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">JavaScript / TypeScript</p>
          <CopyBlock code={`await fetch("${gw}/update", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ENS_UPDATE_API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "app.yourname.eth",
    address: "0xYourWallet",
    contenthash: "ipfs://Qm...",
    text_records: { url: "https://yourapp.com" },
  }),
});`} />
        </div>
      </Section>

      {/* CI/CD */}
      <Section icon={GitBranch} title="CI / CD Integration" subtitle="Update ENS on every deploy">
        <p className="text-sm text-gb-faint">
          Point <code className="text-gb-accent bg-gb-input px-1 rounded text-xs">app.yourname.eth</code> at your
          latest frontend automatically. Add this step to your pipeline after a successful build.
        </p>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">GitHub Actions</p>
          <CopyBlock code={GITHUB_ACTIONS_SNIPPET} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-gb-muted uppercase tracking-wide">Vercel / Netlify (post-deploy hook)</p>
          <CopyBlock code={`// api/ens-hook.ts  (Vercel serverless function)
export async function POST(req: Request) {
  const { url } = await req.json(); // deployment URL from platform hook
  await fetch(\`\${process.env.ENS_GATEWAY_URL}/update\`, {
    method: "POST",
    headers: { "x-api-key": process.env.ENS_UPDATE_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "app.yourname.eth", text_records: { url } }),
  });
  return Response.json({ ok: true });
}`} />
        </div>
      </Section>

      {/* Automation */}
      <Section icon={Webhook} title="Automation & Workflows" subtitle="n8n, Make, Zapier, cron">
        <p className="text-sm text-gb-faint">
          The push endpoint is a plain HTTP POST — any automation platform can write to it.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {[
            {
              title: "n8n",
              desc: "Use the HTTP Request node. Method: POST, URL: gateway/update, Auth: Header (x-api-key). Body: JSON with name + fields.",
              note: "",
            },
            {
              title: "Make (Integromat)",
              desc: "HTTP → Make a Request module. Set method POST, URL, headers, and body. Trigger from any Make scenario.",
              note: "",
            },
            {
              title: "Zapier",
              desc: "Webhooks by Zapier → POST action. Paste the gateway URL, add x-api-key header, set body template.",
              note: "",
            },
            {
              title: "Cron job",
              desc: "Schedule any script that POSTs to /update. Useful for rotating contenthash, updating live stats, etc.",
              note: "",
            },
          ].map(({ title, desc, note }) => (
            <div key={title} className="bg-gb-input rounded-lg p-4 space-y-1">
              <p className="text-sm font-medium text-slate-100">{title}</p>
              <p className="text-xs text-gb-faint">{desc}</p>
              {note && <p className="text-xs text-gb-accent">{note}</p>}
            </div>
          ))}
        </div>
      </Section>

      {/* Read API */}
      <Section icon={Globe} title="Read API" subtitle="Fetch records from anywhere">
        <p className="text-sm text-gb-faint">
          Public read endpoint — no auth required. Use it to display ENS records in your app
          without going through the full CCIP Read flow.
        </p>
        <CopyBlock code={`// Fetch any record directly
const res = await fetch("${gw}/record/yourname.eth");
const { address, contenthash, text_records } = await res.json();

// Or resolve via ENS (full CCIP Read flow)
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http() });
const address = await client.getEnsAddress({ name: "yourname.eth" });
const url = await client.getEnsText({ name: "yourname.eth", key: "url" });`} />
      </Section>

      {/* Lookup log */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Lookup Log</p>
            <p className="text-xs text-gb-muted mt-0.5">Recent CCIP Read requests to the gateway</p>
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

        <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-12 text-center text-gb-muted text-sm">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-12 text-center text-[#444] text-sm">No lookups yet.</div>
          ) : (
            <>
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
                  {paged.map((entry, i) => (
                    <tr key={i} className="hover:bg-gb-input/40 transition-colors">
                      <td className="px-5 py-3 text-gb-muted text-xs whitespace-nowrap">
                        <span title={entry.ts ? new Date(entry.ts * 1000).toISOString() : ""}>
                          {entry.ts ? timeAgo(entry.ts) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-gb-accent text-xs">
                        {entry.name || <span className="text-[#444]">—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-gb-faint text-xs">
                        {entry.sender ? <span title={entry.sender}>{shortAddr(entry.sender)}</span> : <span className="text-[#444]">—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-gb-muted text-xs">
                        {entry.selector ? <span title={entry.selector}>{entry.selector.slice(0, 10)}</span> : <span className="text-[#444]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gb-border">
                  <span className="text-xs text-gb-muted">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, logs.length)} of {logs.length}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded hover:bg-[#1a1a1a] disabled:opacity-30 transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded hover:bg-[#1a1a1a] disabled:opacity-30 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
