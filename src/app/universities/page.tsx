import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import UniversityDirectory from "@/components/universities/UniversityDirectory";
import rawData from "@/data/universities.json";

export const metadata: Metadata = {
  title: "Daftar Universitas — Satu Tuju",
  description:
    "Telusuri universitas tujuan studi luar negeri yang bisa kamu jangkau bersama Satu Tuju — cari berdasarkan nama, negara, dan jenjang studi.",
  alternates: { canonical: "/universities" },
};

// Static directory; cache the rendered shell. The interactive list fetches
// from /api/public/universities on the client.
export const revalidate = 3600;

function uniqueCountries(): string[] {
  const set = new Set<string>();
  for (const u of rawData as Array<{ country: string }>) {
    if (u.country) set.add(u.country);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export default function UniversitiesPage() {
  const countries = uniqueCountries();

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <header className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted-2 mb-3">
            Daftar Universitas
          </p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-[1.1] font-[family-name:var(--font-heading)]">
            Universitas tujuan studimu, di satu tempat
          </h1>
          <p className="mt-4 text-base sm:text-lg text-text-muted leading-relaxed">
            Telusuri kampus luar negeri berdasarkan nama, negara, dan jenjang studi.
            Daftar ini terbuka untuk umum — bagikan tautannya ke siapa pun yang sedang
            mencari arah.
          </p>
        </header>

        <UniversityDirectory countries={countries} />
      </main>
      <Footer />
    </>
  );
}
