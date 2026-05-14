import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import Marquee from "@/components/landing/Marquee";
import HowItWorks from "@/components/landing/HowItWorks";
import SocialProof from "@/components/landing/SocialProof";
import BentoGrid from "@/components/landing/BentoGrid";
import AssetClasses from "@/components/landing/AssetClasses";
import PricingSection from "@/components/landing/PricingSection";
import FAQ from "@/components/landing/FAQ";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Shield, Zap, Brain } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />

      <main>
        {/* 1. Hero + stats */}
        <LandingHero />

        {/* 2. Dual-row live signal ticker */}
        <Marquee />

        {/* 3. How it works — 4-step loop */}
        <HowItWorks />

        {/* 4. Social proof — stats + testimonials */}
        <SocialProof />

        {/* 4. Full feature showcase (Core, Capital, AI, Markets, Prediction, Tools) */}
        <BentoGrid />

        {/* 5. Asset class coverage grid */}
        <AssetClasses />

        {/* 6. Pricing — Free / Pro / Elite */}
        <PricingSection />

        {/* 7. Final CTA */}
        <section className="relative overflow-hidden py-24 md:py-36">
          <div className="absolute inset-0 -z-10 bg-primary/5" />
          <div className="absolute top-1/2 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />

          <div className="container px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-card p-12 md:p-20 shadow-2xl shadow-primary/10"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Start Running Your Portfolio Like a Hedge Fund</span>
              </div>

              <h2 className="mb-6 font-display text-4xl font-bold tracking-tight sm:text-6xl">
                Ready To Make Better
                <br />
                <span className="text-primary">Decisions With Your Capital?</span>
              </h2>

              <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
                Signals, AI advisors, risk controls, compound modeling, and 30+ tools —
                all aligned to your mission, your portfolio, and your goals.
              </p>

              {/* Feature pills */}
              <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
                {[
                  { icon: Zap, text: "AI Signals + Decision Hub" },
                  { icon: Brain, text: "Two AI Advisors" },
                  { icon: Shield, text: "Risk Controls Built In" },
                ].map(({ icon: Icon, text }) => (
                  <div
                    key={text}
                    className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {text}
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-10 text-base font-bold">
                  <Link to="/signup" className="flex items-center gap-2">
                    Create Your Free Account <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full px-8 text-base border-border/50 hover:bg-accent/50"
                >
                  <Link to="#pricing">View Pricing</Link>
                </Button>
              </div>

              <p className="mt-8 text-sm text-muted-foreground">
                No credit card required · Free tier always available · Cancel anytime
              </p>
            </motion.div>
          </div>
        </section>

        {/* 8. FAQ */}
        <FAQ />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Index;
