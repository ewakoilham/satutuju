import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import rawData from "@/data/universities.json";

/**
 * PUBLIC, unauthenticated university directory.
 *
 * Mirrors the region/level/search filtering of /api/universities but is
 * open to anyone and only ever returns NON-sensitive fields
 * (name, country, degreeLevel, website). Commission, agency, fee, and
 * internal program notes are never selected here, so there's no way to
 * leak partner-commercial data through this endpoint.
 */

interface RawUniversity {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
  // (commissionNote / commissionFee / agency / programs exist in the JSON
  //  but are intentionally NOT read here)
}

interface PublicUniversity {
  id: number;
  name: string;
  country: string;
  degreeLevel: string;
  website: string;
}

const ALL_UNIVERSITIES = rawData as RawUniversity[];

const REGION_COUNTRIES: Record<string, string[]> = {
  "au-nz": ["Australia", "New Zealand"],
  uk: ["UK"],
  us: ["USA"],
  canada: ["Canada"],
  europe: [
    "Austria", "Belgium", "Croatia", "Cyprus", "Czech Republic", "Finland",
    "France", "Georgia", "Germany", "Greece", "Hungary", "Ireland", "Italy",
    "Latvia", "Lithuania", "Malta", "Monaco", "Netherlands", "Poland",
    "Portugal", "Romania", "Russia", "Spain", "Sweden", "Switzerland", "Turkey",
  ],
  asia: [
    "China", "Hong Kong", "India", "Indonesia", "Japan", "Kazakhstan",
    "Malaysia", "Philippines", "Singapore", "South Korea", "Sri Lanka",
    "Thailand", "Vietnam",
  ],
};

const ALL_GROUPED = Object.values(REGION_COUNTRIES).flat();

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const level = searchParams.get("level") || "";
  const region = searchParams.get("region") || "";
  const country = searchParams.get("country") || "";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  // Admin overrides only adjust degreeLevel. Best-effort: fall back to base
  // data if the DB is unavailable so the public page never hard-fails.
  const overrideMap: Record<number, string> = {};
  try {
    const { data: overrides } = await supabase
      .from("UniversityOverride")
      .select("universityId, degreeLevel");
    for (const o of overrides ?? []) overrideMap[o.universityId] = o.degreeLevel;
  } catch {
    // ignore — base degreeLevel is fine for the public view
  }

  let results: PublicUniversity[] = ALL_UNIVERSITIES.map((u) => ({
    id: u.id,
    name: u.name,
    country: u.country,
    degreeLevel: overrideMap[u.id] ?? u.degreeLevel,
    website: u.website,
  }));

  if (region && REGION_COUNTRIES[region]) {
    const countries = REGION_COUNTRIES[region];
    results = results.filter((u) => countries.includes(u.country));
  } else if (region === "others") {
    results = results.filter((u) => !ALL_GROUPED.includes(u.country));
  }

  if (country) {
    results = results.filter((u) => u.country === country);
  }

  if (q) {
    results = results.filter(
      (u) => u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q),
    );
  }

  if (level) {
    const broadLevels = ["Undergraduate", "Graduate"];
    results = results.filter((u) => {
      if (u.degreeLevel === level) return true;
      if (broadLevels.includes(level) && u.degreeLevel === "All") return true;
      return false;
    });
  }

  const total = results.length;
  const page = results
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(offset, offset + limit);

  return NextResponse.json(
    { universities: page, total, limit, offset },
    {
      // Public, slow-changing data — let the CDN cache it briefly.
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
