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
  webpack: (config) => {
    config.resolve.alias["@gemini-wallet/core"] = false;
    config.resolve.alias["@react-native-async-storage/async-storage"] = false;
    return config;
  },
};

export default nextConfig;
