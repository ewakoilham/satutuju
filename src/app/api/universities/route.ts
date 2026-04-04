import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import rawData from "@/data/universities.json";

interface University {
  id: number;
  name: string;
  country: string;
  programs: string;
  agency: string;
  commissionNote: string;
  commissionFee: string;
  degreeLevel: string;
  website: string;
}

const ALL_UNIVERSITIES = rawData as University[];

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

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const level = searchParams.get("level") || "";
  const region = searchParams.get("region") || "";
  const country = searchParams.get("country") || "";

  // Fetch admin overrides from DB
  const { data: overrides } = await supabase
    .from("UniversityOverride")
    .select("universityId, degreeLevel");

  const overrideMap: Record<number, string> = {};
  if (overrides) {
    for (const o of overrides) {
      overrideMap[o.universityId] = o.degreeLevel;
    }
  }

  // Merge overrides into base data
  let results = ALL_UNIVERSITIES.map((u) => ({
    ...u,
    degreeLevel: overrideMap[u.id] ?? u.degreeLevel,
  }));

  // Region filter
  if (region && REGION_COUNTRIES[region]) {
    const countries = REGION_COUNTRIES[region];
    results = results.filter((u) => countries.includes(u.country));
  } else if (region === "others") {
    results = results.filter((u) => !ALL_GROUPED.includes(u.country));
  }

  // Individual country filter (overrides region if both set)
  if (country) {
    results = results.filter((u) => u.country === country);
  }

  // Search
  if (q) {
    results = results.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q)
    );
  }

  // Degree level filter
  // Selecting a specific level includes "All Programs" entries (they cover all levels)
  // Exception: Undergraduate excludes Graduate-only, and vice versa
  if (level) {
    results = results.filter((u) => {
      if (u.degreeLevel === "All") return true; // All Programs always included
      if (u.degreeLevel === level) return true; // exact match always included
      // Exclude the opposite specific level
      if (level === "Undergraduate" && u.degreeLevel === "Graduate") return false;
      if (level === "Graduate" && u.degreeLevel === "Undergraduate") return false;
      // For other specific levels (English Language, Summer Programs etc), exclude unrelated specifics
      return false;
    });
  }

  const isAdmin = user.role === "admin";

  const sanitized = results.map(
    ({ commissionNote, commissionFee, agency, programs, ...rest }) => ({
      ...rest,
      ...(isAdmin ? { commissionNote, commissionFee, agency, programs } : {}),
    })
  );

  return NextResponse.json({ universities: sanitized, total: sanitized.length });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json();
  const { universityId, degreeLevel } = body;

  if (!universityId || !degreeLevel) {
    return NextResponse.json({ error: "Missing universityId or degreeLevel" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from("UniversityOverride").upsert({
    universityId,
    degreeLevel,
    updatedAt: now,
    updatedBy: user.userId,
  }, { onConflict: "universityId" });

  if (error) {
    console.error("UniversityOverride upsert error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
