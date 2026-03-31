import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to verify your account");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-pulse-green rounded-full bg-bullish opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-bullish" />
            </span>
            <h1 className="font-display text-3xl font-bold text-foreground">WealthOS</h1>
          </div>
          <p className="text-sm text-muted-foreground">Personal Hedge Fund Dashboard</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-5 flex rounded-lg bg-background p-1">
            {["Sign In", "Sign Up"].map((label, i) => (
              <button
                key={label}
                onClick={() => setIsLogin(i === 0)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-fast ${
                  (i === 0 ? isLogin : !isLogin)
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground outline-none focus:border-bullish transition-fast"
                placeholder="trader@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-body text-sm text-foreground outline-none focus:border-bullish transition-fast"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-bullish py-2.5 font-body text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
