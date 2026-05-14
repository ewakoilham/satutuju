import { NextResponse } from "next/server";
import { fetchLandingData } from "@/lib/landing-data-server";

/**
 * Combined read endpoint for the landing page's initial render.
 *
 * Replaces three separate calls — /api/mentors, /api/landing-photos, and
 * /api/mentor-overrides — with a single round-trip. Implementation lives in
 * `@/lib/landing-data-server` so the RSC page can call the same fetcher
 * directly (no HTTP hop) for SSR hydration.
 */
export async function GET() {
  const data = await fetchLandingData();
  return NextResponse.json(data);
}
