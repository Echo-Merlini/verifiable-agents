"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getGatewayUrl } from "@/hooks/useGatewayEnv";
import {
  getSkills, createSkill, updateSkill, deleteSkill,
  testSkill, getSkillSettings, saveSkillSettings, getRedactionStats,
} from "@/lib/api";
import {
  Sparkles, Plus, Trash2, Edit2, Play, X, Check,
  Key, Loader2, Send, Bot, User, Shield, AlertTriangle,
} from "lucide-react";

const PROVIDERS = [
  { value: "openai",    label: "OpenAI",    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"] },
  { value: "groq",      label: "Groq",      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { value: "mistral",   label: "Mistral",   models: ["mistral-large-latest", "mistral-small-latest", "open-mixtral-8x7b"] },
] as const;

type Provider = typeof PROVIDERS[number]["value"];

type Skill = {
  id: string; name: string; description: string; system_prompt: string;
  provider: Provider; model: string; temperature: number; max_tokens: number;
  tools: string | null; ens_name: string | null; enabled: number;
  input_sources: string | null; trust_scope: string | null;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

type RedactionStats = {
  total: number;
  with_redactions: number;
  with_onchain: number;
  redaction_rate_pct: number;
};

const BLANK = {
  name: "", description: "", system_prompt: "You are a helpful assistant.",
  provider: "openai" as Provider, model: "gpt-4o-mini",
  temperature: 0.7, max_tokens: 2048, tools: "", ens_name: "",
  input_sources: "", trust_scope: "",
};

function isValidJson(s: string) {
  if (!s.trim()) return true;
  try { JSON.parse(s); return true; } catch { return false; }
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gb-muted uppercase tracking-wide mb-1">{children}</p>;
}

function Inp({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors ${className}`} />
  );
}

function Tarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors resize-y ${className}`} />
  );
}

function Sel({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`w-full bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 outline-none transition-colors cursor-pointer ${className}`} />
  );
}

// ─── API Keys Section ─────────────────────────────────────────────────────────
function ApiKeysSection({ token }: { token: string }) {
  const [keys, setKeys] = useState({ openai_api_key: "", anthropic_api_key: "", groq_api_key: "", mistral_api_key: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  function applySettings(d: Record<string, string>) {
    setKeys({
      openai_api_key:    d.openai_api_key === "set" ? "••••••••••••••••" : "",
      anthropic_api_key: d.anthropic_api_key === "set" ? "••••••••••••••••" : "",
      groq_api_key:      d.groq_api_key === "set" ? "••••••••••••••••" : "",
      mistral_api_key:   d.mistral_api_key === "set" ? "••••••••••••••••" : "",
    });
  }

  useEffect(() => {
    getSkillSettings(token).then((d) => { if (d) applySettings(d); });
  }, [token]);

  const save = async () => {
    setSaving(true);
    setSaveError("");
    const payload: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (v && !v.startsWith("•")) payload[k] = v;
    }
    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setSaveError("No new keys to save — type a new key to update.");
      return;
    }
    const result = await saveSkillSettings(token, payload);
    if (!result) {
      setSaving(false);
      setSaveError(token ? "Save failed — sign in again and retry." : "Not authenticated.");
      return;
    }
    const fresh = await getSkillSettings(token);
    if (fresh) applySettings(fresh);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields = [
    { key: "openai_api_key" as const,    label: "OpenAI API Key",    placeholder: "sk-..." },
    { key: "anthropic_api_key" as const, label: "Anthropic API Key", placeholder: "sk-ant-..." },
    { key: "groq_api_key" as const,      label: "Groq API Key",      placeholder: "gsk_..." },
    { key: "mistral_api_key" as const,   label: "Mistral API Key",   placeholder: "..." },
  ];

  return (
    <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gb-border flex items-center gap-3">
        <Key className="w-4 h-4 text-gb-muted shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-100">API Keys</p>
          <p className="text-xs text-gb-muted mt-0.5">Stored in gateway DB — never exposed to the browser</p>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <Label>{label}</Label>
            <Inp
              type="password"
              value={keys[key]}
              onChange={(e) => setKeys(p => ({ ...p, [key]: e.target.value }))}
              onFocus={(e) => { if (e.target.value.startsWith("•")) setKeys(p => ({ ...p, [key]: "" })); }}
              placeholder={placeholder}
            />
          </div>
        ))}
        <div className="col-span-2 flex items-center justify-between">
          {saveError ? (
            <p className="text-xs text-red-400">{saveError}</p>
          ) : (
            <span />
          )}
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? "Saved" : "Save Keys"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skill Form ───────────────────────────────────────────────────────────────
function SkillForm({ initial, onSave, onCancel }: {
  initial: typeof BLANK;
  onSave: (data: typeof BLANK) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const provMeta = PROVIDERS.find(p => p.value === form.provider);
  const set = (k: keyof typeof BLANK, v: any) => setForm(p => ({ ...p, [k]: v }));

  const inputSourcesInvalid = !!form.input_sources && !isValidJson(form.input_sources);
  const trustScopeInvalid   = !!form.trust_scope   && !isValidJson(form.trust_scope);

  const submit = async () => {
    if (!form.name.trim() || inputSourcesInvalid || trustScopeInvalid) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="bg-gb-surface border border-gb-accent rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Name</Label><Inp value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Support Agent" /></div>
        <div><Label>Description</Label><Inp value={form.description} onChange={e => set("description", e.target.value)} placeholder="What this skill does" /></div>
      </div>
      <div>
        <Label>System Prompt</Label>
        <Tarea value={form.system_prompt} onChange={e => set("system_prompt", e.target.value)} rows={4} placeholder="You are a helpful assistant." />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label>Provider</Label>
          <Sel value={form.provider} onChange={e => {
            const p = PROVIDERS.find(x => x.value === e.target.value)!;
            setForm(f => ({ ...f, provider: p.value, model: p.models[0] }));
          }}>
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Sel>
        </div>
        <div>
          <Label>Model</Label>
          <Sel value={form.model} onChange={e => set("model", e.target.value)}>
            {provMeta?.models.map(m => <option key={m} value={m}>{m}</option>)}
          </Sel>
        </div>
        <div><Label>Temperature</Label><Inp type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => set("temperature", parseFloat(e.target.value))} /></div>
        <div><Label>Max Tokens</Label><Inp type="number" value={form.max_tokens} onChange={e => set("max_tokens", parseInt(e.target.value))} /></div>
      </div>
      <div>
        <Label>ENS Name <span className="normal-case text-[#444]">(optional — links this skill to a subdomain)</span></Label>
        <Inp value={form.ens_name} onChange={e => set("ens_name", e.target.value)} placeholder="agent.yourname.eth" />
      </div>
      <div>
        <Label>Tools <span className="normal-case text-[#444]">(JSON array, OpenAI function-calling format — optional)</span></Label>
        <Tarea value={form.tools} onChange={e => set("tools", e.target.value)} rows={3}
          className="font-mono text-xs"
          placeholder={'[{"type":"function","function":{"name":"get_price","description":"...","parameters":{}}}]'} />
      </div>

      {/* ── Security ── */}
      <div className="border-t border-gb-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-3.5 h-3.5 text-gb-muted" />
          <p className="text-xs text-gb-muted uppercase tracking-wide">Security</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Input Sources <span className="normal-case text-[#444]">(JSON array — leave empty for unscoped)</span></Label>
            <Tarea
              value={form.input_sources}
              onChange={e => set("input_sources", e.target.value)}
              rows={3}
              className={`font-mono text-xs ${inputSourcesInvalid ? "!border-red-500" : ""}`}
              placeholder={'[{"type":"ens","keys":["name"],"trust":"untrusted","sanitize":true}]'}
            />
            {inputSourcesInvalid && <p className="text-xs text-red-400 mt-1">Invalid JSON</p>}
          </div>
          <div>
            <Label>Trust Scope <span className="normal-case text-[#444]">(JSON — leave empty for no A2A)</span></Label>
            <Tarea
              value={form.trust_scope}
              onChange={e => set("trust_scope", e.target.value)}
              rows={3}
              className={`font-mono text-xs ${trustScopeInvalid ? "!border-red-500" : ""}`}
              placeholder={'{"transitive":false,"maxDepth":0,"capabilities":[]}'}
            />
            {trustScopeInvalid && <p className="text-xs text-red-400 mt-1">Invalid JSON</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={submit} disabled={saving || !form.name.trim() || inputSourcesInvalid || trustScopeInvalid}
          className="flex items-center gap-2 bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gb-faint hover:text-slate-100 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

// ─── Test Chat ────────────────────────────────────────────────────────────────
function TestChat({ skill, token, onClose }: { skill: Skill; token: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(p => [...p, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const r = await testSkill(token, skill.id, msg, sessionId);
      if (!r) throw new Error("Server error — check that your API key is set in the AI tab and the skill is enabled.");
      if (r.error) throw new Error(r.error);
      setSessionId(r.sessionId);
      setMessages(p => [...p, { role: "assistant", content: r.reply }]);
    } catch (e: any) {
      setMessages(p => [...p, { role: "assistant", content: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gb-surface border border-gb-accent rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gb-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-gb-accent" />
          <span className="text-sm font-semibold text-slate-100">Test: {skill.name}</span>
          <span className="text-xs text-gb-muted">{skill.provider} / {skill.model}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[#444]">{getGatewayUrl()}/agent/chat</span>
          <button onClick={onClose} className="text-gb-muted hover:text-gb-faint transition-colors"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-[#444] text-xs text-center mt-8">Send a message to test this skill…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <Bot className="w-4 h-4 text-gb-accent shrink-0 mt-0.5" />}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-gb-accentD text-white" : "bg-gb-input text-gb-faint"
            }`}>{m.content}</div>
            {m.role === "user" && <User className="w-4 h-4 text-gb-muted shrink-0 mt-0.5" />}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <Bot className="w-4 h-4 text-gb-accent shrink-0 mt-0.5" />
            <div className="bg-gb-input rounded-xl px-3 py-2"><Loader2 className="w-3.5 h-3.5 animate-spin text-gb-muted" /></div>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-gb-border flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type a message…"
          className="flex-1 bg-gb-input border border-gb-border focus:border-gb-accent rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-zinc-600 outline-none transition-colors"
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-gb-accentD hover:bg-gb-accent disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AiPage() {
  const { token } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [testing, setTesting] = useState<Skill | null>(null);
  const [redactionStats, setRedactionStats] = useState<RedactionStats | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try { setSkills((await getSkills(token)) ?? []); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  useEffect(() => {
    if (!token) return;
    getRedactionStats(token).then(d => { if (d) setRedactionStats(d); });
  }, [token]);

  const handleSave = async (data: typeof BLANK) => {
    if (!token) return;
    const payload = {
      ...data,
      enabled: true,
      tools:         data.tools         || undefined,
      ens_name:      data.ens_name      || undefined,
      input_sources: data.input_sources || undefined,
      trust_scope:   data.trust_scope   || undefined,
    };
    if (editing) await updateSkill(token, editing.id, payload);
    else await createSkill(token, payload);
    setAdding(false); setEditing(null);
    load();
  };

  const handleToggle = async (sk: Skill) => {
    if (!token) return;
    await updateSkill(token, sk.id, { enabled: !sk.enabled });
    load();
  };

  const handleDelete = async (sk: Skill) => {
    if (!token || !confirm(`Delete skill "${sk.name}"?`)) return;
    await deleteSkill(token, sk.id);
    if (testing?.id === sk.id) setTesting(null);
    load();
  };

  const provLabel = (p: string) => PROVIDERS.find(x => x.value === p)?.label ?? p;

  return (
    <div className="space-y-8 text-slate-100 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">AI</h1>
        <p className="text-gb-faint text-sm mt-1">
          Configure AI skills and attach them to ENS names — each skill is a callable agent endpoint
        </p>
      </div>

      {token && <ApiKeysSection token={token} />}

      {/* ── Security Monitor ── */}
      {redactionStats && (
        <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gb-border flex items-center gap-3">
            <Shield className="w-4 h-4 text-gb-muted shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-100">Security Monitor</p>
              <p className="text-xs text-gb-muted mt-0.5">On-chain injection attempts caught by the sanitizer</p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gb-border">
            <div className="px-5 py-4">
              <p className="text-xs text-gb-muted uppercase tracking-wide mb-1">Total Sessions</p>
              <p className="text-2xl font-bold text-slate-100">{redactionStats.total}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gb-muted uppercase tracking-wide mb-1">On-Chain Data Seen</p>
              <p className="text-2xl font-bold text-slate-100">{redactionStats.with_onchain}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-gb-muted uppercase tracking-wide mb-1">Injections Caught</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-bold ${redactionStats.with_redactions > 0 ? "text-amber-400" : "text-slate-100"}`}>
                  {redactionStats.with_redactions}
                </p>
                {redactionStats.with_onchain > 0 && (
                  <p className="text-xs text-gb-muted">{redactionStats.redaction_rate_pct}% of on-chain</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Skills</p>
            <p className="text-xs text-gb-muted mt-0.5">Named agent configs — provider, model, system prompt, optional ENS identity</p>
          </div>
          <button onClick={() => { setAdding(true); setEditing(null); setTesting(null); }}
            className="flex items-center gap-2 bg-gb-accentD hover:bg-gb-accent text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Skill
          </button>
        </div>

        {(adding || editing) && (
          <SkillForm
            initial={editing ? {
              name: editing.name, description: editing.description,
              system_prompt: editing.system_prompt, provider: editing.provider,
              model: editing.model, temperature: editing.temperature,
              max_tokens: editing.max_tokens, tools: editing.tools ?? "",
              ens_name: editing.ens_name ?? "",
              input_sources: editing.input_sources ?? "",
              trust_scope: editing.trust_scope ?? "",
            } : BLANK}
            onSave={handleSave}
            onCancel={() => { setAdding(false); setEditing(null); }}
          />
        )}

        {testing && token && (
          <TestChat skill={testing} token={token} onClose={() => setTesting(null)} />
        )}

        <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="px-5 py-12 text-center text-gb-muted text-sm">Loading…</div>
          ) : skills.length === 0 ? (
            <div className="px-5 py-12 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-[#333] mx-auto" />
              <p className="text-[#444] text-sm">No skills yet — create one to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Skill</th>
                  <th className="px-5 py-3 text-left">Provider</th>
                  <th className="px-5 py-3 text-left">ENS</th>
                  <th className="px-5 py-3 text-left">Security</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gb-border">
                {skills.map(sk => {
                  let sourcesCount = 0;
                  try { if (sk.input_sources) sourcesCount = JSON.parse(sk.input_sources).length; } catch {}
                  const scoped = !!sk.input_sources;
                  return (
                    <tr key={sk.id} className="hover:bg-gb-input/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-100">{sk.name}</p>
                        {sk.description && <p className="text-xs text-gb-muted mt-0.5">{sk.description}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-gb-input text-gb-faint px-2 py-0.5 rounded">{provLabel(sk.provider)}</span>
                        <p className="text-xs text-[#444] font-mono mt-0.5">{sk.model}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gb-accent">
                        {sk.ens_name || <span className="text-[#333]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {scoped ? (
                          <span className="flex items-center gap-1 text-xs text-green-400">
                            <Shield className="w-3 h-3" />{sourcesCount} source{sourcesCount !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-500">
                            <AlertTriangle className="w-3 h-3" />unscoped
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => handleToggle(sk)}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                            sk.enabled ? "bg-green-900/40 text-green-400 hover:bg-green-900/60" : "bg-gb-input text-gb-muted hover:bg-[#1a1a1a]"
                          }`}>
                          {sk.enabled ? "enabled" : "disabled"}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setTesting(testing?.id === sk.id ? null : sk); setAdding(false); setEditing(null); }}
                            title="Test" className="p-1.5 rounded hover:bg-[#1a1a1a] text-gb-muted hover:text-gb-accent transition-colors">
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setEditing(sk); setAdding(false); setTesting(null); }}
                            title="Edit" className="p-1.5 rounded hover:bg-[#1a1a1a] text-gb-muted hover:text-gb-faint transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(sk)}
                            title="Delete" className="p-1.5 rounded hover:bg-[#1a1a1a] text-gb-muted hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {skills.length > 0 && (
          <p className="text-xs text-[#444]">
            Public endpoint: <span className="font-mono text-gb-muted">POST {"{gateway}"}/agent/chat</span> with <span className="font-mono text-gb-muted">{"{ skillId, message, sessionId? }"}</span>
          </p>
        )}
      </div>
    </div>
  );
}
