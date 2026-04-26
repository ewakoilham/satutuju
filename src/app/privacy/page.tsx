import type { Metadata } from "next";
import MarketingPage from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Satu Tuju",
  description: "Bagaimana Satu Tuju mengumpulkan, menggunakan, dan melindungi data pribadi pengguna.",
};

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Kebijakan Privasi"
      title="Kebijakan Privasi."
      subtitle="Berlaku efektif 27 April 2026."
    >
      <p>
        Kebijakan Privasi ini menjelaskan bagaimana Satu Tuju (&ldquo;kami&rdquo;) mengumpulkan,
        menggunakan, dan melindungi informasi pribadi pengguna (&ldquo;kamu&rdquo;) ketika
        menggunakan platform mentorship kami melalui satutuju.id (&ldquo;Layanan&rdquo;). Dengan
        menggunakan Layanan, kamu menyetujui praktik yang dijelaskan di sini.
      </p>

      <h2>1. Informasi yang kami kumpulkan</h2>

      <p>Kami mengumpulkan informasi berikut hanya jika kamu memberikannya kepada kami:</p>

      <ul>
        <li>
          <strong>Data akun:</strong> nama lengkap, alamat email, dan password (di-hash). Jika
          kamu masuk lewat Google, kami menerima nama, email, dan foto profil dari Google.
        </li>
        <li>
          <strong>Data profil mentee/mentor:</strong> kota asal, latar belakang pendidikan,
          target universitas, jenis beasiswa, jurusan, dan informasi lain yang kamu isi di
          formulir onboarding agar kami bisa mencocokkanmu dengan mentor yang tepat.
        </li>
        <li>
          <strong>Data sesi mentorship:</strong> jadwal sesi, catatan tindak lanjut, dan
          dokumen yang kamu unggah untuk direview oleh mentor.
        </li>
        <li>
          <strong>Data komunikasi:</strong> isi pesan yang kamu kirim ke kami via email atau
          formulir kontak.
        </li>
        <li>
          <strong>Data teknis:</strong> alamat IP, jenis browser, dan log akses untuk keamanan
          sistem.
        </li>
      </ul>

      <h2>2. Bagaimana kami menggunakan informasi</h2>

      <p>Kami menggunakan informasimu hanya untuk:</p>

      <ul>
        <li>Mencocokkanmu dengan mentor yang relevan;</li>
        <li>Memfasilitasi sesi mentorship dan koordinasi jadwal;</li>
        <li>Mengirim email transaksional (konfirmasi pendaftaran, reset password, pengingat sesi);</li>
        <li>Memenuhi kewajiban hukum jika diperlukan.</li>
      </ul>

      <p>
        Kami <strong>tidak akan</strong> menjual data pribadimu kepada pihak ketiga, dan kami
        <strong> tidak menggunakan datamu untuk iklan</strong>.
      </p>

      <h2>3. Layanan pihak ketiga yang kami gunakan</h2>

      <p>
        Untuk menjalankan Layanan, kami bekerja sama dengan beberapa penyedia infrastruktur
        terpercaya. Mereka hanya memproses data pribadimu sesuai instruksi kami:
      </p>

      <ul>
        <li>
          <strong>Vercel</strong> — hosting aplikasi web. Memproses log akses dan trafik HTTP.
        </li>
        <li>
          <strong>Supabase</strong> — penyimpanan basis data dan file. Lokasi server: Asia
          Pasifik.
        </li>
        <li>
          <strong>Google (OAuth + Calendar)</strong> — autentikasi akun dan integrasi kalender
          untuk sesi mentorship.
        </li>
        <li>
          <strong>Resend</strong> — pengiriman email transaksional.
        </li>
      </ul>

      <h2>4. Cookies</h2>

      <p>
        Kami menggunakan cookies hanya untuk hal yang esensial: menjaga sesi login kamu dan
        preferensi tampilan (misalnya tema dark/light). Kami tidak menggunakan cookies pelacak
        pihak ketiga atau cookies iklan.
      </p>

      <h2>5. Penyimpanan dan keamanan data</h2>

      <p>
        Data pribadi kamu disimpan di server Supabase dengan enkripsi at-rest. Password
        disimpan dalam bentuk hash (bcrypt) — kami tidak pernah bisa melihat password aslimu.
        Komunikasi antara browser kamu dan server kami dilindungi HTTPS (TLS).
      </p>

      <h2>6. Hak kamu (sesuai UU PDP No. 27/2022)</h2>

      <p>Sebagai pemilik data pribadi, kamu berhak untuk:</p>

      <ul>
        <li>Mengakses informasi pribadi yang kami simpan tentang kamu;</li>
        <li>Memperbaiki atau memperbarui data yang tidak akurat;</li>
        <li>Meminta penghapusan data pribadi (right to be forgotten);</li>
        <li>Menarik persetujuan kapan saja;</li>
        <li>Mengajukan keluhan ke otoritas yang berwenang.</li>
      </ul>

      <p>
        Untuk menjalankan hak-hak ini, hubungi kami di{" "}
        <a href="mailto:hello@satutuju.id" className="text-primary underline underline-offset-2">
          hello@satutuju.id
        </a>
        . Kami akan merespons dalam 14 hari kerja.
      </p>

      <h2>7. Retensi data</h2>

      <p>
        Kami menyimpan data pribadimu selama akunmu aktif. Jika kamu menghapus akun, data
        pribadi akan dihapus dalam 30 hari, kecuali ada kewajiban hukum yang mengharuskan kami
        menyimpannya lebih lama.
      </p>

      <h2>8. Anak di bawah umur</h2>

      <p>
        Layanan kami tidak ditujukan untuk anak di bawah usia 17 tahun. Kami tidak secara sengaja
        mengumpulkan data dari anak di bawah umur tersebut. Jika kamu yakin anak di bawah umur
        telah memberikan data pribadi kepada kami, hubungi kami untuk dihapus.
      </p>

      <h2>9. Perubahan Kebijakan Privasi</h2>

      <p>
        Kami dapat memperbarui Kebijakan Privasi ini sewaktu-waktu. Perubahan akan dipublikasikan
        di halaman ini dengan tanggal efektif baru. Untuk perubahan substansial, kami akan
        memberi tahu pengguna terdaftar via email.
      </p>

      <h2>10. Hubungi kami</h2>

      <p>
        Pertanyaan, keluhan, atau permintaan terkait data pribadi:
        <br />
        <a href="mailto:hello@satutuju.id" className="text-primary underline underline-offset-2">
          hello@satutuju.id
        </a>
      </p>
    </MarketingPage>
  );
}
