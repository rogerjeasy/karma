import NavBar from "@/components/landing/NavBar";
import HeroSection from "@/components/landing/HeroSection";
import StatsStrip from "@/components/landing/StatsStrip";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorks from "@/components/landing/HowItWorks";
import DashboardShowcase from "@/components/landing/DashboardShowcase";
import GhostSection from "@/components/landing/GhostSection";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import TechStack from "@/components/landing/TechStack";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <NavBar />
      <main>
        <HeroSection />
        <StatsStrip />
        <ProblemSection />
        <HowItWorks />
        <DashboardShowcase />
        <GhostSection />
        <FeaturesGrid />
        <TechStack />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
