/**
 * Catalog for the Document Templates library (/dashboard/templates).
 *
 * These are the program templates SatuTuju produces — the scaffolds a mentee
 * downloads, fills in, and uploads back to the relevant session (see
 * `doc-templates.ts` for the same files keyed by checklist label). The files
 * already live in `public/templates/`; this file is just the display metadata.
 */

export interface TemplateItem {
  /** Stable id (also the anchor target). */
  id: string;
  title: string;
  /** Public path under /public — used for both download and preview. */
  file: string;
  format: "xlsx" | "docx";
  icon: string;
  /** What's inside + when to use it. */
  description: string;
  /** Curriculum session this template is introduced in. */
  sessionN: number;
}

export interface TemplateGroup {
  id: string;
  title: string;
  /** One-line framing for the group. */
  blurb: string;
  /** Visibility — undefined = everyone. */
  roles?: Array<"mentor" | "admin">;
  items: TemplateItem[];
}

export const FORMAT_META: Record<TemplateItem["format"], { label: string; ext: string }> = {
  xlsx: { label: "Spreadsheet", ext: "XLSX" },
  docx: { label: "Dokumen", ext: "DOCX" },
};

export const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    id: "riset-kampus",
    title: "Riset & shortlist kampus",
    blurb: "Dari daftar impian sampai shortlist yang realistis dan terukur.",
    items: [
      {
        id: "university-wish-list",
        title: "University wish list",
        file: "/templates/university-wish-list.xlsx",
        format: "xlsx",
        icon: "star",
        description:
          "Daftar awal kampus impian — kolom kampus, jurusan, negara, alasan, dan estimasi biaya. Titik mulai sebelum kamu kerucutkan jadi shortlist.",
        sessionN: 1,
      },
      {
        id: "financial-overview",
        title: "Financial overview",
        file: "/templates/financial-overview.xlsx",
        format: "xlsx",
        icon: "wallet",
        description:
          "Gambaran biaya studi (kuliah, hidup, visa) vs sumber dana (beasiswa, tabungan, sponsor) biar rencana finansialmu realistis sejak awal.",
        sessionN: 2,
      },
      {
        id: "university-shortlist",
        title: "University shortlist document",
        file: "/templates/university-shortlist.xlsx",
        format: "xlsx",
        icon: "school",
        description:
          "Kerucutkan jadi 5–8 kampus: kategori safety / target / reach, syarat masuk, deadline, dan skor kecocokan per opsi.",
        sessionN: 3,
      },
    ],
  },
  {
    id: "timeline-aplikasi",
    title: "Timeline & tracking aplikasi",
    blurb: "Satu tempat untuk semua deadline dan status aplikasi.",
    items: [
      {
        id: "application-tracker",
        title: "Application tracker",
        file: "/templates/application-tracker.xlsx",
        format: "xlsx",
        icon: "clipboard-check",
        description:
          "Lacak status tiap aplikasi dalam satu tabel: dokumen, deadline, submitted / under review / hasil — biar tidak ada yang kelewat.",
        sessionN: 4,
      },
      {
        id: "deadline-calendar",
        title: "Deadline calendar",
        file: "/templates/deadline-calendar.xlsx",
        format: "xlsx",
        icon: "calendar",
        description:
          "Kalender mundur dari tiap deadline: kapan harus tes bahasa, minta surat rekomendasi, dan submit untuk masing-masing kampus.",
        sessionN: 4,
      },
    ],
  },
  {
    id: "esai-tulisan",
    title: "Esai & tulisan",
    blurb: "Kerangka biar kamu nggak mulai dari halaman kosong.",
    items: [
      {
        id: "narrative-core",
        title: "Narrative core document",
        file: "/templates/narrative-core.docx",
        format: "docx",
        icon: "document",
        description:
          "Kerangka cerita inti kamu — pengalaman kunci, alasan 'why this program', dan benang merah — disiapkan sebelum menulis motivation letter.",
        sessionN: 5,
      },
      {
        id: "ml-ps-outline",
        title: "ML / PS outline",
        file: "/templates/ml-ps-outline.docx",
        format: "docx",
        icon: "document",
        description:
          "Struktur empat bagian motivation letter / personal statement: hook pembuka, latar belakang, tujuan studi, dan kontribusi setelah lulus.",
        sessionN: 5,
      },
    ],
  },
  {
    id: "wawancara-penutup",
    title: "Wawancara & penutup",
    blurb: "Persiapan wawancara sampai langkah setelah submit.",
    items: [
      {
        id: "interview-prep-notes",
        title: "Interview prep notes",
        file: "/templates/interview-prep-notes.docx",
        format: "docx",
        icon: "chat",
        description:
          "Bank pertanyaan umum plus kerangka jawaban metode STAR dan intro 2 menit untuk wawancara beasiswa maupun kampus.",
        sessionN: 8,
      },
      {
        id: "post-submission-plan",
        title: "Post-submission plan",
        file: "/templates/post-submission-plan.docx",
        format: "docx",
        icon: "flag",
        description:
          "Rencana setelah submit: skenario diterima / waitlist / ditolak, langkah berikutnya, dan jadwal follow-up tiap kampus.",
        sessionN: 10,
      },
    ],
  },
];

