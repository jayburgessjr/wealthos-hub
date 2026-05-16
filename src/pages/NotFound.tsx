import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket, ArrowLeft, LayoutDashboard, Radar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const QUICK_LINKS = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/signals",    icon: Radar,           label: "Signals"   },
  { to: "/decisions",  icon: Zap,             label: "Decision Hub" },
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        {/* Logo */}
        <Link to="/" className="mb-10 inline-flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">
            AJE<span className="text-primary">.</span>
          </span>
        </Link>

        {/* 404 */}
        <div className="mt-8 mb-6">
          <p className="font-mono text-[7rem] font-black leading-none text-primary/10 select-none">
            404
          </p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
            Page not found
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-mono text-primary/70">{location.pathname}</span> doesn't exist.
            It may have moved or the URL may be wrong.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go back
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>

        {/* Quick links */}
        <div className="mt-10 border-t border-border pt-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Or jump to
          </p>
          <div className="flex justify-center gap-3">
            {QUICK_LINKS.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Icon size={12} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
