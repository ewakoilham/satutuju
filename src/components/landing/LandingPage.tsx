import dynamic from "next/dynamic";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import MobileHeroSection from "./MobileHeroSection";
import UniversityLogoMarquee from "./UniversityLogoMarquee";
import StickyValueProps from "./StickyValueProps";
import HowItWorks from "./HowItWorks";
import FaqSection from "./FaqSection";
import CTABanner from "./CTABanner";
import Footer from "./Footer";
import AdminOnlyToolbar from "./AdminOnlyToolbar";
import {
  PhotoEditProvider,
  type PhotoEditInitialData,
} from "@/lib/photo-edit-context";

// Code-split: mentor showcases hydrate lazily so the initial JS bundle
// stays slim. SSR is still on so the HTML carries their content.
const MentorMarquee = dynamic(() => import("./MentorMarquee"));
const MobileMentorMarquee = dynamic(() => import("./MobileMentorMarquee"));

interface LandingPageProps {
  /** Server-picked random background index (avoids client-side swap flicker). */
  initialBgIndex: number;
  /** Server-prefetched landing data so PhotoEditProvider hydrates without
   *  a client round-trip — mentor photos appear immediately, no fade-gate. */
  initialData: PhotoEditInitialData;
}

export default function LandingPage({ initialBgIndex, initialData }: LandingPageProps) {
  return (
    <PhotoEditProvider initialData={initialData}>
      <div className="force-light min-h-screen">
        <Navbar />
        <main>
          {/* Hero — mobile/tablet (<lg) gets V2 mentor-grid layout, lg+ keeps the existing 7/5 hero */}
          <div className="lg:hidden">
            <MobileHeroSection initialBgIndex={initialBgIndex} />
          </div>
          <div className="hidden lg:contents">
            <HeroSection initialBgIndex={initialBgIndex} />
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
        <AdminOnlyToolbar />
      </div>
    </PhotoEditProvider>
  );
}
