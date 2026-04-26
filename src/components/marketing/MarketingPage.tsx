import type { ReactNode } from "react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

interface MarketingPageProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function MarketingPage({ eyebrow, title, subtitle, children }: MarketingPageProps) {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20">
        <header className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted-2 mb-3">
              {eyebrow}
            </p>
          )}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-[1.1] font-[family-name:var(--font-heading)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-base sm:text-lg text-text-muted leading-relaxed">
              {subtitle}
            </p>
          )}
        </header>

        <article
          className={[
            "max-w-3xl mx-auto px-4 sm:px-6 lg:px-8",
            "[&_p]:text-[0.98rem] [&_p]:leading-[1.7] [&_p]:text-foreground [&_p]:mb-4",
            "[&_h2]:font-[family-name:var(--font-heading)] [&_h2]:font-bold [&_h2]:text-[1.4rem] [&_h2]:text-foreground [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:leading-tight",
            "[&_h3]:font-[family-name:var(--font-heading)] [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:text-foreground [&_h3]:mt-8 [&_h3]:mb-3",
            "[&_ul]:my-5 [&_ul]:space-y-2 [&_ul]:pl-5",
            "[&_ul_li]:relative [&_ul_li]:pl-1 [&_ul_li]:text-[0.98rem] [&_ul_li]:leading-[1.65] [&_ul_li]:text-foreground [&_ul_li]:list-disc [&_ul_li]:marker:text-primary",
            "[&_strong]:font-semibold [&_strong]:text-foreground",
            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary-700",
          ].join(" ")}
        >
          {children}
        </article>
      </main>
      <Footer />
    </>
  );
}
