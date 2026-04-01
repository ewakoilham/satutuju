import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
      <div className="text-center max-w-lg">
        <h1 className="text-5xl font-bold text-[var(--primary)] mb-2">
          SATU TUJU
        </h1>
        <p className="text-lg text-gray-500 mb-2">Mentorship Platform</p>
        <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
          Connecting mentors who have studied abroad with those who dream of
          doing the same. Your journey, guided by experience.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="bg-[var(--primary)] text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition text-sm"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="border border-[var(--primary)] text-[var(--primary)] px-6 py-2.5 rounded-lg font-medium hover:bg-[var(--primary-light)] transition text-sm"
          >
            Create Account
          </Link>
        </div>
      </div>
      <p className="absolute bottom-8 text-xs text-gray-300">
        Satu Tuju &middot; We shape the puzzle piece, not place it.
      </p>
    </div>
  );
}
