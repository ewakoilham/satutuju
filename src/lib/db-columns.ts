/** Supabase select column lists. Hoisted so the API routes and the
 *  shared server-side fetcher don't drift. Add a new column? Update here
 *  once, not 3-4 times. */

export const MENTOR_SELECT_COLUMNS =
  '"id","fullName","nickname","initials","university","major","country","flagCode","scholarship","color","avatarPath","galleryPaths","hometown","message","achievement","currentStudiesRaw","s1","scholarshipRaw","isActive","displayOrder","source"';

export const LANDING_PHOTO_COLUMNS = "mentorId, location, photoSrc, zoom, posX, posY";

export const MENTOR_OVERRIDE_COLUMNS =
  "mentorId, nickname, message, achievement, currentStudies, s1, scholarship";
