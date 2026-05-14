import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, LayoutDashboard, TrendingUp, Shield, Brain } from "lucide-react";
import { useDemo } from "../DemoProvider";

const stats = [
  { label: "Asset Classes", value: "10+" },
  { label: "Market Tools", value: "30+" },
  { label: "AI Models", value: "Multi" },
  { label: "Data Sources", value: "15+" },
];

export default function LandingHero() {
  const { setDemoMode } = useDemo();
  const navigate = useNavigate();

  const handleDemo = () => {
    setDemoMode(true);
    navigate("/dashboard");
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-48 md:pb-32">
      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -z-10 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute top-60 left-20 -z-10 h-[400px] w-[400px] rounded-full bg-neutral/5 blur-[100px]" />
      <div className="absolute top-60 right-20 -z-10 h-[400px] w-[400px] rounded-full bg-watch/5 blur-[100px]" />

      <div className="container relative">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              <span>Your Personal Hedge Fund Operating System</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-5xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
          >
            Compound Wealth with <br />
            <span className="bg-gradient-to-r from-primary via-neutral to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              AI Precision.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-lg text-muted-foreground sm:text-xl lg:text-2xl max-w-3xl mx-auto"
          >
            Signals, risk controls, AI advisors, prediction markets, and 30+ tools —
            everything a sophisticated investor needs to{" "}
            <span className="text-foreground font-medium">inform, strategize, execute, and decide</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
              <Link to="/signup" className="flex items-center gap-2">
                Start For Free <ArrowRight className="h-4 w-4" />
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

          {/* Trust pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: Shield, text: "No broker required" },
              { icon: Brain, text: "AI-powered decisions" },
              { icon: TrendingUp, text: "10+ asset classes" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 px-3 py-1 text-xs text-muted-foreground"
              >
                <Icon className="h-3 w-3 text-primary" />
                {text}
              </div>
            ))}
          </motion.div>

          {/* Dashboard screenshot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55 }}
            className="mt-16 relative mx-auto max-w-6xl"
          >
            {/* Glow behind screenshot */}
            <div className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl -z-10" />

            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10">
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60 z-10 pointer-events-none" />

              <img
                src="/dashboardimage.png"
                alt="WealthOS Dashboard"
                className="w-full object-cover object-top"
                onError={(e) => {
                  // Fallback to a dark placeholder if image not yet saved
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.classList.add("min-h-[420px]", "flex", "items-center", "justify-center");
                }}
              />

              {/* Floating stat badges */}
              <div className="absolute top-6 left-6 z-20 hidden md:flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-background/80 backdrop-blur-sm px-3 py-2 text-xs">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary font-medium">LIVE</span>
                  <span className="text-muted-foreground">Decision Hub Active</span>
                </div>
              </div>

              <div className="absolute top-6 right-6 z-20 hidden md:block">
                <div className="rounded-xl border border-watch/30 bg-background/80 backdrop-blur-sm px-3 py-2 text-xs">
                  <div className="text-watch font-medium">BULL Market Regime</div>
                  <div className="text-muted-foreground">Risk-On · VIX 15</div>
                </div>
              </div>

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
                <span className="rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm tracking-widest uppercase">
                  WealthOS Dashboard
                </span>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/40 bg-card/50 px-4 py-5 text-center">
                <div className="font-display text-3xl font-black text-primary">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
