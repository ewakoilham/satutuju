/**
 * 1000 Essays Project — curated catalog (/dashboard/essays).
 *
 * COPYRIGHT MODEL: we never host or republish essay text. Every entry LINKS
 * OUT to a source that published it deliberately — official scholarship
 * guidance, university writing centers, or awardees who posted their own
 * essays on their own blogs. Rights stay with the authors.
 *
 * CURATION RULES (enforce when adding entries):
 *  1. Verify the URL is live before adding (record verifiedAt).
 *  2. Only content the author/publisher made freely public — no course
 *     handbooks, paid products, or scraped/re-uploaded copies (a
 *     SchoolingMe handbook was rejected on exactly this rule).
 *  3. Prefer: official program guidance > university writing centers >
 *     awardee-published essays. No SEO content farms.
 */

export type EssayScholarship = "chevening" | "lpdp" | "aas" | "fulbright" | "umum";
export type EssayKind = "esai" | "panduan" | "cerita";
export type EssaySource = "resmi" | "awardee" | "kampus";

export interface EssayLink {
  id: string;
  title: string;
  /** Who published it — shown as the source line. */
  publisher: string;
  scholarship: EssayScholarship;
  kind: EssayKind;
  source: EssaySource;
  lang: "id" | "en";
  href: string;
  description: string;
  /** Last time we confirmed the link resolves (YYYY-MM-DD). */
  verifiedAt: string;
}

export const SCHOLARSHIP_META: Record<EssayScholarship, { label: string }> = {
  chevening: { label: "Chevening" },
  lpdp: { label: "LPDP" },
  aas: { label: "Australia Awards" },
  fulbright: { label: "Fulbright" },
  umum: { label: "Umum" },
};

export const KIND_META: Record<EssayKind, { label: string }> = {
  esai: { label: "Contoh esai" },
  panduan: { label: "Panduan" },
  cerita: { label: "Cerita awardee" },
};

export const SOURCE_META: Record<EssaySource, { label: string }> = {
  resmi: { label: "Sumber resmi" },
  awardee: { label: "Blog awardee" },
  kampus: { label: "Kampus" },
};

const V = "2026-07-06";

