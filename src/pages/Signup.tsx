import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, TrendingUp, Shield, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const HERO_IMAGE = "https://images.pexels.com/photos/16594724/pexels-photo-16594724.jpeg";

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
];

const features = [
  { icon: TrendingUp, text: "AI-ranked signals across 10+ asset classes" },
  { icon: Brain, text: "Two AI advisors with full portfolio context" },
  { icon: Shield, text: "Institutional-grade risk controls built in" },
];

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyStep, setVerifyStep] = useState(false);

  const passwordValid = passwordRequirements.every((r) => r.test(password));
  const passwordsMatch = password === confirm && confirm.length > 0;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) { toast.error("Password does not meet requirements"); return; }
    if (!passwordsMatch) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      setVerifyStep(true);
    }
  };

  // ── Verify step ──────────────────────────────────────────────────────────────
  if (verifyStep) {
    return (
      <div className="flex min-h-screen bg-background text-foreground">
        <div className="relative hidden w-1/2 lg:block">
          <img src={HERO_IMAGE} alt="AJE" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/70" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40" />
          <div className="relative flex h-full items-center p-12">
            <Link to="/" className="absolute top-12 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
                <Rocket className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">
                AJE<span className="text-primary">.</span>
              </span>
            </Link>
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold">Check your email</h1>
            <p className="mt-3 text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-semibold text-foreground">{email}</span>.
              Click it to verify your account and get started.
            </p>
            <p className="mt-8 text-sm text-muted-foreground">
              Already verified?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Main signup ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-background text-foreground">

      {/* ── Left panel — image ─────────────────────────────────────── */}
      <div className="relative hidden w-1/2 lg:block">
        <img
          src={HERO_IMAGE}
          alt="AJE"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/40" />

        <div className="relative flex h-full flex-col p-12">
          {/* Logo — top */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">
              AJE<span className="text-primary">.</span>
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
                Start Free Today
              </p>
              <h2 className="font-display text-5xl font-bold leading-tight text-foreground">
                Run your capital<br />
                like a hedge fund.<br />
                <span className="text-primary">Without the fees.</span>
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
            <p className="mt-2 text-xs font-semibold text-primary">— AJE Philosophy</p>
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
              AJE<span className="text-primary">.</span>
            </span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold">Create your account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Start running your portfolio with decision intelligence
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Email */}
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

            {/* Password */}
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

              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full transition-colors ${req.test(password) ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      <span className={`text-xs transition-colors ${req.test(password) ? "text-primary" : "text-muted-foreground/60"}`}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`w-full rounded-xl border bg-card py-3 pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                    confirm.length > 0
                      ? passwordsMatch
                        ? "border-primary/50 focus:border-primary"
                        : "border-bearish/50 focus:border-bearish"
                      : "border-border focus:border-primary"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirm.length > 0 && !passwordsMatch && (
                <p className="text-xs text-bearish">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !passwordValid || !passwordsMatch}
              className="h-12 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>Create Account <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>

          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-foreground/60">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="hover:text-muted-foreground transition-colors">Terms of Service</Link>
            {" "}and{" "}
            <Link to="/privacy" className="hover:text-muted-foreground transition-colors">Privacy Policy</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
