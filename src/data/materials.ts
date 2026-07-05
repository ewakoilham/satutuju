/** Static materials catalog. No API/DB yet — this file is the source of truth
 *  for what shows up on /dashboard/resources (the Materi screen). When the
 *  catalog grows beyond a handful of entries, lift this into a Prisma model
 *  + admin CRUD. */

export type MaterialPhase = "discovery" | "planning" | "writing" | "execution" | "closing";
export type MaterialType = "panduan" | "template" | "contoh" | "workshop" | "direktori";
export type ToneKey = "cur" | "tool" | "tpl" | "ess" | "muted";

export interface Material {
  id: string;
  title: string;
  /** Short label above the title — "Panduan · 80 halaman" etc. */
  label: string;
  description: string;
  /** Where the material lives. `null` for "coming soon" entries. */
  href: string | null;
  /** Icon name. Falls back to "book" if the Icon set doesn't have it. */
  icon: string;
  tone: ToneKey;
  phase: MaterialPhase | "all";
  type: MaterialType;
  /** Curriculum session this material belongs to (1–10). When set, the mentee
   *  Materi screen files it under that exact session module; when null it falls
   *  back to phase-level grouping. Omit for non-session-specific resources. */
  sessionN?: number | null;
  /** Visibility — `null` = everyone. */
  roles: Array<"mentor" | "mentee" | "admin"> | null;
  /** Reading progress 0–100 (if tracked). Currently illustrative only. */
  progress?: number;
  /** Render label like "12 / 80" in the footer. */
  progressLabel?: string;
  /** Show the bookmark as filled by default. */
  bookmarked?: boolean;
  /** "Segera" tile — locked + dashed border. */
  locked?: boolean;
}

export const MATERIALS: Material[] = [
  {
    id: "curriculum",
    title: "Curriculum Guide",
    label: "Panduan · 10 sesi",
    description:
      "Kerangka 10-sesi mentoring satu tuju dari kenalan, riset kampus, sampai application closing.",
    href: "/dashboard/curriculum",
    icon: "book",
    tone: "cur",
    phase: "all",
    type: "panduan",
    roles: null,
    progress: 0,
    progressLabel: "0 / 10",
    bookmarked: true,
  },
  {
    id: "mentor-toolkit",
    title: "Mentor Toolkit",
    label: "Bacaan cepat · 8 artikel",
    description:
      "Tip 5-menit: cara handle mentee yang menghilang, ngasih feedback essay yang jujur, dan banyak lagi.",
    href: "/dashboard/mentor-toolkit",
    icon: "graduation",
    tone: "tool",
    phase: "all",
    type: "panduan",
    roles: ["mentor", "admin"],
    progress: 0,
    progressLabel: "0 / 8",
  },
  {
    id: "mentee-journey",
    title: "Mentee Registration Journey",
    label: "Diagram · 5 fase",
    description:
      "Swim lane 14 langkah inti dari first touch sampai handover ke mentor — biar kamu tahu konteks mentee.",
    href: "/dashboard/mentee-journey",
    icon: "map",
    tone: "ess",
    phase: "discovery",
    type: "panduan",
    roles: ["mentor", "admin"],
  },
  {
    id: "doc-templates",
    title: "Document Templates",
    label: "Template · 9 berkas",
    description:
      "Application tracker, deadline calendar, shortlist kampus, dan kerangka esai — siap diunduh dan diedit.",
    href: "/dashboard/templates",
    icon: "document",
    tone: "tpl",
    phase: "writing",
    type: "template",
    sessionN: 7,
    roles: null,
    locked: false,
  },
  {
    id: "thousand-essays",
    title: "1000 Essays Project",
    label: "Contoh · kurasi",
    description:
      "Kurasi esai & panduan Chevening, LPDP, AAS, Fulbright dari sumber terbuka — panduan resmi + esai yang dipublikasikan awardee. Terus bertambah.",
    href: "/dashboard/essays",
    icon: "star",
    tone: "ess",
    phase: "writing",
    type: "contoh",
    sessionN: 8,
    roles: null,
    locked: false,
  },
  {
    id: "mentor-circle",
    title: "Live Mentor Circle",
    label: "Workshop · segera",
    description:
      "Rekaman diskusi mentor bulanan — case study mentee, Q&A. Hadir Q3 2026.",
    href: null,
    icon: "video",
    tone: "muted",
    phase: "all",
    type: "workshop",
    roles: ["mentor", "admin"],
    locked: true,
  },
  {
    id: "alumni-directory",
    title: "Direktori Alumni",
    label: "Direktori · 15 alumni",
    description:
      "Alumni SatuTuju yang sudah sampai ke kampus tujuan — filter per negara, lihat cerita mereka, dan minta dikenalkan untuk insight.",
    href: "/dashboard/alumni",
    icon: "users",
    tone: "muted",
    phase: "planning",
    type: "direktori",
    sessionN: 3,
    roles: null,
    locked: false,
  },
];

/** Phase chips for the filter row. "Semua" is the default. */
export const PHASE_CHIPS: Array<{ key: MaterialPhase | "all"; label: string }> = [
  { key: "all", label: "Semua" },
  { key: "discovery", label: "Discovery" },
  { key: "planning", label: "Planning" },
  { key: "writing", label: "Writing" },
  { key: "execution", label: "Execution" },
  { key: "closing", label: "Closing" },
];

export const TYPE_CHIPS: Array<{ key: MaterialType; label: string }> = [
  { key: "panduan", label: "Panduan" },
  { key: "template", label: "Template" },
  { key: "contoh", label: "Contoh" },
];
