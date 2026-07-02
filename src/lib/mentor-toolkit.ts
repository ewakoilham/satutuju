/**
 * Mentor-toolkit resolution for "Persiapan mentor" items.
 *
 * The curriculum used to instruct mentors to "prepare" artifacts the platform
 * never gave them (intake form, scorecard, question bank…). Every such item is
 * now either a real downloadable file in public/templates/mentor/ or a
 * platform page — this map turns the checklist text into that link.
 *
 * Keys are the EXACT item strings from CURRICULUM[].mentorPrep. If you reword
 * an item there, update it here.
 */

export interface MentorPrepLink {
  href: string;
  /** true = a file the browser should download; false = an in-app page. */
  download: boolean;
}

const LINKS: Record<string, MentorPrepLink> = {
  "Review the mentee's profile in the dashboard (filled at onboarding)":
    { href: "/dashboard/mentee", download: false },
  "Download the readiness scorecard":
    { href: "/templates/mentor/readiness-scorecard.xlsx", download: true },
  "Browse the Kampus database for target universities":
    { href: "/dashboard/universities", download: false },
  "Download the application tracker & deadline calendar templates":
    { href: "/dashboard/templates", download: false },
  "Download the storytelling guide questions":
    { href: "/templates/mentor/storytelling-guide.docx", download: true },
  "Download the ML feedback framework":
    { href: "/templates/mentor/feedback-framework.docx", download: true },
  "Download the CV-by-region guide":
    { href: "/templates/mentor/cv-region-guide.docx", download: true },
  "Download the interview question bank + scoring rubric":
    { href: "/templates/mentor/interview-question-bank.docx", download: true },
  "Download the final audit checklist":
    { href: "/templates/mentor/final-audit-checklist.xlsx", download: true },
  "Download the evaluation form":
    { href: "/templates/mentor/evaluation-form.docx", download: true },
};

export function mentorPrepLink(item: string): MentorPrepLink | null {
  return LINKS[item.trim()] ?? null;
}
