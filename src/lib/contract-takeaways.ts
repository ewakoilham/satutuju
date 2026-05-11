/**
 * Mentor-actionable highlights per pasal, surfaced in the "Poin Penting"
 * side panel of the contract reader. Version-locked alongside
 * `CONTRACT_VERSION` — sweep this file whenever the template body
 * changes (the changelog flow prompts a code review on each bump).
 *
 * Boilerplate pasals (force majeure, dispute resolution, severability)
 * carry `flavour: "informational"` instead of bullets so the panel can
 * surface a brief "tidak ada poin tindakan khusus" stub rather than
 * left-padding with low-signal content.
 */

import type { ContractTocEntry } from "@/components/contract/ContractTOC";

export type ContractTakeaway = {
  /** Matches the H2 PASAL anchor id (e.g. "pasal-3"). */
  anchorId: string;
  /** Display label, e.g. "Pasal 3 — Ruang Lingkup Kemitraan". */
  pasalLabel: string;
  /** Suppresses bullets and shows a short note instead. */
  flavour?: "informational";
  /** 1–4 action-oriented sentences in Indonesian. */
  bullets?: string[];
};

export const CONTRACT_TAKEAWAYS: ContractTakeaway[] = [
  {
    anchorId: "pasal-1",
    pasalLabel: "Pasal 1 — Latar Belakang",
    flavour: "informational",
  },
  {
    anchorId: "pasal-2",
    pasalLabel: "Pasal 2 — Definisi",
    flavour: "informational",
  },
  {
    anchorId: "pasal-3",
    pasalLabel: "Pasal 3 — Ruang Lingkup Kemitraan",
    bullets: [
      "Anda mengantar 10 sesi mentoring per mentee dalam jangka waktu maksimum 12 bulan.",
      "Submission aplikasi ke kampus BUKAN tugas mentor — itu ditangani Tim Admission Satu Tuju.",
      "Anda dilarang menerima pembayaran finansial langsung dari mentee.",
      "Komitmen waktu indikatif: 3–6 jam/minggu/mentee.",
    ],
  },
  {
    anchorId: "pasal-4",
    pasalLabel: "Pasal 4 — Hak Mentor",
    bullets: [
      "Anda berhak menerima profil lengkap mentee sebelum matching dikonfirmasi.",
      "Anda boleh menolak alokasi mentee yang tidak sesuai bidang — tanpa beban.",
      "Anda berhak mengajukan realokasi mentee jika hubungan tidak konstruktif.",
      "Anda boleh menggunakan gelar 'Mentor Satu Tuju' + logo di profil profesional selama Perjanjian berlaku.",
    ],
  },
  {
    anchorId: "pasal-5",
    pasalLabel: "Pasal 5 — Kewajiban Mentor",
    bullets: [
      "Semua 10 sesi WAJIB direkam via tl;dv — bukan opsional.",
      "Isi session log paling lambat 3 hari kerja setelah sesi.",
      "Respons komunikasi mentee dalam 2×24 jam pada hari kerja.",
      "Larangan menerima bayaran langsung dari mentee tetap berlaku tanpa pengecualian.",
    ],
  },
  {
    anchorId: "pasal-6",
    pasalLabel: "Pasal 6 — Anti-Pelecehan Seksual",
    bullets: [
      "Zero tolerance. Satu kali pelanggaran terbukti = Strike 3 (pemutusan permanen).",
      "Dilarang menginisiasi hubungan romantis/seksual dengan mentee. Jika ada ketertarikan personal yang berkembang, wajib disclosure + ajukan realokasi.",
      "Laporkan dugaan pelecehan (Anda sebagai saksi atau korban) ke report@satutuju.id — bisa anonim, tanpa kedaluwarsa.",
      "Anti-retaliasi: korban yang lapor dengan iktikad baik tidak akan kena konsekuensi negatif.",
    ],
  },
  {
    anchorId: "pasal-7",
    pasalLabel: "Pasal 7 — Kerahasiaan & Data Pribadi",
    bullets: [
      "Data mentee + rekaman tl;dv adalah milik Satu Tuju. Dilarang download/simpan di perangkat pribadi tanpa kebutuhan operasional.",
      "Tidak boleh share kasus mentee spesifik di publik (podcast/medsos) tanpa izin tertulis dari mentee.",
      "Lapor data breach atau pengungkapan tidak sengaja dalam 24 jam.",
      "Kewajiban kerahasiaan TANPA BATAS WAKTU untuk data pribadi mentee, 5 tahun untuk info bisnis.",
    ],
  },
  {
    anchorId: "pasal-8",
    pasalLabel: "Pasal 8 — Success Fee",
    bullets: [
      "Success Fee dibayar HANYA setelah mentee mencapai status Enrollment (terdaftar + memulai program), bukan saat LoA atau acceptance.",
      "Tarif tergantung universitas + program (lihat Lampiran B), dibayar bruto — pajak tanggung jawab mentor sendiri.",
      "Pembayaran paling lambat 30 hari kerja setelah semua syarat terpenuhi + Satu Tuju menerima komisi dari kampus/agensi.",
      "Jika mentee mundur sebelum Enrollment: mentor tetap berhak 80% dari deposit hangus mentee.",
    ],
  },
  {
    anchorId: "pasal-9",
    pasalLabel: "Pasal 9 — Sistem Strike",
    bullets: [
      "Strike 1+2 ringan, Strike 3 = pemutusan permanen. Pelanggaran Berat bisa langsung Strike 3.",
      "Mentor berhak klarifikasi tertulis (7 hari kerja) sebelum Strike ditetapkan.",
      "Strike 1 & 2 kedaluwarsa setelah 12 bulan tanpa pelanggaran baru.",
      "Pelanggaran integritas (kerahasiaan, ambil bayaran mentee, diskriminasi) → Strike 3 langsung, kehilangan Success Fee pipeline.",
    ],
  },
  {
    anchorId: "pasal-10",
    pasalLabel: "Pasal 10 — Cuti & Pengunduran Diri",
    bullets: [
      "Cuti: pemberitahuan 14 hari kerja sebelumnya. Selama cuti, tetap tanggung jawab atas mentee aktif kecuali disepakati lain.",
      "Pengunduran diri: pemberitahuan 30 hari kalender. Mentor wajib transition mentee aktif ke mentor pengganti.",
      "Success Fee tetap dibayar untuk mentee yang Enrollment-nya tercapai SEBELUM tanggal efektif pengunduran diri.",
    ],
  },
  {
    anchorId: "pasal-11",
    pasalLabel: "Pasal 11 — Hak Kekayaan Intelektual",
    bullets: [
      "Pengalaman + insight pribadi tetap milik mentor — boleh dipakai di luar Satu Tuju.",
      "Tapi kurikulum, toolkit, template, dan materi training Satu Tuju TIDAK boleh dipakai di luar kemitraan ini tanpa izin tertulis.",
      "Satu Tuju boleh pakai nama + foto + profil mentor untuk marketing SELAMA perjanjian berlaku. Setelah berakhir, ditarik dalam waktu wajar.",
    ],
  },
  {
    anchorId: "pasal-12",
    pasalLabel: "Pasal 12 — Force Majeure",
    flavour: "informational",
  },
  {
    anchorId: "pasal-13",
    pasalLabel: "Pasal 13 — Penyelesaian Sengketa",
    flavour: "informational",
  },
  {
    anchorId: "pasal-14",
    pasalLabel: "Pasal 14 — Ketentuan Penutup",
    flavour: "informational",
  },
];

const BY_ID = new Map(CONTRACT_TAKEAWAYS.map((t) => [t.anchorId, t]));

/**
 * Find the takeaway entry that owns the section the reader is currently
 * looking at. Walks back through the rendered TOC entries from `activeId`
 * until it hits the nearest H2 "Pasal …" heading, then looks up that
 * pasal's anchor in CONTRACT_TAKEAWAYS. Returns `null` when the reader
 * is above the first pasal (intro pages) or when activeId is missing.
 */
export function findPasalTakeaway(
  activeId: string | null,
  entries: ContractTocEntry[],
): ContractTakeaway | null {
  if (!activeId) return null;
  const idx = entries.findIndex((e) => e.id === activeId);
  if (idx === -1) return null;
  for (let i = idx; i >= 0; i--) {
    const e = entries[i];
    if (e.depth === 2 && /^Pasal\s/i.test(e.text)) {
      return BY_ID.get(e.id) ?? null;
    }
  }
  return null;
}
