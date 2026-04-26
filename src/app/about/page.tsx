import type { Metadata } from "next";
import MarketingPage from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Tentang Kami — Satu Tuju",
  description:
    "Satu Tuju menghubungkan calon pemburu beasiswa dengan alumni penerima beasiswa di luar negeri. Mentorship 1-on-1, gratis, dan dipandu oleh pengalaman.",
};

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="Tentang Kami"
      title="Perjalanan beasiswa, dipandu oleh pengalaman."
      subtitle="Satu Tuju adalah jembatan antara calon pemburu beasiswa Indonesia dan alumni yang sudah pernah berdiri di posisi yang sama."
    >
      <p>
        Mendaftar beasiswa luar negeri itu rumit. Banyak informasi tersebar, banyak template
        yang tampak meyakinkan tapi kosong, banyak orang yang tidak tahu harus mulai dari
        mana. Padahal yang paling kamu butuhkan justru paling sederhana: seseorang yang
        sudah pernah melaluinya, mau duduk denganmu satu jam, dan menjawab pertanyaan
        sebenarnya.
      </p>

      <p>
        Kami membangun Satu Tuju untuk itu. Sebuah platform mentorship gratis, satu-lawan-satu,
        yang menghubungkan kamu dengan alumni penerima beasiswa di Cambridge, Edinburgh,
        Imperial, Melbourne, Sydney, Monash, Auckland, Warwick, dan TU Delft. Mentor kami
        bukan profesional konsultan — mereka adalah orang-orang yang baru saja melewati
        proses yang sedang kamu hadapi, dan masih ingat semua detilnya.
      </p>

      <h2>Misi kami</h2>

      <p>
        Akses ke beasiswa luar negeri sering kali ditentukan oleh siapa yang kamu kenal.
        Kami ingin mengubah itu. Dengan mentorship terbuka dan gratis, kami percaya
        peluang studi ke luar negeri bisa terjangkau bukan hanya untuk yang sudah punya
        koneksi — tapi untuk siapapun yang bersedia bekerja keras dan mencari bimbingan.
      </p>

      <h2>Bagaimana kami bekerja</h2>

      <ul>
        <li>
          <strong>Gratis selamanya untuk mentee.</strong> Mentor kami menyumbangkan waktunya
          secara sukarela. Kamu tidak akan pernah diminta membayar untuk sesi mentorship.
        </li>
        <li>
          <strong>Satu-lawan-satu, bukan kelas massal.</strong> Setiap sesi dirancang khusus
          untuk situasi dan target beasiswa kamu — bukan template yang sama untuk semua orang.
        </li>
        <li>
          <strong>Mentor yang relevan.</strong> Kami mencocokkanmu dengan alumni yang punya
          latar belakang dan jurusan yang dekat dengan target studimu, bukan sekadar siapa
          yang available.
        </li>
        <li>
          <strong>Dari dokumen hingga wawancara.</strong> Mentor membantu di setiap tahap:
          riset beasiswa, motivation letter, transkrip, surat rekomendasi, dan simulasi
          wawancara.
        </li>
      </ul>

      <h2>Mentor kami</h2>

      <p>
        Setiap mentor di Satu Tuju adalah penerima beasiswa aktif atau alumni dari universitas
        global terkemuka. Mereka pernah berada di posisi yang sama denganmu — mengisi formulir
        LPDP, menulis ulang esai untuk kelima kalinya, gugup di depan panel wawancara — dan
        sekarang ingin membantu yang berikutnya melewati jalur yang sama dengan lebih mudah.
      </p>

      <p>
        Kalau kamu sedang menyiapkan aplikasi beasiswamu, kami senang sekali bisa membantu.{" "}
        <a href="/signup" className="text-primary font-medium underline underline-offset-2">
          Daftar sekarang
        </a>{" "}
        — gratis, dan kami akan mencocokkanmu dengan mentor yang tepat dalam beberapa hari.
      </p>
    </MarketingPage>
  );
}
