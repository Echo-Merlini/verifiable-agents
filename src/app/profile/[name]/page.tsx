import dynamic from "next/dynamic";

// ProfileClient reads window.__PROFILE__ and window.location.hostname at render time.
// Disabling SSR avoids the hydration mismatch between the static shell (name="_")
// and the client where those window values are populated.
const ProfileClient = dynamic(() => import("./ProfileClient"), { ssr: false });

export const dynamicParams = process.env.OUTPUT_STATIC === "1" ? false : true;
export function generateStaticParams() { return [{ name: "_" }]; }

export default function ProfilePage({ params }: { params: { name: string } }) {
  return <ProfileClient name={params.name} />;
}
