import "server-only";

import { supabase } from "@/lib/supabase";
import type { DbMentor } from "@/lib/mentors-runtime";
import type { PhotoConfig, PhotoLocation } from "@/lib/photo-config";
import {
  MENTOR_SELECT_COLUMNS,
  LANDING_PHOTO_COLUMNS,
  MENTOR_OVERRIDE_COLUMNS,
} from "@/lib/db-columns";

/** Shape returned by the combined landing-data read. Shared between the
 *  REST endpoint (/api/landing-data) and the RSC page that pre-fetches
 *  this data so PhotoEditProvider can hydrate without a client round-trip. */
export interface LandingInitialData {
  mentors: DbMentor[];
  configs: Array<PhotoConfig & { mentorId: string; location: PhotoLocation }>;
  overrides: Array<{
    mentorId: string;
    nickname?: string | null;
    message?: string | null;
    achievement?: string | null;
    currentStudies?: string | null;
    s1?: string | null;
    scholarship?: string | null;
  }>;
}

/** Runs the three landing-data queries in parallel. On any individual
 *  failure we degrade to an empty array for that slice so the page can
 *  still render (e.g. show static seed mentors when DB is down). */
export async function fetchLandingData(): Promise<LandingInitialData> {
  const [mentorsRes, configsRes, overridesRes] = await Promise.all([
    supabase
      .from("Mentor")
      .select(MENTOR_SELECT_COLUMNS)
      .eq("isActive", true)
      .order("displayOrder", { ascending: true }),
    supabase.from("LandingPhotoConfig").select(LANDING_PHOTO_COLUMNS),
    // Fail soft: if bio-content columns aren't migrated yet, retry
    // nickname-only so the page still renders.
    supabase
      .from("MentorOverride")
      .select(MENTOR_OVERRIDE_COLUMNS)
      .then(async (res) => {
        if (!res.error) return res;
        return await supabase.from("MentorOverride").select("mentorId, nickname");
      }),
  ]);

  return {
    mentors: (mentorsRes.data ?? []) as DbMentor[],
    configs: (configsRes.data ?? []) as LandingInitialData["configs"],
    overrides: (overridesRes.data ?? []) as LandingInitialData["overrides"],
  };
}
