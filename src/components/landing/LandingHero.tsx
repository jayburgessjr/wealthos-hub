import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, LayoutDashboard } from "lucide-react";
import { useDemo } from "../DemoProvider";

export default function LandingHero() {
  const { setDemoMode } = useDemo();
  const navigate = useNavigate();

  const handleDemo = () => {
    setDemoMode(true);
    navigate("/dashboard");
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -z-10 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      
      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Next Generation Portfolio Management</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
          >
            Compound Wealth with <br />
            <span className="bg-gradient-to-r from-primary via-neutral to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">AI Precision.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-lg text-muted-foreground sm:text-xl lg:text-2xl max-w-3xl mx-auto"
          >
            The personal hedge fund hub for sophisticated investors.<br className="hidden sm:block" />
            Institutional-grade signals, automated tracking, and AI-driven growth.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
              <Link to="/signup" className="flex items-center gap-2">
                Start Compounding <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              onClick={handleDemo}
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-8 text-base border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" /> Try Live Demo
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border/50 bg-card/50 shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/50" />
            <img
              src="https://images.unsplash.com/photo-1611974717482-982c7a6b996b?q=80&w=2670&auto=format&fit=crop"
              alt="WealthOS Dashboard"
              className="w-full object-cover opacity-80"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                WealthOS Dashboard
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
