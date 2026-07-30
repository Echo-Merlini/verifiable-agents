/** @type {import('next').NextConfig} */
// To build a static IPFS export (no admin pages, with subdomain routing):
//   OUTPUT_STATIC=1 bun run build
// Then pin the `out/` directory to IPFS and set the CID as contenthash via the ENS admin tab.
const isStaticExport = process.env.OUTPUT_STATIC === "1";

const nextConfig = {
  reactStrictMode: false,
  allowedDevOrigins: ["ordinarinos.local"],
  ...(isStaticExport ? { output: "export" } : {}),
  // Relative asset paths so /_next/... resolves correctly under any IPFS gateway URL
  ...(isStaticExport ? { assetPrefix: "", trailingSlash: true } : {}),
  env: {
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8787",
    NEXT_PUBLIC_STATIC_EXPORT: isStaticExport ? "1" : "",
  },
  distDir: isStaticExport ? "out" : ".next",
  // The PQ key-binding is meant to be recomputed by ANY origin (that's the point) — open CORS on it so a
  // third-party verifier (e.g. invinoveritas' own /verify card) can fetch + re-derive it without a proxy.
  // headers() is unsupported under `output: export`, so only when running as a server.
  ...(isStaticExport ? {} : {
    async headers() {
      return [
        {
          source: "/pq/:path*",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "*" },
            { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          ],
        },
      ];
    },
  }),
  webpack: (config) => {
    config.resolve.alias["@gemini-wallet/core"] = false;
    config.resolve.alias["@react-native-async-storage/async-storage"] = false;
    return config;
  },
};

export default nextConfig;
