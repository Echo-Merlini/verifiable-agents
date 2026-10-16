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

// The product's own identity. Deliberately NOT derived from vertice.eth any more.
//
// This used to fetch the ENS text records of the COMPANY's name and use them as the page title and
// description, so every share card of this product was headed "Vértice" and declared its canonical
// URL as vertice.eth.limo — which serves a holding page. That is the same confusion the domain move
// was meant to fix, one layer down: the address was the product's, the card still said the company.
//
// Env-overridable so a rename is a redeploy, not a code change.
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Recomputable Agents";
const SITE_URL  = process.env.NEXT_PUBLIC_SITE_URL  || "https://recomputableagents.com";
const SITE_DESC = process.env.NEXT_PUBLIC_SITE_DESC
  || "You can have an agent that acts on-chain — and anyone can verify what it did.";
// On-origin PNG (1200x630). X/Twitter and most crawlers do NOT render SVG or fetch
// IPFS gateways reliably — must be a raster on a fast host, hence a same-origin .png.
const SHARE_IMAGE = `${SITE_URL}/og.png`;

export async function generateMetadata(): Promise<Metadata> {
  return {
    // metadataBase makes every relative asset URL resolve against the product origin rather than
    // whichever host served the request — ai. and demo. serve this same container.
    metadataBase: new URL(SITE_URL),
    title:       SITE_NAME,
    description: SITE_DESC,
    alternates:  { canonical: SITE_URL },
    openGraph: {
      title:       SITE_NAME,
      description: SITE_DESC,
      url:         SITE_URL,
      siteName:    SITE_NAME,
      type:        "website",
      images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card:        "summary_large_image",
      title:       SITE_NAME,
      description: SITE_DESC,
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
