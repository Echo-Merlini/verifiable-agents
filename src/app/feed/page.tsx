"use client";

import { useEffect, useState } from "react";
import { Rss, ExternalLink, Calendar, User, ArrowLeft } from "lucide-react";
import { usePageRecords } from "@/hooks/usePageRecords";
import { NavMenu } from "@/components/NavMenu";

const GW_URL   = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";

type FeedItem = {
  title: string;
  link: string;
  date: string;
  author: string;
  image: string;
  excerpt: string;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch { return raw; }
}

async function fetchFeed(url: string): Promise<{ title: string; desc: string; link: string; items: FeedItem[] }> {
  let xml = "";
  try {
    const r = await fetch(url);
    if (r.ok) xml = await r.text();
  } catch {}
  if (!xml) {
    try {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      if (r.ok) { const d = await r.json(); xml = d.contents || ""; }
    } catch {}
  }
  if (!xml) return { title: "", desc: "", link: "", items: [] };

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const channel = doc.querySelector("channel");
  const title = channel?.querySelector(":scope > title")?.textContent?.trim() || "";
  const desc  = channel?.querySelector(":scope > description")?.textContent?.trim() || "";
  const link  = channel?.querySelector(":scope > link")?.textContent?.trim() || "";

  const items = [...doc.querySelectorAll("item")].map(el => {
    const rawDesc = el.querySelector("encoded")?.textContent ||
                    el.querySelector("description")?.textContent || "";
    return {
      title:   el.querySelector("title")?.textContent?.trim() || "",
      link:    el.querySelector("link")?.textContent?.trim() || "",
      date:    el.querySelector("pubDate")?.textContent?.trim() || "",
      author:  el.querySelector("creator, author")?.textContent?.trim() || "",
      image:   el.querySelector("content")?.getAttribute("url") ||
               el.querySelector("enclosure")?.getAttribute("url") ||
               (rawDesc.match(/<img[^>]+src=["\']([^"\']+)["\']/) || [])[1] || "",
      excerpt: stripHtml(rawDesc).slice(0, 160),
    };
  });

  return { title, desc, link, items };
}

export default function FeedPage() {
  const tr       = usePageRecords(`feed.${ENS_NAME}`);
  const icon     = tr.icon;
  const avatar   = tr.avatar;
  const cardBg   = tr.card_bg;
  const videoUrl = tr.video;

  const [rssUrl, setRssUrl]       = useState("");
  const [feed, setFeed]           = useState<Awaited<ReturnType<typeof fetchFeed>> | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${GW_URL}/record/${encodeURIComponent(ENS_NAME)}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        const url  = data.text_records?.rss as string | undefined;
        if (!url) { setError(true); setLoading(false); return; }
        setRssUrl(url);
        const result = await fetchFeed(url);
        if (!result.items.length) setError(true);
        setFeed(result);
      } catch { setError(true); }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="relative min-h-screen font-display bg-black text-white">
      <NavMenu currentPath="feed" />


      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(99,102,241,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_70%,rgba(79,70,229,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 lg:px-6 py-10">

        {/* Back link */}
        <a href="../" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8">
          <ArrowLeft className="w-3.5 h-3.5" />
          {ENS_NAME}
        </a>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-6xl lg:text-8xl font-medium tracking-[-0.05em] text-white leading-none mb-5">
            feed<em className="font-serif not-italic text-white/60">.{ENS_NAME}</em>
          </h1>
          <p className="text-sm lg:text-base text-white/40 font-light max-w-lg leading-relaxed">
            RSS feeds on Ethereum — live content from the {ENS_NAME} network.
          </p>
        </div>

        {/* RSS strip */}
        {(rssUrl || feed?.link) && (
          <div className="liquid-glass-strong rounded-3xl p-4 mb-8 flex flex-wrap items-center gap-4">
            {feed?.link && (
              <a href={feed.link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
                {(() => { try { return new URL(feed.link).hostname; } catch { return feed.link; } })()}
              </a>
            )}
            {feed?.desc && (
              <p className="text-xs text-white/30 flex-1 min-w-0 truncate">{feed.desc}</p>
            )}
            {rssUrl && (
              <a href={rssUrl} target="_blank" rel="noopener noreferrer"
                className="ml-auto shrink-0 inline-flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/70 transition-colors border border-white/10 hover:border-white/25 rounded-full px-3 py-1.5">
                <Rss className="w-2.5 h-2.5" /> Subscribe
              </a>
            )}
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-3xl bg-white/4 overflow-hidden animate-pulse">
                <div className="h-44 bg-white/6" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/8 rounded-full w-3/4" />
                  <div className="h-3 bg-white/6 rounded-full w-full" />
                  <div className="h-3 bg-white/6 rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-24 text-white/30">
            <Rss className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No RSS feed configured or feed could not be loaded.</p>
            <p className="text-xs mt-1">Set an <span className="font-mono">rss</span> text record on <span className="font-mono">{ENS_NAME}</span></p>
          </div>
        )}

        {/* Feed grid */}
        {!loading && feed && feed.items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feed.items.map((item, i) => (
              <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                className="group flex flex-col rounded-3xl bg-white/4 border border-white/6 hover:border-white/15 hover:bg-white/6 overflow-hidden transition-all">

                {/* Thumbnail */}
                {item.image ? (
                  <div className="h-44 overflow-hidden bg-white/5">
                    <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="h-44 bg-white/4 flex items-center justify-center">
                    <Rss className="w-8 h-8 text-white/10" />
                  </div>
                )}

                {/* Content */}
                <div className="flex flex-col flex-1 p-4 gap-2">
                  <h2 className="text-sm font-medium text-white/85 group-hover:text-white leading-snug transition-colors line-clamp-3">
                    {item.title}
                  </h2>
                  {item.excerpt && (
                    <p className="text-xs text-white/40 leading-relaxed line-clamp-3">{item.excerpt}</p>
                  )}
                  <div className="mt-auto pt-3 flex items-center gap-3 text-[10px] text-white/25 border-t border-white/6">
                    {item.author && (
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-2.5 h-2.5 shrink-0" />{item.author}
                      </span>
                    )}
                    {item.date && (
                      <span className="flex items-center gap-1 shrink-0 ml-auto">
                        <Calendar className="w-2.5 h-2.5" />{formatDate(item.date)}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
