import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import ThreePillars from "@/components/landing/ThreePillars";
import HowItWorks from "@/components/landing/HowItWorks";
import SocialProof from "@/components/landing/SocialProof";
import PrivateAccess from "@/components/landing/PrivateAccess";
import FAQ from "@/components/landing/FAQ";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main>
        <LandingHero />
        <ThreePillars />
        <HowItWorks />
        <SocialProof />
        <PrivateAccess />

        {/* Closing call to action */}
        <section className="py-20 md:py-28">
          <div className="container px-4 text-center">
            <div className="mx-auto max-w-3xl rounded-3xl border border-primary/20 bg-card p-10 md:p-16">
              <h2 className="mb-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                Your first dollar is a fine place to start.
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-muted-foreground">
                Sign in, answer a few plain questions, and get one clear next step.
              </p>
              <Button asChild size="lg" className="h-12 rounded-full px-10 text-base font-bold">
                <Link to="/login" className="flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <p className="mt-6 text-xs text-muted-foreground">
                Educational tools only. Not investment advice. Investing involves risk.
              </p>
            </div>
          </div>
        </section>

        <FAQ />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Index;
