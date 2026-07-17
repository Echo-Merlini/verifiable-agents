"use client";

import { Sparkles, Image, Zap, Plug, Palette } from "lucide-react";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME || "dinamic.eth";

type Record = {
  key: string;
  format: string;
  behaviour: string;
  example?: string;
};

type Section = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  records: Record[];
};

const SECTIONS: Section[] = [
  {
    id: "media",
    label: "Media",
    icon: Image,
    color: "text-amber-400",
    records: [
      { key: "avatar",   format: "URL or ipfs://",           behaviour: "Profile picture",                          example: "ipfs://Qm..." },
      { key: "icon",     format: "URL or ipfs:// (SVG/PNG)", behaviour: "Site icon — nav badge + browser tab favicon", example: "ipfs://Qm..." },
      { key: "video",    format: "URL or ipfs://",           behaviour: "Looping background video",                 example: "https://..." },
      { key: "banner",   format: "URL or ipfs://",           behaviour: "Hero banner image",                        example: "ipfs://Qm..." },
      { key: "gallery",  format: "Comma-separated URLs",     behaviour: "Photo / media grid",                       example: "ipfs://Qm...,ipfs://Qm..." },
      { key: "card_bg",   format: "URL or ipfs://",           behaviour: "Background image on the profile card",      example: "ipfs://Qm..." },
      { key: "media",     format: "URL or ipfs:// (img/video)", behaviour: "Full-width media card below the page title", example: "ipfs://Qm..." },
      { key: "media_desc", format: "Text",                    behaviour: "Caption shown below the media card",         example: "My latest project" },
    ],
  },
  {
    id: "actions",
    label: "Actions",
    icon: Zap,
    color: "text-yellow-400",
    records: [
      { key: "pfp_button",   format: "Label|URL  or  URL",  behaviour: 'Primary CTA button. Label defaults to "Visit"', example: "Hire me|https://cal.com/me" },
      { key: "pfp_button_2", format: "Label|URL  or  URL",  behaviour: "Secondary CTA button",                        example: "Portfolio|https://..." },
      { key: "url",          format: "URL",                  behaviour: 'Fallback CTA "Visit Site" when pfp_button unset', example: "https://mysite.com" },
      { key: "tip",          format: "ETH address",          behaviour: "Send-tip button that opens a wallet transfer", example: "0x123..." },
      { key: "donate",       format: "ETH address",          behaviour: "Centered pill at page bottom — click to copy address", example: "0x123..." },
      { key: "cal",          format: "Calendly / Cal.com URL", behaviour: '"Book a call" button',                      example: "https://cal.com/me" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    color: "text-emerald-400",
    records: [
      { key: "com.twitter", format: "Handle or full URL",   behaviour: "Social badge + tag",   example: "@handle" },
      { key: "com.github",  format: "Username",             behaviour: "Social badge + tag",   example: "myuser" },
      { key: "discord",     format: "Handle or invite URL", behaviour: "Social badge",          example: "user#1234" },
      { key: "telegram",    format: "Handle",               behaviour: "Social badge",          example: "@handle" },
      { key: "email",       format: "Email address",        behaviour: "Contact link",          example: "me@example.com" },
      { key: "rss",         format: "Feed URL",             behaviour: "Latest posts widget",   example: "https://blog.me/rss.xml" },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: Palette,
    color: "text-pink-400",
    records: [
      { key: "theme",  format: "dark / light / gradient:<color>", behaviour: "Overrides colour scheme",  example: "gradient:purple" },
      { key: "layout", format: "minimal / full / grid",           behaviour: "Page layout variant",       example: "minimal" },
      { key: "badge",  format: "Short string",                    behaviour: "Status badge on avatar",    example: "Available for work" },
    ],
  },
];

const CONVENTIONS = [
  "Keys follow existing ENSIP-5 conventions where they exist (com.twitter, com.github, avatar, url, email).",
  "New keys use lowercase with underscores (pfp_button, pfp_button_2).",
  "Multi-value fields use | as separator — label first, URL second.",
  "All URL fields accept ipfs:// as well as https://.",
  "Unknown keys are silently ignored — spec is forwards compatible.",
];

export default function SpecPage() {
  const tr       = usePageRecords(`spec.${ENS_NAME}`);
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  return (
    <div className="min-h-screen bg-black text-white font-display">
      <NavMenu currentPath="spec" />

      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-white/50 font-mono">ENS-KIT/1</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">Draft</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-3">Text Record Extension Spec</h1>
          <p className="text-white/50 text-base leading-relaxed max-w-xl">
            A proposed convention for driving frontend UI directly from ENS text records.
            Compatible with any ENS name — no custom resolver required.
            Updates are instant, gasless, and require no redeployment.
          </p>
          <p className="mt-4 text-sm text-white/30">
            Reference implementation: <span className="font-mono text-white/50">{ENS_NAME}</span>
            {" · "}
            <a href="https://github.com/Echo-Merlini/ens-dynamic-kit" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/60 transition-colors">
              ens-dynamic-kit
            </a>
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <section key={section.id}>
              <div className="flex items-center gap-2 mb-4">
                <section.icon className={`w-4 h-4 ${section.color}`} />
                <h2 className="text-lg font-medium">{section.label}</h2>
              </div>
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-white/2">
                      <th className="text-left px-4 py-3 text-white/40 font-normal text-xs uppercase tracking-widest w-40">Key</th>
                      <th className="text-left px-4 py-3 text-white/40 font-normal text-xs uppercase tracking-widest">Format</th>
                      <th className="text-left px-4 py-3 text-white/40 font-normal text-xs uppercase tracking-widest hidden md:table-cell">Behaviour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.records.map((r, i) => (
                      <tr key={r.key} className={i < section.records.length - 1 ? "border-b border-white/5" : ""}>
                        <td className="px-4 py-3 font-mono text-white/80 align-top">{r.key}</td>
                        <td className="px-4 py-3 text-white/50 align-top">
                          <div>{r.format}</div>
                          {r.example && (
                            <div className="font-mono text-xs text-white/25 mt-0.5">{r.example}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/50 align-top hidden md:table-cell">{r.behaviour}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        {/* Conventions */}
        <section className="mt-12">
          <h2 className="text-lg font-medium mb-4">Conventions</h2>
          <ul className="space-y-2">
            {CONVENTIONS.map((c, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/50">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-white/20 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/8 flex items-center justify-between">
          <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← {ENS_NAME}</a>
          <a href={`${process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8787"}/admin`} target="_blank" rel="noopener noreferrer" className="text-xs text-white/30 hover:text-white/60 transition-colors">Admin Panel →</a>
        </div>
      </div>
    </div>
  );
}
