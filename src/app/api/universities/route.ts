import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import rawData from "@/data/universities.json";

interface University {
  id: number;
  name: string;
  country: string;
  programs: string;
  agency: string;
  commissionRate: string;
  degreeLevel: string;
  website: string;
}

const ALL_UNIVERSITIES = rawData as University[];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  const country = searchParams.get("country") || "";
  const level = searchParams.get("level") || "";

  let results = ALL_UNIVERSITIES;

  if (q) {
    results = results.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q)
    );
  }

  if (country) {
    results = results.filter((u) => u.country === country);
  }

  if (level) {
    if (level === "All") {
      results = results.filter((u) => u.degreeLevel === "All");
    } else if (level === "Graduate") {
      results = results.filter(
        (u) => u.degreeLevel === "Graduate" || u.degreeLevel === "All"
      );
    } else if (level === "Undergraduate") {
      results = results.filter(
        (u) => u.degreeLevel === "Undergraduate" || u.degreeLevel === "All"
      );
    }
  }

  const isAdmin = user.role === "admin";

  // Strip commission data for non-admins
  const sanitized = results.map(({ commissionRate, agency, programs, ...rest }) => ({
    ...rest,
    ...(isAdmin ? { commissionRate, agency, programs } : {}),
  }));

  return NextResponse.json({
    universities: sanitized,
    total: sanitized.length,
  });
}
