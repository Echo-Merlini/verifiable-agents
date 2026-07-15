"use client";

import { useState } from "react";
import { Copy, Check, Key, Info } from "lucide-react";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

const CURL_EXAMPLE = `curl -X PUT "${GATEWAY}/admin/records/yourname.eth" \\
  -H "Authorization: Bearer YOUR_UPDATE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "address": "0xYourAddress",
    "contenthash": "ipfs://QmYourHash",
    "text_records": {
      "com.twitter": "yourhandle",
      "email": "you@example.com"
    }
  }'`;

const TS_EXAMPLE = `const GATEWAY = "${GATEWAY}";
const API_KEY = process.env.UPDATE_API_KEY!;

async function upsertRecord(name: string, data: {
  address?: string;
  contenthash?: string;
  text_records?: Record<string, string>;
}) {
  const res = await fetch(\`\${GATEWAY}/admin/records/\${encodeURIComponent(name)}\`, {
    method: "PUT",
    headers: {
      "Authorization": \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Usage
await upsertRecord("yourname.eth", {
  address: "0xYourAddress",
  text_records: { "com.twitter": "yourhandle" },
});`;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative bg-gb-bg rounded-xl overflow-hidden border border-gb-border">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gb-border">
        <span className="text-xs text-gb-muted">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-gb-muted hover:text-gb-faint transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-4 text-xs font-mono text-gb-faint overflow-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <div className="space-y-8 text-slate-100 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-gb-faint text-sm mt-1">Programmatic access to the gateway</p>
      </div>

      {/* Current key */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gb-accent" />
          <p className="text-sm font-semibold">Update API Key</p>
        </div>
        <p className="text-gb-faint text-sm">
          Used to authenticate record updates via the REST API. Set as the{" "}
          <code className="bg-gb-input px-1.5 py-0.5 rounded text-gb-faint text-xs font-mono">UPDATE_API_KEY</code>{" "}
          environment variable in the gateway.
        </p>
        <div className="flex items-center gap-3 bg-gb-input rounded-lg px-4 py-3">
          <code className="flex-1 font-mono text-gb-faint text-sm tracking-[0.2em]">
            ●●●●●●●●●●●●●●●●●●●●●●●●
          </code>
          <span className="text-xs text-[#444] shrink-0">masked for security</span>
        </div>
        <div className="flex items-start gap-2 bg-gb-input/50 rounded-lg p-3">
          <Info className="w-4 h-4 text-gb-muted mt-0.5 shrink-0" />
          <p className="text-xs text-gb-muted">
            To rotate the key, update the <code className="font-mono">UPDATE_API_KEY</code> env var in Coolify and redeploy the gateway service.
          </p>
        </div>
      </div>

      {/* curl example */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Push a Record Update via curl</p>
        <CodeBlock code={CURL_EXAMPLE} language="bash" />
      </div>

      {/* TypeScript example */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Push a Record Update via TypeScript</p>
        <CodeBlock code={TS_EXAMPLE} language="typescript" />
      </div>

      {/* Delete example */}
      <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold">Delete a Record</p>
        <CodeBlock
          code={`curl -X DELETE "${GATEWAY}/admin/records/yourname.eth" \\
  -H "Authorization: Bearer YOUR_UPDATE_API_KEY"`}
          language="bash"
        />
      </div>
    </div>
  );
}