export const ESSAY_LINKS: EssayLink[] = [
  // ── Chevening ────────────────────────────────────────────────────────
  {
    id: "chevening-criteria",
    title: "Kriteria & panduan empat esai Chevening",
    publisher: "Chevening (resmi)",
    scholarship: "chevening",
    kind: "panduan",
    source: "resmi",
    lang: "en",
    href: "https://www.chevening.org/resource-hub/guidance/application-criteria/",
    description:
      "Panduan resmi apa yang dinilai di esai leadership, networking, study plan, dan career plan — mulai dari sini sebelum menulis.",
    verifiedAt: V,
  },
  {
    id: "chevening-reading-committee",
    title: "Feedback komite seleksi: di mana pelamar gagal",
    publisher: "Chevening (resmi)",
    scholarship: "chevening",
    kind: "panduan",
    source: "resmi",
    lang: "en",
    href: "https://www.chevening.org/news/reading-committee-feedback-for-applicants/",
    description:
      "Komite pembaca Chevening membedah kesalahan umum tiap esai dan seperti apa jawaban skor tertinggi — langka, langsung dari penilainya.",
    verifiedAt: V,
  },
  {
    id: "chevening-leadership-awardee",
    title: "Leadership essay — bedah dari scholar",
    publisher: "Agriculture First (blog awardee)",
    scholarship: "chevening",
    kind: "esai",
    source: "awardee",
    lang: "en",
    href: "https://agriculturefirstblog.wordpress.com/2019/08/09/my-chevening-journey-part-1-leadership/",
    description:
      "Chevening scholar membongkar cara ia memilih 3 contoh leadership dan menyusunnya jadi esai yang lolos.",
    verifiedAt: V,
  },
  {
    id: "chevening-networking-awardee",
    title: "Networking essay — bedah dari scholar",
    publisher: "Agriculture First (blog awardee)",
    scholarship: "chevening",
    kind: "esai",
    source: "awardee",
    lang: "en",
    href: "https://agriculturefirstblog.wordpress.com/2019/08/11/my-chevening-journey-networking-essay-tips/",
    description:
      "Lanjutan dari scholar yang sama: cara menjawab esai networking dengan contoh jaringan yang nyata, bukan sekadar 'aktif di medsos'.",
    verifiedAt: V,
  },

  // ── LPDP ─────────────────────────────────────────────────────────────
  {
    id: "lpdp-esai-maryam",
    title: "Esai lengkap: Kontribusiku Bagi Indonesia",
    publisher: "Maryam Qonita (blog awardee)",
    scholarship: "lpdp",
    kind: "esai",
    source: "awardee",
    lang: "id",
    href: "http://maryam-qonita.blogspot.com/2018/12/contoh-esai-lpdp-2018-saya.html",
    description:
      "Esai kontribusi utuh yang dipublikasikan penulisnya sendiri — esai yang membawanya sampai tahap wawancara LPDP.",
    verifiedAt: V,
  },
  {
    id: "lpdp-esai-yogi",
    title: "Esai lengkap: kontribusi di bidang pendidikan (ELT)",
    publisher: "Yogi Saputra Mahmud (blog awardee)",
    scholarship: "lpdp",
    kind: "esai",
    source: "awardee",
    lang: "id",
    href: "https://yogismblog.wordpress.com/2016/12/18/esai-lpdp-kontribusi-untuk-indonesia/",
    description:
      "Contoh esai kontribusi bertema pengajaran bahasa Inggris — bagus untuk melihat cara mengikat pengalaman mengajar ke rencana kontribusi.",
    verifiedAt: V,
  },
  {
    id: "lpdp-kontribusi-hub",
    title: "Kisah kontribusi para awardee LPDP",
    publisher: "LPDP Kemenkeu (resmi)",
    scholarship: "lpdp",
    kind: "cerita",
    source: "resmi",
    lang: "id",
    href: "https://lpdp.kemenkeu.go.id/awardee/kontribusi/",
    description:
      "Kumpulan kisah kontribusi awardee dari situs resmi LPDP — bahan riset untuk memahami 'kontribusi' seperti apa yang dihargai program.",
    verifiedAt: V,
  },

  // ── Australia Awards ─────────────────────────────────────────────────
  {
    id: "aas-faq",
    title: "FAQ aplikasi + supporting statement AAS",
    publisher: "Australia Awards Indonesia (resmi)",
    scholarship: "aas",
    kind: "panduan",
    source: "resmi",
    lang: "en",
    href: "https://www.australiaawardsindonesia.org/content/38/12/application-faqs?sub=true",
    description:
      "FAQ resmi — termasuk batas 2000 karakter per pertanyaan supporting statement dan aturan dokumen pendukung.",
    verifiedAt: V,
  },
  {
    id: "aas-tips-awardee",
    title: "Tips mengisi aplikasi AAI dari awardee PhD",
    publisher: "Meta Sri Kartika (blog awardee)",
    scholarship: "aas",
    kind: "cerita",
    source: "awardee",
    lang: "id",
    href: "https://metasrikartika.wordpress.com/2020/02/25/tips-mengisi-aplikasi-beasiswa-australia-awards-indonesia-tahun-2019/",
    description:
      "Awardee membedah tiap bagian formulir AAI — termasuk cara menjawab pertanyaan dampak studi ke karier dan komunitas.",
    verifiedAt: V,
  },

  // ── Fulbright ────────────────────────────────────────────────────────
  {
    id: "fulbright-aminef-tips",
    title: "Tips resmi AMINEF: Study Objectives & Personal Statement",
    publisher: "AMINEF (resmi)",
    scholarship: "fulbright",
    kind: "panduan",
    source: "resmi",
    lang: "id",
    href: "https://www.aminef.or.id/fulbright-masters-degree-cara-tips-penulisan-study-objectives-personal-statement-3-jan-2024/",
    description:
      "Sesi resmi AMINEF (video) tentang cara menulis dua esai Fulbright — aturan penting: jangan sebut universitas spesifik.",
    verifiedAt: V,
  },
  {
    id: "fulbright-so-vs-ps",
    title: "Study Objective vs Personal Statement — apa bedanya",
    publisher: "Iif Haniffa (blog awardee)",
    scholarship: "fulbright",
    kind: "esai",
    source: "awardee",
    lang: "en",
    href: "https://iifhaniffa.wordpress.com/2017/07/12/ups-and-downs-of-my-fulbright-journey-4-study-objective-vs-personal-statement/",
    description:
      "Awardee Indonesia menjelaskan pembagian isi dua esai Fulbright yang sering tertukar, dari pengalaman aplikasinya sendiri.",
    verifiedAt: V,
  },
  {
    id: "fulbright-ps-example",
    title: "Personal statement Fulbright + contoh dari awardee",
    publisher: "Adibah (Medium, awardee)",
    scholarship: "fulbright",
    kind: "esai",
    source: "awardee",
    lang: "en",
    href: "https://medium.com/@adibah.dib/how-to-win-the-fulbright-scholarship-series-2-f9bafb773b53",
    description:
      "Awardee membagikan pendekatan personal statement-nya lengkap dengan contoh yang berhasil.",
    verifiedAt: V,
  },

  // ── Umum (semua beasiswa/kampus) ─────────────────────────────────────
  {
    id: "owl-ps-examples",
    title: "Dua contoh personal statement utuh",
    publisher: "Purdue OWL (kampus)",
    scholarship: "umum",
    kind: "esai",
    source: "kampus",
    lang: "en",
    href: "https://owl.purdue.edu/owl/job_search_writing/preparing_an_application/writing_the_personal_statement/examples.html",
    description:
      "Dua personal statement lengkap dari writing center Purdue — contoh struktur yang bersih untuk aplikasi kampus.",
    verifiedAt: V,
  },
  {
    id: "owl-sop-guide",
    title: "Panduan lengkap statement of purpose",
    publisher: "Purdue OWL (kampus)",
    scholarship: "umum",
    kind: "panduan",
    source: "kampus",
    lang: "en",
    href: "https://owl.purdue.edu/owl/general_writing/graduate_school_applications/graduate_school_applications_statements_of_purpose/index.html",
    description:
      "Panduan SOP untuk pascasarjana dari writing center universitas — dari draft pertama sampai revisi akhir.",
    verifiedAt: V,
  },
];

export const ESSAY_SCHOLARSHIPS: EssayScholarship[] = ["chevening", "lpdp", "aas", "fulbright", "umum"];
