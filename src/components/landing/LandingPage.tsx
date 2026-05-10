"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import MobileHeroSection from "./MobileHeroSection";
import UniversityLogoMarquee from "./UniversityLogoMarquee";
import StickyValueProps from "./StickyValueProps";
import MentorMarquee from "./MentorMarquee";
import MobileMentorMarquee from "./MobileMentorMarquee";
import HowItWorks from "./HowItWorks";
import FaqSection from "./FaqSection";
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
          {/* Hero — mobile/tablet (<lg) gets V2 mentor-grid layout, lg+ keeps the existing 7/5 hero */}
          <div className="lg:hidden">
            <MobileHeroSection />
          </div>
          <div className="hidden lg:contents">
            <HeroSection />
          </div>
          <UniversityLogoMarquee />
          {/* Mentor showcase — mobile gets the snap-carousel + filters layout, lg+ keeps the cinematic dark stage */}
          <div className="lg:hidden">
            <MobileMentorMarquee />
          </div>
          <div className="hidden lg:contents">
            <MentorMarquee />
          </div>
          <StickyValueProps />
          <HowItWorks />
          <FaqSection />
          <CTABanner />
        </main>
        <Footer />
        <PhotoEditToolbar />
      </div>
    </PhotoEditProvider>
  );
}
