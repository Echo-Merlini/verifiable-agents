"use client";
import { useState, useEffect, useCallback } from "react";
import { useNFTs } from "@/hooks/useNFTs";
import { User, Link, Palette, Plus, Loader2, Check, X, ChevronDown, ChevronUp, Search } from "lucide-react";

const GW_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";

export type ProfileFields = {
  name?: string;
  description?: string;
  avatar?: string;
  url?: string;
  "com.twitter"?: string;
  "com.github"?: string;
  telegram?: string;
  badge?: string;
  video?: string;
  card_bg?: string;
  pfp_button?: string;
  pfp_button_2?: string;
};

type Nft = { contractAddress: string; tokenId: string; name: string; collection: string; image: string };

// ── NFT Picker Modal ──────────────────────────────────────────────────────────
function NftPicker({
  address, onSelect, onClose,
}: { address: string; onSelect: (url: string) => void; onClose: () => void }) {
  const { nfts: rawNfts, loading, error: nftError } = useNFTs(address as `0x${string}`);
  const nfts: Nft[] = rawNfts.filter(n => n.image).map(n => ({
    contractAddress: n.contractAddress,
    tokenId: n.tokenId,
    name: n.name,
    collection: n.collectionName,
    image: n.image,
  }));
  const error = nftError || "";
  const [query, setQuery]     = useState("");

  const filtered = query
    ? nfts.filter(n => `${n.name} ${n.collection}`.toLowerCase().includes(query.toLowerCase()))
    : nfts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-black/90 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <p className="text-sm font-medium text-white">Pick an NFT as avatar</p>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or collection…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            />
          </div>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-white/40">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading NFTs…
            </div>
          ) : error ? (
            <p className="text-center text-red-400 text-sm py-8">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">No NFTs found</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(nft => (
                <button
                  key={`${nft.contractAddress}-${nft.tokenId}`}
                  onClick={() => { onSelect(nft.image); onClose(); }}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-amber-400/50 transition-colors"
                >
                  <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                    <p className="text-[9px] text-white leading-tight truncate w-full">{nft.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <p className="text-[10px] text-white/25 text-center">
            Or paste any image URL in the Avatar field directly
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon, title, children, defaultOpen = true }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-white/70">
          {icon}{title}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3">{children}</div>}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none"
    />
  );
}

// ── ProfileEditor ─────────────────────────────────────────────────────────────
export function ProfileEditor({
  initial,
  ownerAddress,
  token,
  claimedName,
  onSaved,
}: {
  initial?: ProfileFields;
  ownerAddress?: string;
  token: string;
  claimedName: string;
  onSaved?: (fields: ProfileFields) => void;
}) {
  const [fields, setFields] = useState<ProfileFields>(initial ?? {});
  const [showNftPicker, setShowNftPicker] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Keep parent in sync for live preview
  useEffect(() => { onSaved?.(fields); }, [fields]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((key: keyof ProfileFields, val: string) => {
    setFields(f => ({ ...f, [key]: val }));
    setSaved(false);
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveErr("");
    try {
      const r = await fetch(`${GW_URL}/api/claim/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, records: fields }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setSaved(true);
    } catch (e: any) {
      setSaveErr(e.message);
    }
    setSaving(false);
  };

  return (
    <>
      {showNftPicker && ownerAddress && (
        <NftPicker
          address={ownerAddress}
          onSelect={url => set("avatar", url)}
          onClose={() => setShowNftPicker(false)}
        />
      )}

      <div className="space-y-4">

        {/* ── Identity ── */}
        <Section icon={<User className="w-3.5 h-3.5" />} title="Identity">
          <Field label="Display name">
            <Input value={fields.name ?? ""} onChange={v => set("name", v)} placeholder="Your Name" />
          </Field>
          <Field label="Bio">
            <Textarea value={fields.description ?? ""} onChange={v => set("description", v)} placeholder="A short bio…" rows={3} />
          </Field>
          <Field label="Avatar" hint="Paste an image URL, or pick an NFT you own">
            <div className="flex gap-2">
              <Input value={fields.avatar ?? ""} onChange={v => set("avatar", v)} placeholder="https://…" />
              {ownerAddress && (
                <button
                  onClick={() => setShowNftPicker(true)}
                  className="shrink-0 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white hover:border-white/30 transition-colors whitespace-nowrap"
                >
                  Pick NFT
                </button>
              )}
            </div>
            {fields.avatar && (
              <img src={fields.avatar} alt="preview" className="w-14 h-14 rounded-full object-cover mt-2 border border-white/10" />
            )}
          </Field>
          <Field label="Badge text" hint="Small label shown below avatar (e.g. 'Pixel Goblin #42')">
            <Input value={fields.badge ?? ""} onChange={v => set("badge", v)} placeholder="Optional badge" />
          </Field>
        </Section>

        {/* ── Socials ── */}
        <Section icon={<Link className="w-3.5 h-3.5" />} title="Socials">
          <Field label="Website">
            <Input value={fields.url ?? ""} onChange={v => set("url", v)} placeholder="https://yoursite.com" />
          </Field>
          <Field label="Twitter / X">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">@</span>
              <Input value={fields["com.twitter"] ?? ""} onChange={v => set("com.twitter", v)} placeholder="handle" />
            </div>
          </Field>
          <Field label="GitHub">
            <Input value={fields["com.github"] ?? ""} onChange={v => set("com.github", v)} placeholder="username" />
          </Field>
          <Field label="Telegram">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">@</span>
              <Input value={fields.telegram ?? ""} onChange={v => set("telegram", v)} placeholder="handle" />
            </div>
          </Field>
        </Section>

        {/* ── Appearance ── */}
        <Section icon={<Palette className="w-3.5 h-3.5" />} title="Appearance" defaultOpen={false}>
          <Field label="Background video URL" hint="MP4 or WebM link — plays as full-screen background">
            <Input value={fields.video ?? ""} onChange={v => set("video", v)} placeholder="https://…/bg.mp4" />
          </Field>
          <Field label="Card background image URL" hint="Used as the left panel background image">
            <Input value={fields.card_bg ?? ""} onChange={v => set("card_bg", v)} placeholder="https://…/card.jpg" />
          </Field>
        </Section>

        {/* ── Buttons ── */}
        <Section icon={<Plus className="w-3.5 h-3.5" />} title="Call-to-action buttons" defaultOpen={false}>
          <Field label="Primary button" hint="Format: Label|https://link.com">
            <Input value={fields.pfp_button ?? ""} onChange={v => set("pfp_button", v)} placeholder="Buy Now|https://opensea.io/…" />
          </Field>
          <Field label="Secondary button" hint="Format: Label|https://link.com">
            <Input value={fields.pfp_button_2 ?? ""} onChange={v => set("pfp_button_2", v)} placeholder="Learn More|https://…" />
          </Field>
        </Section>

        {/* ── Save button ── */}
        {saveErr && <p className="text-red-400 text-xs px-1">{saveErr}</p>}
        <div className="flex gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-white/8 hover:bg-white/12 border border-white/15 rounded-xl py-3 flex items-center justify-center gap-2 text-sm text-white transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-green-400" /> : <Check className="w-4 h-4" />}
            {saved ? "Saved!" : "Save Records"}
          </button>
        </div>
        {saved && (
          <p className="text-[10px] text-white/35 text-center -mt-2">
            Records saved to gateway — visible at{" "}
            <a href={`https://${claimedName}.limo`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60">{claimedName}</a>
          </p>
        )}
      </div>
    </>
  );
}
