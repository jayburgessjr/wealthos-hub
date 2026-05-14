import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, TrendingUp, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const HERO_IMAGE = "https://images.pexels.com/photos/16594724/pexels-photo-16594724.jpeg";

const features = [
  { icon: TrendingUp, text: "AI-ranked signals across 10+ asset classes" },
  { icon: Brain, text: "Two AI advisors with full portfolio context" },
  { icon: Shield, text: "Institutional-grade risk controls built in" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Enter your email first"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Reset link sent — check your inbox.");
      setResetMode(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">

      {/* ── Left panel — image ─────────────────────────────────────── */}
      <div className="relative hidden w-1/2 lg:block">
        <img
          src={HERO_IMAGE}
          alt="WealthOS"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-background/70" />
        {/* Gradient fade to right edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40" />

        <div className="relative flex h-full flex-col p-12">
          {/* Logo — top */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              WealthOS<span className="text-primary">.</span>
            </span>
          </Link>

          {/* Center copy — vertically centered */}
          <div className="flex flex-1 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Your Personal Hedge Fund
              </p>
              <h2 className="font-display text-5xl font-bold leading-tight text-foreground">
                Every decision,<br />
                ranked by urgency,<br />
                <span className="text-primary">backed by AI.</span>
              </h2>

              <div className="mt-10 space-y-5">
                {features.map(({ icon: Icon, text }, i) => (
                  <motion.div
                    key={text}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-base text-foreground/80">{text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Quote — bottom */}
          <div className="rounded-2xl border border-border/40 bg-card/60 p-5 backdrop-blur-sm">
            <p className="text-sm text-foreground/80 leading-relaxed">
              "The goal isn't to predict the market. It's to have better decision infrastructure than everyone else."
            </p>
            <p className="mt-2 text-xs font-semibold text-primary">— WealthOS Philosophy</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        {/* Mobile logo */}
        <div className="mb-10 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">
              WealthOS<span className="text-primary">.</span>
            </span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {!resetMode ? (
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl font-bold">Welcome back</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in to your WealthOS account
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => setResetMode(true)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl font-bold">Reset password</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your email and we'll send a reset link
                </p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-sm font-semibold">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                </Button>

                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}

          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create one free
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground/60">
            By signing in you agree to our{" "}
            <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
