import Link from "next/link";
import Logo from "@/components/ui/Logo";

function PuzzlePieceSVG({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className}>
      <path
        d="M50 10a10 10 0 0120 0v8a4 4 0 004 4h24a8 8 0 018 8v24a4 4 0 01-4 4 10 10 0 000 20 4 4 0 014 4v24a8 8 0 01-8 8H74a4 4 0 01-4-4 10 10 0 00-20 0 4 4 0 01-4 4H22a8 8 0 01-8-8V82a4 4 0 00-4-4 10 10 0 010-20 4 4 0 004-4V30a8 8 0 018-8h24a4 4 0 004-4V10z"
        fill="currentColor"
        opacity="0.12"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo variant="main" size="sm" />
            <div className="flex items-center gap-3">
              <Link href="/login" className="btn-ghost text-sm font-medium">
                Sign In
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-soft/40 via-white to-brand-lavender/20" />
        <div className="absolute top-20 right-10 text-primary">
          <PuzzlePieceSVG className="w-64 h-64 sm:w-96 sm:h-96" />
        </div>
        <div className="absolute bottom-10 left-5 text-brand-yellow">
          <PuzzlePieceSVG className="w-32 h-32 rotate-45" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-brand-yellow/60 text-primary-800 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Free 1-on-1 Mentoring
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight font-[family-name:var(--font-heading)]">
              Your study abroad journey,{" "}
              <span className="text-primary">guided by experience</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-500 leading-relaxed max-w-xl">
              Connecting mentors who have studied abroad with those who dream of
              doing the same. A structured 10-session program designed to shape your path.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
              <Link href="/signup" className="btn-primary text-base px-8 py-3.5 rounded-xl">
                Start Your Journey
              </Link>
              <Link href="/login" className="btn-secondary text-base px-8 py-3.5 rounded-xl">
                I Have an Account
              </Link>
            </div>

            {/* Mini stats */}
            <div className="flex items-center gap-6 sm:gap-10 mt-12 pt-8 border-t border-border">
              {[
                { value: "10", label: "Guided Sessions" },
                { value: "1:1", label: "Personal Mentoring" },
                { value: "Free", label: "Always" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl sm:text-3xl font-bold text-primary font-[family-name:var(--font-heading)]">
                    {stat.value}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Three simple steps to get started
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: "01",
                icon: "user",
                title: "Create Your Profile",
                desc: "Sign up as a mentee and tell us about your study abroad goals, preferred destinations, and academic interests.",
                color: "bg-brand-blue-soft",
              },
              {
                step: "02",
                icon: "puzzle",
                title: "Get Matched",
                desc: "We pair you with a mentor who has studied abroad and can guide your application journey based on real experience.",
                color: "bg-brand-lavender",
              },
              {
                step: "03",
                icon: "map",
                title: "Follow Your Journey",
                desc: "Work through 10 structured sessions covering discovery, planning, applications, and preparation for departure.",
                color: "bg-brand-yellow",
              },
            ].map((item) => (
              <div key={item.step} className="card-hover group">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-primary/30 font-[family-name:var(--font-heading)]">
                    {item.step}
                  </span>
                  <div className={`${item.color} rounded-xl p-2.5`}>
                    <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                      <path d={
                        item.icon === "user" ? "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" :
                        item.icon === "puzzle" ? "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a2 2 0 012 2v3a1 1 0 01-1 1 2 2 0 100 4 1 1 0 011 1v3a2 2 0 01-2 2h-3a1 1 0 01-1-1 2 2 0 10-4 0 1 1 0 01-1 1H7a2 2 0 01-2-2v-3a1 1 0 00-1-1 2 2 0 110-4 1 1 0 001-1V8a2 2 0 012-2h3a1 1 0 001-1V4z" :
                        "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      } />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 font-[family-name:var(--font-heading)]">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-background to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-[family-name:var(--font-heading)]">
              Everything you need to succeed
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: "book",
                title: "Structured Curriculum",
                desc: "10 sessions across 5 phases — from self-discovery to departure preparation. Every step is guided.",
                bg: "bg-brand-blue-soft/50",
              },
              {
                icon: "document",
                title: "Document Tracking",
                desc: "Upload, track, and get feedback on CVs, motivation letters, transcripts, and recommendation letters.",
                bg: "bg-brand-lavender/50",
              },
              {
                icon: "globe",
                title: "University Directory",
                desc: "Explore partner universities worldwide. Filter by region, country, degree level, and program of interest.",
                bg: "bg-brand-yellow/50",
              },
              {
                icon: "chart",
                title: "Progress Dashboard",
                desc: "Track your journey progress, upcoming sessions, pending tasks, and document status all in one place.",
                bg: "bg-primary-50",
              },
            ].map((f) => (
              <div key={f.title} className={`card-hover ${f.bg} border-transparent`}>
                <div className="flex items-start gap-4">
                  <div className="bg-white rounded-xl p-2.5 shadow-[var(--shadow-xs)]">
                    <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                      <path d={
                        f.icon === "book" ? "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" :
                        f.icon === "document" ? "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" :
                        f.icon === "globe" ? "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" :
                        "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      } />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1 font-[family-name:var(--font-heading)]">
                      {f.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative bg-gradient-to-br from-primary to-primary-deep rounded-3xl px-8 sm:px-16 py-14 sm:py-20 text-center overflow-hidden">
            {/* Decorative puzzle pieces */}
            <div className="absolute top-4 left-4 text-white/10">
              <PuzzlePieceSVG className="w-40 h-40" />
            </div>
            <div className="absolute bottom-4 right-4 text-white/10 rotate-180">
              <PuzzlePieceSVG className="w-32 h-32" />
            </div>

            <div className="relative">
              <p className="text-brand-yellow font-medium text-sm mb-4 tracking-wider uppercase">
                Our Philosophy
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-[family-name:var(--font-heading)]">
                We shape the puzzle piece, not place it.
              </h2>
              <p className="text-primary-200 text-lg max-w-xl mx-auto mb-8">
                Your journey is unique. We help you discover, prepare, and grow — so you can find where you truly belong.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-primary px-8 py-3.5 rounded-xl font-semibold hover:bg-brand-yellow hover:text-primary-800 transition-all shadow-[var(--shadow-md)]">
                Begin Your Journey
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo variant="circle" size="sm" />
            <span className="text-sm text-gray-400">
              satutuju &middot; free 101 mentoring
            </span>
          </div>
          <p className="text-xs text-gray-300">&copy; 2026 Satu Tuju. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
