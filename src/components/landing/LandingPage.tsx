"use client";

import { LanguageProvider } from "@/lib/i18n";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import StickyValueProps from "./StickyValueProps";
import MentorMarquee from "./MentorMarquee";
import HowItWorks from "./HowItWorks";
import CTABanner from "./CTABanner";
import Footer from "./Footer";

export default function LandingPage() {
  return (
    <LanguageProvider defaultLang="id">
      <div className="force-light min-h-screen">
        <Navbar />
        <main>
          <HeroSection />
          <StickyValueProps />
          <MentorMarquee />
          <HowItWorks />
          <CTABanner />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
