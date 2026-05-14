import LandingPage from "@/components/landing/LandingPage";
import { BG_PHOTOS } from "@/lib/landing-bg-photos";
import { fetchLandingData } from "@/lib/landing-data-server";

// force-dynamic: server randomizes bg + prefetches landing data per request
// so the SSR'd HTML matches what hydration uses (no swap flicker).
export const dynamic = "force-dynamic";

export default async function Home() {
  const initialData = await fetchLandingData();
  const initialBgIndex = Math.floor(Math.random() * BG_PHOTOS.length);
  return (
    <LandingPage initialBgIndex={initialBgIndex} initialData={initialData} />
  );
}