/** Mentor-only toolkit — the artifacts every "Persiapan mentor" checklist item
 *  used to tell mentors to invent from scratch. Linked from the Panduan
 *  Kurikulum via mentor-toolkit.ts. */
export const MENTOR_TOOLKIT_GROUP: TemplateGroup = {
  id: "toolkit-mentor",
  title: "Toolkit mentor",
  blurb: "Alat kerja per sesi — scorecard, panduan feedback, bank pertanyaan. Khusus mentor.",
  roles: ["mentor", "admin"],
  items: [
    {
      id: "readiness-scorecard",
      title: "Readiness scorecard",
      file: "/templates/mentor/readiness-scorecard.xlsx",
      format: "xlsx",
      icon: "chart",
      description:
        "Skor kesiapan mentee di 5 kategori (akademik, bahasa, finansial, dokumen, motivasi) — isi bareng mentee untuk memetakan gap.",
      sessionN: 2,
    },
    {
      id: "storytelling-guide",
      title: "Storytelling guide",
      file: "/templates/mentor/storytelling-guide.docx",
      format: "docx",
      icon: "chat",
      description:
        "Pertanyaan pemandu untuk menggali cerita asli mentee — akar minat, momen pembuktian, sampai kontribusi pulang.",
      sessionN: 5,
    },
    {
      id: "feedback-framework",
      title: "Kerangka feedback ML",
      file: "/templates/mentor/feedback-framework.docx",
      format: "docx",
      icon: "clipboard-check",
      description:
        "Empat lapis review motivation letter (struktur, bukti, suara, teknis) + tabel prioritas revisi maksimal 3 poin.",
      sessionN: 6,
    },
    {
      id: "cv-region-guide",
      title: "Panduan CV per region",
      file: "/templates/mentor/cv-region-guide.docx",
      format: "docx",
      icon: "school",
      description:
        "Norma CV per negara tujuan (UK, Eropa, US, AUS, Asia) — panjang, foto, urutan section — plus aturan universal.",
      sessionN: 7,
    },
    {
      id: "interview-question-bank",
      title: "Bank pertanyaan wawancara",
      file: "/templates/mentor/interview-question-bank.docx",
      format: "docx",
      icon: "users",
      description:
        "20 pertanyaan wawancara dalam 4 kategori + rubrik penilaian 1–4 untuk mock interview yang terukur.",
      sessionN: 8,
    },
    {
      id: "final-audit-checklist",
      title: "Final audit checklist",
      file: "/templates/mentor/final-audit-checklist.xlsx",
      format: "xlsx",
      icon: "clipboard-check",
      description:
        "Audit dokumen per kampus sebelum submit + cek konsistensi lintas dokumen yang paling sering bikin gagal.",
      sessionN: 9,
    },
    {
      id: "evaluation-form",
      title: "Form evaluasi program",
      file: "/templates/mentor/evaluation-form.docx",
      format: "docx",
      icon: "star",
      description:
        "Form penutup program — kilas balik tujuan, rating pengalaman, refleksi terbuka, dan rencana pasca-submit.",
      sessionN: 10,
    },
  ],
};

TEMPLATE_GROUPS.push(MENTOR_TOOLKIT_GROUP);

export const TEMPLATE_COUNT = TEMPLATE_GROUPS.reduce((n, g) => n + g.items.length, 0);
