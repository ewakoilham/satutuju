import type { Metadata } from "next";
import MarketingPage from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — Satu Tuju",
  description: "Syarat dan ketentuan penggunaan platform mentorship Satu Tuju.",
};

export default function TermsPage() {
  return (
    <MarketingPage
      eyebrow="Syarat & Ketentuan"
      title="Syarat & Ketentuan."
      subtitle="Berlaku efektif 27 April 2026."
    >
      <p>
        Dengan menggunakan platform Satu Tuju (&ldquo;Layanan&rdquo;) di satutuju.id, kamu
        menyetujui Syarat dan Ketentuan ini. Mohon baca dengan saksama. Jika kamu tidak setuju
        dengan salah satu poin di sini, mohon untuk tidak menggunakan Layanan.
      </p>

      <h2>1. Tentang Layanan</h2>

      <p>
        Satu Tuju adalah platform mentorship gratis yang menghubungkan calon pemburu beasiswa di
        Indonesia (&ldquo;mentee&rdquo;) dengan alumni penerima beasiswa luar negeri
        (&ldquo;mentor&rdquo;). Kami memfasilitasi proses pencocokan, koordinasi jadwal sesi, dan
        komunikasi antar-pengguna. Kami <strong>bukan</strong> agen pendidikan, konsultan
        beasiswa berbayar, atau perwakilan resmi dari universitas mana pun.
      </p>

      <h2>2. Pendaftaran akun</h2>

      <ul>
        <li>
          Kamu harus berusia minimal 17 tahun untuk mendaftar. Jika kurang dari itu, mohon dengan
          pendampingan orang tua atau wali.
        </li>
        <li>
          Kamu wajib memberikan informasi yang akurat dan lengkap saat pendaftaran. Memberikan
          informasi palsu adalah pelanggaran ketentuan ini.
        </li>
        <li>
          Kamu bertanggung jawab atas keamanan akunmu. Jaga kerahasiaan password dan jangan
          membagikan akses akun ke pihak lain.
        </li>
        <li>Satu pengguna hanya boleh memiliki satu akun aktif.</li>
      </ul>

      <h2>3. Layanan gratis</h2>

      <p>
        Layanan mentorship Satu Tuju gratis untuk mentee. Mentor berpartisipasi secara sukarela.
        Kami tidak meminta pembayaran apapun untuk akses ke mentor, sesi, atau fitur platform.
        Jika ada pihak yang mengaku-aku dari Satu Tuju dan meminta pembayaran, mohon laporkan
        ke{" "}
        <a href="mailto:hello@satutuju.id" className="text-primary underline underline-offset-2">
          hello@satutuju.id
        </a>
        .
      </p>

      <h2>4. Aturan penggunaan</h2>

      <p>Saat menggunakan Layanan, kamu setuju untuk:</p>

      <ul>
        <li>Bersikap profesional, sopan, dan menghormati mentor maupun mentee lain;</li>
        <li>Hadir tepat waktu di sesi mentorship yang sudah dijadwalkan;</li>
        <li>
          Membatalkan atau menjadwal ulang sesi minimal 24 jam sebelumnya jika ada keperluan
          mendadak;
        </li>
        <li>
          Menggunakan informasi dan saran dari mentor hanya untuk kepentingan persiapan
          aplikasimu sendiri;
        </li>
        <li>Tidak merekam atau menyebarkan sesi mentorship tanpa izin tertulis dari mentor;</li>
        <li>Tidak menghubungi mentor di luar konteks mentorship yang difasilitasi platform;</li>
        <li>
          Tidak menggunakan platform untuk hal-hal yang melanggar hukum, mengganggu pengguna
          lain, atau merusak reputasi pihak manapun.
        </li>
      </ul>

      <h2>5. Konten yang kamu unggah</h2>

      <p>
        Dokumen, esai, atau materi lain yang kamu unggah ke platform tetap menjadi milikmu. Kamu
        memberi izin kepada Satu Tuju untuk menyimpan dan menampilkan konten tersebut hanya
        sebatas yang diperlukan agar mentor bisa memberikan feedback. Kami tidak akan
        menggunakan kontenmu untuk tujuan lain.
      </p>

      <h2>6. Pencocokan mentor</h2>

      <p>
        Kami berusaha sebaik mungkin mencocokkan mentee dengan mentor yang relevan, tapi kami
        tidak menjamin ketersediaan mentor tertentu, durasi tunggu, atau hasil aplikasi
        beasiswa. Mentor adalah relawan dan berhak menolak atau menghentikan mentorship kapan
        saja dengan alasan yang wajar.
      </p>

      <h2>7. Tidak ada jaminan hasil</h2>

      <p>
        Mentorship membantu memaksimalkan persiapan aplikasi beasiswamu, tapi keputusan akhir
        sepenuhnya berada di tangan komite beasiswa atau universitas tujuan. Satu Tuju
        <strong> tidak menjamin</strong> kamu akan diterima di program beasiswa atau universitas
        manapun, dan tidak bertanggung jawab atas hasil aplikasimu.
      </p>

      <h2>8. Penangguhan dan penghentian akun</h2>

      <p>
        Kami berhak menangguhkan atau menghapus akunmu tanpa peringatan jika kamu melanggar
        Syarat dan Ketentuan ini, melakukan penipuan, atau berperilaku yang membahayakan
        pengguna lain. Kamu juga bisa menghapus akunmu kapan saja dengan menghubungi tim kami.
      </p>

      <h2>9. Batasan tanggung jawab</h2>

      <p>
        Sepanjang diizinkan oleh hukum yang berlaku, Satu Tuju, pendiri, dan pengelola platform
        tidak bertanggung jawab atas kerugian tidak langsung, kehilangan kesempatan, atau
        kerugian konsekuensial yang timbul dari penggunaan Layanan, termasuk hasil aplikasi
        beasiswa, kualitas saran mentor, atau ketidaksesuaian harapan.
      </p>

      <h2>10. Kekayaan intelektual</h2>

      <p>
        Logo, nama, desain antarmuka, ilustrasi, dan konten yang kami publikasikan di platform
        adalah milik Satu Tuju. Kamu tidak boleh menyalin atau menggunakannya untuk tujuan
        komersial tanpa izin tertulis.
      </p>

      <h2>11. Perubahan Syarat dan Ketentuan</h2>

      <p>
        Kami dapat memperbarui Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan
        dipublikasikan di halaman ini dengan tanggal efektif baru. Penggunaan Layanan setelah
        perubahan dianggap sebagai persetujuan terhadap versi yang diperbarui.
      </p>

      <h2>12. Hukum yang berlaku</h2>

      <p>
        Syarat dan Ketentuan ini tunduk pada hukum Republik Indonesia. Sengketa yang timbul akan
        diselesaikan secara musyawarah; jika tidak tercapai, akan diselesaikan melalui forum
        yang berwenang di Indonesia.
      </p>

      <h2>13. Hubungi kami</h2>

      <p>
        Pertanyaan tentang Syarat dan Ketentuan ini:
        <br />
        <a href="mailto:hello@satutuju.id" className="text-primary underline underline-offset-2">
          hello@satutuju.id
        </a>
      </p>
    </MarketingPage>
  );
}
