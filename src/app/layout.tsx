import { ThemeApply } from "@/components/ThemeApply";
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
// On-origin PNG (1200x630). X/Twitter and most crawlers do NOT render SVG or fetch
// IPFS gateways reliably — must be a raster on a fast host, hence a same-origin .png.
const SHARE_IMAGE = "https://ai.verticecriativo.pt/og.png";

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
    // suppressHydrationWarning: the theme script below sets data-theme on <html> before
    // paint. Without this, hydration compares <html> against the server markup — which has
    // no data-theme — and strips the attribute, so light flashes and snaps back to dark.
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${newsreader.variable} ${jetbrains.variable}`}>
      <body className="font-display">
        <ThemeApply />
      {/* Theme switch, deliberately NOT a visible control yet.
          Light is a first pass: roughly half the colour in the app still bypasses the
          palette tokens, so parts of it wash out. Until that is fixed, light is reachable
          only on purpose — ?theme=light to enter, ?theme=dark to leave — and the choice
          persists so you can click around. Visitors who do not know the parameter never
          see a half-themed site. Runs before paint, so there is no flash.
          Wrapped in try/catch: a blocked localStorage must not take the page down. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{
            var p=new URLSearchParams(location.search).get('theme');
            if(p==='light'||p==='dark'){localStorage.setItem('vx-theme',p);}
            var t=localStorage.getItem('vx-theme');
            if(t==='light'){document.documentElement.setAttribute('data-theme','light');}
          }catch(e){}})();`,
        }}
      />

        <Providers>
          {IS_STATIC && <SubdomainRouter />}
          <BrandFavicon />
          {children}
        </Providers>
      </body>
    </html>
  );
}
