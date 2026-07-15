"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getRecords, upsertRecord, deleteRecord } from "@/lib/api";
import { timeAgo, shortAddr } from "@/lib/utils";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

type EnsRecord = {
  name: string;
  contenthash?: string;
  address?: string;
  text_records: Record<string, string>;
  updated_at: number;
};

function EditRow({ record, token, onSave, onCancel }: any) {
  const [contenthash, setContenthash] = useState(record.contenthash || "");
  const [address, setAddress] = useState(record.address || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await upsertRecord(token, record.name, { contenthash, address });
    onSave();
  };

  return (
    <tr className="bg-amber-950/20">
      <td className="px-4 py-3 font-mono text-sm text-gb-accent">{record.name}</td>
      <td className="px-4 py-3">
        <input
          value={contenthash}
          onChange={(e) => setContenthash(e.target.value)}
          placeholder="ipfs://Qm... or bzz://..."
          className="w-full bg-gb-input border border-gb-border rounded px-2 py-1 text-xs font-mono text-slate-100 outline-none focus:border-gb-accent transition-colors"
        />
      </td>
      <td className="px-4 py-3">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x..."
          className="w-full bg-gb-input border border-gb-border rounded px-2 py-1 text-xs font-mono text-slate-100 outline-none focus:border-gb-accent transition-colors"
        />
      </td>
      <td className="px-4 py-3 text-[#444] text-xs">—</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="text-green-400 hover:text-green-300 transition-colors">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="text-gb-muted hover:text-gb-faint transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function RecordsPage() {
  const { token } = useAuth();
  const [records, setRecords] = useState<EnsRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    if (!token) return;
    setRecords((await getRecords(token)) ?? []);
  };

  useEffect(() => { load(); }, [token]);

  const del = async (name: string) => {
    if (!token || !confirm(`Delete ${name}?`)) return;
    await deleteRecord(token, name);
    load();
  };

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Records</h1>
          <p className="text-gb-faint text-sm mt-1">Manage ENS name resolution data</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-gb-accentD hover:bg-gb-accent px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      <div className="bg-gb-surface border border-gb-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gb-border text-gb-muted text-xs uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Contenthash</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left">Updated</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gb-border">
            {adding && (
              <tr className="bg-amber-950/20">
                <td className="px-4 py-3" colSpan={5}>
                  <div className="flex gap-2 items-center">
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="yourname.eth"
                      className="bg-gb-input border border-gb-border rounded px-3 py-1.5 text-sm font-mono text-slate-100 outline-none focus:border-gb-accent transition-colors"
                    />
                    <button
                      onClick={() => {
                        setEditing(newName);
                        setAdding(false);
                        setRecords((r) => [...r, { name: newName, text_records: {}, updated_at: 0 }]);
                      }}
                      className="bg-gb-accentD hover:bg-gb-accent px-3 py-1.5 rounded text-sm transition-colors"
                    >
                      Continue
                    </button>
                    <button onClick={() => setAdding(false)} className="text-gb-muted hover:text-gb-faint transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {records.map((r) =>
              editing === r.name ? (
                <EditRow
                  key={r.name}
                  record={r}
                  token={token}
                  onSave={() => { setEditing(null); load(); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <tr key={r.name} className="hover:bg-gb-input/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-gb-accent">{r.name}</td>
                  <td className="px-4 py-3 text-gb-faint text-xs font-mono truncate max-w-[180px]">
                    {r.contenthash || <span className="text-[#444]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gb-faint text-xs font-mono">
                    {r.address ? shortAddr(r.address) : <span className="text-[#444]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gb-muted text-xs">{r.updated_at ? timeAgo(r.updated_at) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(r.name)} className="text-gb-faint hover:text-slate-100 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => del(r.name)} className="text-gb-faint hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {records.length === 0 && !adding && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-[#444] text-sm">
                  No records yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
