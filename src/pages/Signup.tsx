import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Rocket, Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const passwordRequirements = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Contains a number", test: (p: string) => /\d/.test(p) },
  { label: "Contains a letter", test: (p: string) => /[a-zA-Z]/.test(p) },
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

  if (verifyStep) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/8 blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-bullish/10">
            <CheckCircle2 className="h-10 w-10 text-bullish" />
          </div>
          <h1 className="font-display text-3xl font-bold">Check your email</h1>
          <p className="mt-3 text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{email}</span>.
            Click it to verify your account and get started.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Already verified?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/8 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="mb-10 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Rocket className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">
            WealthOS<span className="text-primary">.</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl shadow-black/30">
          <div className="mb-8 text-center">
            <h1 className="font-display text-2xl font-bold">Create your account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
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
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
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
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength hints */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {passwordRequirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5">
                      <div
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          req.test(password) ? "bg-bullish" : "bg-muted-foreground/30"
                        }`}
                      />
                      <span
                        className={`text-xs transition-colors ${
                          req.test(password) ? "text-bullish" : "text-muted-foreground/60"
                        }`}
                      >
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
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
                  className={`w-full rounded-xl border bg-background py-3 pl-10 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-colors ${
                    confirm.length > 0
                      ? passwordsMatch
                        ? "border-bullish/50 focus:border-bullish"
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
                <>
                  Create Account <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          By creating an account you agree to our{" "}
          <Link to="/terms" className="transition-colors hover:text-muted-foreground">
            Terms of Service
          </Link>
          {" "}and{" "}
          <Link to="/privacy" className="transition-colors hover:text-muted-foreground">
            Privacy Policy
          </Link>.
        </p>
      </motion.div>
    </div>
  );
}
