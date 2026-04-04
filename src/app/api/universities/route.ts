import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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

  let results = ALL_UNIVERSITIES;

  // Region filter
  if (region && REGION_COUNTRIES[region]) {
    const countries = REGION_COUNTRIES[region];
    results = results.filter((u) => countries.includes(u.country));
  } else if (region === "others") {
    results = results.filter((u) => !ALL_GROUPED.includes(u.country));
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
  if (level) {
    results = results.filter((u) => u.degreeLevel === level);
  }

  const isAdmin = user.role === "admin";

  const sanitized = results.map(
    ({ commissionNote, commissionFee, agency, programs, ...rest }) => ({
      ...rest,
      ...(isAdmin ? { commissionNote, commissionFee, agency, programs } : {}),
    })
  );

  return NextResponse.json({
    universities: sanitized,
    total: sanitized.length,
  });
}
