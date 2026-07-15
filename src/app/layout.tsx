import type { Metadata } from "next";
import { Providers } from "./providers";
import { SubdomainRouter } from "./subdomain-router";
import { BrandFavicon } from "./brand-favicon";
import { Space_Grotesk, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Vértice type trio — self-hosted by next/font at build (no external CDN).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-space-grotesk", display: "swap" });
const newsreader   = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500"], variable: "--font-newsreader", display: "swap" });
const jetbrains    = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

const GW_URL      = process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.ensub.org";
const ENS_NAME    = process.env.NEXT_PUBLIC_ENS_NAME    || "dinamic.eth";
const SHARE_IMAGE = "https://sapphire-naval-quelea-174.mypinata.cloud/ipfs/bafybeiarvaczogtqwxkprx5m4cjabyfdwuj7q4patnjhsoxoffteofg43q";

export async function generateMetadata(): Promise<Metadata> {
  let description = `${ENS_NAME} — on-chain agent identities powered by ENS`;
  let displayName = ENS_NAME;

  try {
    const r = await fetch(`${GW_URL}/record/${encodeURIComponent(ENS_NAME)}`);
    if (r.ok) {
      const data = await r.json();
      const tr   = (data.text_records || {}) as Record<string, string>;
      description = tr.description || description;
      displayName = tr.name        || displayName;
    }
  } catch {}

  return {
    title:       displayName,
    description,
    openGraph: {
      title:       displayName,
      description,
      url:         `https://${ENS_NAME}.limo`,
      type:        "website",
      images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: displayName }],
    },
    twitter: {
      card:        "summary_large_image",
      title:       displayName,
      description,
      images:      [SHARE_IMAGE],
    },
  };
}

const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${newsreader.variable} ${jetbrains.variable}`}>
      <head>
        {/* Inline script injects the favicon link so React never creates a hoistable
            fiber for it — avoids the unmountHoistable null-parent crash in React 18.3.
            Fonts are self-hosted via next/font (see imports); no manual @font-face. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var h=document.head;[{rel:"icon",href:"/favicon.svg",type:"image/svg+xml"},{rel:"icon",href:"/favicon.svg",sizes:"any"}].forEach(function(a){var l=document.createElement("link");Object.keys(a).forEach(function(k){l.setAttribute(k,a[k]);});h.appendChild(l);});})();` }} />
      </head>
      <body className="font-display">
        <Providers>
          {IS_STATIC && <SubdomainRouter />}
          <BrandFavicon />
          {children}
        </Providers>
      </body>
    </html>
  );
}
