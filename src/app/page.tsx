import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-8 sm:px-6">
      <div className="text-center w-full max-w-sm sm:max-w-lg">
        <h1 className="text-3xl sm:text-5xl font-bold text-[var(--primary)] mb-2">
          SATU TUJU
        </h1>
        <p className="text-base sm:text-lg text-gray-500 mb-2">Mentorship Platform</p>
        <p className="text-sm text-gray-400 mb-8 leading-relaxed px-2 sm:px-0">
          Connecting mentors who have studied abroad with those who dream of
          doing the same. Your journey, guided by experience.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto bg-[var(--primary)] text-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition text-sm text-center"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto border border-[var(--primary)] text-[var(--primary)] px-8 py-3 rounded-lg font-medium hover:bg-[var(--primary-light)] transition text-sm text-center"
          >
            Create Account
          </Link>
        </div>
      </div>
      <p className="absolute bottom-8 text-xs text-gray-300 px-8 text-center">
        Satu Tuju &middot; We shape the puzzle piece, not place it.
      </p>
    </div>
  );
}
