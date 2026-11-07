import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, LayoutDashboard, Sprout, Brain, ListChecks } from "lucide-react";
import { useDemo } from "../DemoProvider";

export default function LandingHero() {
  const { setDemoMode } = useDemo();
  const navigate = useNavigate();

  const handleDemo = () => {
    setDemoMode(true);
    navigate("/home");
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-28">
      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>A private app for friends and family, invited by Jay</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-display text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            Build wealth from your <span className="text-primary">first dollar.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-8 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            See where your money stands, get one clear next step, and let AI help you
            decide what to do next. You can begin with $1, or even $0.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
              <Link to="/login" className="flex items-center gap-2">
                Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              onClick={handleDemo}
              variant="outline"
              size="lg"
              className="h-12 rounded-full border-primary/20 bg-primary/5 px-8 text-base text-primary hover:bg-primary/10"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" /> Try the demo
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { icon: Sprout, text: "Start with any amount" },
              { icon: ListChecks, text: "One clear next step" },
              { icon: Brain, text: "AI helps you decide" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 px-3 py-1 text-xs text-muted-foreground"
              >
                <Icon className="h-3 w-3 text-primary" aria-hidden="true" />
                {text}
              </div>
            ))}
          </motion.div>

          <p className="mx-auto mt-8 max-w-xl text-xs text-muted-foreground">
            Educational tools only. This is not investment advice and nothing here promises
            any return. All investing involves risk, including loss of money.
          </p>
        </div>
      </div>
    </section>
  );
}
