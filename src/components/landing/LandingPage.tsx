"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import StickyValueProps from "./StickyValueProps";
import MentorMarquee from "./MentorMarquee";
import HowItWorks from "./HowItWorks";
import CTABanner from "./CTABanner";
import Footer from "./Footer";

export default function LandingPage() {
  return (
    <div className="force-light min-h-screen">
      <Navbar />
      <main>
        <HeroSection />
        <MentorMarquee />
        <StickyValueProps />
        <HowItWorks />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
