import type { Metadata } from "next";
import MarketingPage from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "FAQ — Satu Tuju",
  description: "Pertanyaan umum tentang program mentorship beasiswa Satu Tuju.",
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Apakah Satu Tuju benar-benar gratis?",
    a: "Iya. Mentor kami menyumbangkan waktunya secara sukarela. Kamu tidak akan diminta membayar untuk sesi mentorship, baik di awal, di tengah, maupun di akhir. Tidak ada paket berbayar, tidak ada upgrade.",
  },
  {
    q: "Siapa yang bisa mendaftar sebagai mentee?",
    a: "Siapapun warga negara Indonesia yang sedang menyiapkan aplikasi beasiswa S2 atau S3 ke luar negeri. Kami tidak punya batasan umur, almamater, atau IPK minimum — yang penting kamu serius dan punya target yang konkret.",
  },
  {
    q: "Bagaimana cara mentor dicocokkan dengan saya?",
    a: "Setelah kamu mendaftar, tim kami melihat target universitas, jurusan, dan jenis beasiswa yang kamu incar, lalu mencocokkanmu dengan mentor yang punya latar belakang paling dekat. Kalau cocoknya pas, kamu akan dapat email dalam beberapa hari.",
  },
  {
    q: "Berapa lama dan berapa kali sesi mentorshipnya?",
    a: "Setiap sesi sekitar 45–60 menit. Jumlah sesi fleksibel — biasanya 3–6 sesi yang tersebar di sepanjang persiapan aplikasi kamu. Mentor dan mentee mengatur sendiri jadwalnya.",
  },
  {
    q: "Sesi mentoring online atau offline?",
    a: "Online — biasanya lewat Google Meet. Mentor kami tersebar di banyak negara, jadi format online lebih praktis. Tidak butuh aplikasi tambahan apapun.",
  },
  {
    q: "Apa saja yang bisa saya minta bantuan ke mentor?",
    a: "Riset beasiswa yang cocok dengan profilmu, review dokumen (CV, motivation letter, study plan, research proposal), simulasi wawancara, strategi narasi diri, dan pertanyaan apapun seputar pengalaman kuliah di luar negeri. Mentor kami bukan jasa edit dokumen — mereka memberi feedback dan arahan, sisanya tetap kamu yang menulis.",
  },
  {
    q: "Beasiswa apa saja yang dicover mentor?",
    a: "Saat ini fokus kami di LPDP, dengan beberapa mentor juga punya pengalaman di Departmental Scholarships kampus tujuan. Tapi prinsip mentorship kami — riset, dokumen, esai, wawancara — berlaku untuk hampir semua beasiswa S2/S3.",
  },
  {
    q: "Saya sudah pernah ditolak beasiswa. Apakah masih bisa daftar?",
    a: "Sangat bisa. Justru banyak mentor kami yang sebelumnya pernah ditolak sebelum akhirnya lolos. Pengalaman gagal adalah modal yang berharga — mentor kami akan membantumu memahami apa yang mungkin perlu diperbaiki.",
  },
  {
    q: "Apakah mentor menjamin saya akan diterima?",
    a: "Tidak. Mentor membantu memaksimalkan persiapan kamu, tapi keputusan akhir tetap di tangan komite beasiswa. Yang kami janjikan adalah kamu akan mengirimkan aplikasi yang jauh lebih kuat dari yang bisa kamu siapkan sendiri.",
  },
  {
    q: "Bagaimana cara saya menjadi mentor?",
    a: "Kalau kamu adalah penerima beasiswa luar negeri yang sedang atau sudah selesai studi, kami sangat senang kalau kamu mau bergabung. Kirim email ke hello@satutuju.id dengan info singkat tentang program studi dan beasiswamu, dan tim kami akan menghubungi kamu kembali.",
  },
  {
    q: "Bagaimana data pribadi saya digunakan?",
    a: 'Hanya untuk menjalankan program mentorship — mencocokkan kamu dengan mentor, koordinasi jadwal, dan komunikasi seputar progress aplikasimu. Detail lengkap ada di halaman Kebijakan Privasi.',
  },
];

export default function FaqPage() {
  return (
    <MarketingPage
      eyebrow="FAQ"
      title="Pertanyaan yang sering ditanyakan."
      subtitle="Jawaban singkat untuk hal-hal yang biasanya kamu pikirkan sebelum mendaftar."
    >
      <div className="not-prose space-y-3">
        {FAQS.map((item, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-border/70 bg-white px-5 py-4 hover:border-primary-200 transition-colors"
          >
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-foreground font-[family-name:var(--font-heading)]">
              {item.q}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-text-muted group-open:rotate-45 transition-transform">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-text-muted leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-text-muted">
        Belum ketemu jawabannya?{" "}
        <a
          href="mailto:hello@satutuju.id"
          className="text-primary font-medium underline underline-offset-2"
        >
          hello@satutuju.id
        </a>
      </p>
    </MarketingPage>
  );
}
