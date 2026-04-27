"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import UniversityLogoMarquee from "./UniversityLogoMarquee";
import StickyValueProps from "./StickyValueProps";
import MentorMarquee from "./MentorMarquee";
import HowItWorks from "./HowItWorks";
import CTABanner from "./CTABanner";
import Footer from "./Footer";
import { PhotoEditProvider } from "@/lib/photo-edit-context";
import PhotoEditToolbar from "./PhotoEditToolbar";

export default function LandingPage() {
  return (
    <PhotoEditProvider>
      <div className="force-light min-h-screen">
        <Navbar />
        <main>
          <HeroSection />
          <UniversityLogoMarquee />
          <MentorMarquee />
          <StickyValueProps />
          <HowItWorks />
          <CTABanner />
        </main>
        <Footer />
        <PhotoEditToolbar />
      </div>
    </PhotoEditProvider>
  );
}
