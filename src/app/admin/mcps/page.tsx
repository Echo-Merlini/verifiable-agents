"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import { Plus, Trash2, Check, Loader2, ExternalLink, Copy, Plug } from "lucide-react";

interface McpServer {
  id: string;
  name: string;
  url: string;
  description: string;
  active: number;
  auth_type: "none" | "bearer" | "apikey";
  auth_value: string;
  skill_count: number;
  created_at: number;
}

const EMPTY_FORM: { name: string; url: string; description: string; active: number; auth_type: "none" | "bearer" | "apikey" | "basic"; auth_value: string; auth_username: string } = {
  name: "", url: "", description: "",
  active: 1, auth_type: "none", auth_value: "", auth_username: "",
};

export default function McpsPage() {
  const { token } = useAuth();

  const [servers, setServers]   = useState<McpServer[]>([]);
  const [loading, setLoading]   = useState(true);
  const [working, setWorking]   = useState(false);
  const [flash, setFlash]       = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [copied, setCopied]     = useState<string | null>(null);

  const notify = (type: "ok" | "err", msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(`${getGatewayUrl()}/admin/mcp-servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (Array.isArray(data)) setServers(data);
      else notify("err", data?.error || "Failed to load MCP servers");
    } catch { notify("err", "Failed to load MCP servers"); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  const add = async () => {
    if (!form.name || !form.url) return;
    setWorking(true);
    try {
      const submitForm = form.auth_type === "basic"
        ? { ...form, auth_value: `${form.auth_username}:${form.auth_value}` }
        : form;
      const r = await fetch(`${getGatewayUrl()}/admin/mcp-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(submitForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      notify("ok", `Added ${form.name}`);
      setForm({ ...EMPTY_FORM });
      setShowAdd(false);
      load();
    } catch (e: any) { notify("err", e.message); }
    setWorking(false);
  };

  const toggle = async (s: McpServer) => {
    setWorking(true);
    try {
      await fetch(`${getGatewayUrl()}/admin/mcp-servers/${s.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ active: s.active ? 0 : 1 }),
      });
      load();
    } catch (e: any) { notify("err", e.message); }
    setWorking(false);
  };

  const remove = async (s: McpServer) => {
    if (!confirm(`Remove "${s.name}"?`)) return;
    setWorking(true);
    try {
      await fetch(`${getGatewayUrl()}/admin/mcp-servers/${s.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      notify("ok", `Removed ${s.name}`);
      load();
    } catch (e: any) { notify("err", e.message); }
    setWorking(false);
  };

  const copyUrl = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Plug className="w-5 h-5 text-gb-accent" />
            MCP Servers
          </h1>
          <p className="text-xs text-gb-muted mt-0.5">External Model Context Protocol servers — assign to skills to extend agent tools</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Server
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div className={`text-xs px-4 py-2.5 rounded-lg ${flash.type === "ok" ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
          {flash.msg}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="bg-gb-surface border border-gb-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-200">New MCP Server</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name (e.g. Crypto Forensics)"
              className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
            />
            <input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="URL (e.g. https://app.railway.app/mcp)"
              className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
            />
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              className="lg:col-span-2 bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
            />
            <select
              value={form.auth_type}
              onChange={e => setForm(f => ({ ...f, auth_type: e.target.value as any, auth_value: "", auth_username: "" }))}
              className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-gb-accent"
            >
              <option value="none">No auth</option>
              <option value="bearer">Bearer token</option>
              <option value="apikey">API key header</option>
              <option value="basic">Basic (user:pass)</option>
            </select>
            {form.auth_type === "basic" && (
              <>
                <input
                  value={form.auth_username}
                  onChange={e => setForm(f => ({ ...f, auth_username: e.target.value }))}
                  placeholder="Username"
                  className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
                />
                <input
                  value={form.auth_value}
                  onChange={e => setForm(f => ({ ...f, auth_value: e.target.value }))}
                  placeholder="Password"
                  type="password"
                  className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
                />
              </>
            )}
            {form.auth_type !== "none" && form.auth_type !== "basic" && (
              <input
                value={form.auth_value}
                onChange={e => setForm(f => ({ ...f, auth_value: e.target.value }))}
                placeholder={form.auth_type === "bearer" ? "Token value" : "API key value"}
                type="password"
                className="bg-gb-input border border-gb-border rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder-gb-muted outline-none focus:border-gb-accent"
              />
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={working || !form.name || !form.url}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-gb-accentD hover:bg-gb-accent text-white disabled:opacity-40 transition-colors"
            >
              {working ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setForm({ ...EMPTY_FORM }); }}
              className="text-xs px-4 py-2 rounded-lg border border-gb-border text-gb-muted hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gb-muted text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12 text-gb-muted text-sm">
            No MCP servers yet — add one to extend your agents with external tools.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Name</th>
                  <th className="text-left px-5 py-3 font-medium">URL</th>
                  <th className="text-left px-5 py-3 font-medium">Auth</th>
                  <th className="text-left px-5 py-3 font-medium">Skills</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-border">
                {servers.map(s => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-slate-200">{s.name}</p>
                      {s.description && <p className="text-xs text-gb-muted mt-0.5 truncate max-w-[200px]">{s.description}</p>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-slate-400 truncate max-w-[220px]">{s.url}</span>
                        <button onClick={() => copyUrl(s.url)} className="text-gb-muted hover:text-slate-300 shrink-0">
                          {copied === s.url ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-gb-muted hover:text-slate-300 shrink-0">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        s.auth_type === "none"
                          ? "bg-slate-500/10 border-slate-500/20 text-slate-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                      }`}>
                        {s.auth_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gb-muted">{s.skill_count}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggle(s)}
                        disabled={working}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40 ${s.active ? "bg-gb-accent" : "bg-gb-border"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.active ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => remove(s)}
                        disabled={working}
                        className="text-gb-muted hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
