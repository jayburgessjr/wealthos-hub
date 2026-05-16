import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  FINANCIAL_DISCLOSURE_KEY,
  FINANCIAL_DISCLOSURE_PARAGRAPHS,
  FINANCIAL_DISCLOSURE_TEXT,
  FINANCIAL_DISCLOSURE_VERSION,
} from "@/lib/legalDisclosure";

export default function LegalDisclosureGate() {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  const queryClient = useQueryClient();
  const [initials, setInitials] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const normalizedInitials = useMemo(
    () => initials.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6),
    [initials],
  );

  const acceptanceQuery = useQuery({
    queryKey: ["legal-acceptance", user?.id, FINANCIAL_DISCLOSURE_VERSION],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_acceptances")
        .select("id, accepted_at")
        .eq("user_id", user!.id)
        .eq("document_key", FINANCIAL_DISCLOSURE_KEY)
        .eq("document_version", FINANCIAL_DISCLOSURE_VERSION)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !loading && !isDemoMode,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const acceptedAt = new Date().toISOString();
      const { error } = await supabase.from("legal_acceptances").insert({
        user_id: user!.id,
        document_key: FINANCIAL_DISCLOSURE_KEY,
        document_version: FINANCIAL_DISCLOSURE_VERSION,
        initials: normalizedInitials,
        accepted_text: FINANCIAL_DISCLOSURE_TEXT,
        accepted_at: acceptedAt,
        user_agent:
          typeof navigator === "undefined" ? null : navigator.userAgent,
      });

      if (error && error.code !== "23505") throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["legal-acceptance", user?.id, FINANCIAL_DISCLOSURE_VERSION],
      });
      toast.success("Disclosure recorded.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to record disclosure.");
    },
  });

  // Disclosure gate temporarily disabled — re-enable once legal_acceptances table is stable in prod
  if (!user || isDemoMode || loading) return null;
  return null;

  const isChecking = acceptanceQuery.isLoading;
  const isAccepted = !!acceptanceQuery.data;

  if (isChecking) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/96 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 text-sm text-muted-foreground shadow-2xl shadow-black/30">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking required disclosure status...
        </div>
      </div>
    );
  }

  if (acceptanceQuery.isError) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/96 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg rounded-3xl border border-bearish/30 bg-card p-8 text-center shadow-2xl shadow-black/30">
          <ShieldAlert className="mx-auto h-10 w-10 text-bearish" />
          <h2 className="mt-4 font-display text-2xl font-black tracking-tight">
            Disclosure Check Failed
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            We could not verify your disclosure acceptance record. Please try
            again or sign out and sign back in.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => acceptanceQuery.refetch()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isAccepted) return null;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsSigningOut(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (normalizedInitials.length < 1) {
      toast.error("Enter your initials to continue.");
      return;
    }

    await acceptMutation.mutateAsync();
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-background/96 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-border/70 bg-card p-8 shadow-2xl shadow-black/30 sm:p-10">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-amber-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Required Disclosure
              </p>
              <h2 className="mt-2 font-display text-3xl font-black tracking-tight">
                Review and Accept Before Continuing
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Disclosure version {FINANCIAL_DISCLOSURE_VERSION}. We record
                your initials, acceptance time, version, and the statement text
                you accepted.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-4 rounded-3xl border border-border/60 bg-background/60 p-6">
            {FINANCIAL_DISCLOSURE_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Full legal pages:
            {" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Terms
            </a>
            {" · "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Privacy
            </a>
            {" · "}
            <a href="/disclaimer" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              Disclaimer
            </a>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="disclosure-initials"
                className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
              >
                Type your initials to agree
              </label>
              <input
                id="disclosure-initials"
                type="text"
                value={normalizedInitials}
                onChange={(event) => setInitials(event.target.value)}
                placeholder="JD"
                autoComplete="off"
                maxLength={6}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg font-semibold uppercase tracking-[0.24em] text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <p className="text-xs leading-6 text-muted-foreground">
              By continuing, you confirm that you read and accept this required
              disclosure and understand that AJE is not a licensed
              financial advisory service.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSignOut}
                disabled={acceptMutation.isPending || isSigningOut || isChecking}
                className="justify-start px-0 text-muted-foreground hover:text-foreground"
              >
                {isSigningOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Sign out instead
              </Button>

              <Button
                type="submit"
                disabled={
                  acceptMutation.isPending ||
                  isSigningOut ||
                  normalizedInitials.length < 1
                }
                className="min-w-44"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording
                  </>
                ) : (
                  "I Agree and Continue"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
