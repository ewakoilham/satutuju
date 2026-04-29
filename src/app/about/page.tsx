import type { Metadata } from "next";
import Image from "next/image";
import MarketingPage from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Tentang Kami — Satu Tuju",
  description:
    "Satu Tuju menghubungkan pelajar Indonesia yang sedang mengejar beasiswa dengan alumni yang sudah pernah berdiri di posisi yang sama. Mentorship 1-on-1, gratis, dipandu oleh pengalaman.",
};

export default function AboutPage() {
  return (
    <MarketingPage
      eyebrow="Tentang Kami"
      title="Kami pernah di posisi kamu. Makanya kami bangun ini, supaya kamu nggak sendirian."
      subtitle="Satu Tuju menghubungkan pelajar Indonesia yang sedang mengejar beasiswa dengan alumni yang sudah pernah berdiri di posisi yang sama."
    >
      {/* Banner — full Canva slide of the founders, sits at the very top of the body */}
      <div className="relative aspect-[16/9] mb-10 rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] border border-border/60">
        <Image
          src="/founders-banner.jpg"
          alt="Tim pendiri Satu Tuju — Venzo Zufar, Ilham Razak, Inggrita Putri"
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          quality={92}
          className="object-cover"
          priority
        />
      </div>

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
        bukan konsultan profesional — mereka adalah orang-orang yang baru saja melewati
        proses yang sedang kamu hadapi, dan masih ingat semua detailnya.
      </p>

      <h2>Cerita kami</h2>

      <p>
        Razak tumbuh di Polewali Mandar, Sulawesi Barat — daerah di mana &ldquo;beasiswa luar
        negeri&rdquo; jarang sekali diucapkan, apalagi diketahui jalannya. Dia empat kali
        menerima beasiswa penuh, tapi setiap kali harus mulai dari nol: mencari informasi
        sendiri, mengetuk pintu yang tidak selalu terbuka, menebak-nebak apa yang panel
        wawancara sebenarnya cari. Setelah beberapa tahun mentoring pelajar Indonesia yang
        sedang mengejar studi ke luar negeri, dia sadar satu hal sederhana — yang paling
        membantu mereka bukan template canggih atau paket mahal, tapi seseorang yang baru
        saja melewati proses yang sama dan mau duduk satu jam mendengarkan.
      </p>

      <p>
        Venzo dan Inggrita berkenalan di Teknik Industri ITS dan sejak itu sudah membangun
        banyak hal bersama, dari Yeobo Space hingga Hangbocake. Venzo, penerima LPDP dan
        lulusan Master of Business di bidang entrepreneurship tahun 2025, percaya setiap
        orang berhak punya kesempatan sebaik-baiknya untuk berkembang. Inggrita, yang
        dibesarkan dengan beasiswa sejak SD hingga SMA, paham betul bagaimana satu pintu
        yang terbuka bisa mengubah seluruh arah hidup seseorang — dan pegangan hidupnya
        sederhana: sebaik-baiknya manusia adalah yang bermanfaat. Keduanya punya satu
        keyakinan yang sama: beasiswa jarang jatuh ke tangan yang paling pintar, lebih
        sering ke tangan yang paling banyak akses ke informasi dan persiapan. Di Satu Tuju,
        Venzo memimpin operasi sebagai COO dan Inggrita memimpin pertumbuhan sebagai CMO —
        meneruskan kebiasaan membangun sesuatu bersama, kali ini untuk hal yang lebih besar
        dari mereka berdua.
      </p>

      <p>
        Tiga jalur yang berbeda, tapi membawa kami ke satu kesimpulan yang sama: peluang
        studi ke luar negeri seharusnya tidak ditentukan oleh seberapa banyak privilege yang
        kamu punya, tapi seberapa mau kamu berusaha untuk mencapainya.
      </p>

      <h2>Misi kami</h2>

      <p>
        Setiap pelajar Indonesia yang berhasil sekolah di luar negeri tidak hanya pulang
        dengan gelar — dia pulang dengan pengalaman, jaringan, dan cara berpikir baru yang
        ikut dirasakan orang-orang di sekitarnya. Satu orang yang sampai ke sana, kalau
        benar-benar pulang, bisa membuka pintu untuk lima orang berikutnya. Misi kami
        sederhana: memperluas siapa yang berkesempatan untuk sampai ke titik itu.
      </p>

      <h2>Bagaimana kami bekerja</h2>

      <ul>
        <li>
          <strong>Gratis dengan deposit komitmen.</strong> Mentor kami menyumbangkan waktunya
          secara sukarela — kamu tidak membayar untuk sesi mentorship. Yang kami minta hanya
          deposit komitmen Rp 1 juta yang akan dikembalikan setelah hasil aplikasi
          beasiswamu keluar, diterima maupun ditolak. Deposit ini bukan biaya layanan; ini
          cara kami memastikan waktu mentor tidak habis untuk yang setengah hati.
        </li>
        <li>
          <strong>1-on-1 yang personal, bukan kelas.</strong> Setiap sesi dirancang khusus
          untuk situasi dan target beasiswa kamu — bukan template yang sama untuk semua
          orang.
        </li>
        <li>
          <strong>Mentor yang relevan.</strong> Kami mencocokkanmu dengan alumni yang latar
          belakang dan jurusannya dekat dengan target studimu, bukan sekadar siapa yang
          kebetulan senggang.
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
