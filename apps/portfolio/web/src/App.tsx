import { useState, useEffect } from "react";
import { trackEvent, AnalyticsEvents } from "@megalith/analytics";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { AboutSection } from "@/components/AboutSection";
import { ExperienceTimeline } from "@/components/ExperienceTimeline";
import { HowIBuildWithAi } from "@/components/HowIBuildWithAi";
import { Toolbox } from "@/components/Toolbox";
import { Recognition } from "@/components/Recognition";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";

export function App() {
  const [viewMode, setViewMode] = useState<"standard" | "ai-focus">("standard");

  useEffect(() => {
    trackEvent(AnalyticsEvents.PORTFOLIO_VIEWED);
  }, []);

  useEffect(() => {
    // Check URL hash for direct deep-linking
    const handleHashChange = () => {
      if (window.location.hash === "#ai-workflow" || window.location.hash === "#how-i-build") {
        setViewMode("ai-focus");
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleSelectAiFocus = () => {
    setViewMode("ai-focus");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToMain = () => {
    setViewMode("standard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans bg-ambient-mesh selection:bg-blue-500/20 selection:text-blue-900">
      <Navbar
        onSelectAiMode={handleSelectAiFocus}
        isAiView={viewMode === "ai-focus"}
      />

      <main className="flex-1">
        {viewMode === "ai-focus" ? (
          <HowIBuildWithAi onBack={handleBackToMain} isStandalone={true} />
        ) : (
          <>
            <Hero onExploreAi={handleSelectAiFocus} />
            <AboutSection />
            <ExperienceTimeline />
            <HowIBuildWithAi onBack={handleBackToMain} isStandalone={false} />
            <Toolbox />
            <Recognition />
            <ContactSection />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
