import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingHero from "@/components/landing/LandingHero";
import Marquee from "@/components/landing/Marquee";
import BentoGrid from "@/components/landing/BentoGrid";
import PricingSection from "@/components/landing/PricingSection";
import FAQ from "@/components/landing/FAQ";
import LandingFooter from "@/components/landing/LandingFooter";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNavbar />
      
      <main>
        <LandingHero />
        
        <Marquee />
        
        <BentoGrid />
        
        <PricingSection />
        
        {/* Call to Action Section */}
        <section id="strategies" className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 -z-10 bg-primary/5" />
          <div className="container px-4 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mx-auto max-w-4xl rounded-3xl border border-primary/20 bg-card p-12 md:p-20 shadow-2xl shadow-primary/10"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                <span>Limited Access Release</span>
              </div>
              
              <h2 className="mb-6 font-display text-4xl font-bold tracking-tight sm:text-6xl">
                Ready To Run Your Portfolio <br />
                <span className="text-primary">With Better Decisions?</span>
              </h2>
              
              <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                Get decision intelligence across entry, exit, sizing, risk, and portfolio management from one operating layer.
              </p>
              
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
                  <Link to="/signup" className="flex items-center gap-2">
                    Create Your Account <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-8 text-base border-border/50 hover:bg-accent/50">
                  <Link to="#faq">Talk to Support</Link>
                </Button>
              </div>
              
              <p className="mt-8 text-sm text-muted-foreground">
                No credit card required. Start with our free tier.
              </p>
            </motion.div>
          </div>
        </section>

        <FAQ />
      </main>
      
      <LandingFooter />
    </div>
  );
};

export default Index;
