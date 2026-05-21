import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import {
  getInvitationByToken,
  acceptInvitation,
} from "@/integrations/supabase/household-queries";
import { toast } from "sonner";

export default function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInvitationByToken(token)
      .then(setInvite)
      .catch(() => setInvite(null));
  }, [token]);

  const canAccept = !!user && !!invite && invite.status === "pending";

  const onAccept = async () => {
    if (!token || !user) return;
    try {
      setBusy(true);
      await acceptInvitation(token, user.id);
      toast.success("Invitation accepted — welcome to the household!");
      navigate("/household");
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to accept invitation");
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto mt-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Household
            </span>
          </div>
          <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
            Accept <span className="text-emerald-500">Invitation</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join the invited household.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-4">
          {!invite && (
            <p className="text-sm text-muted-foreground">Loading invitation…</p>
          )}
          {invite && (
            <>
              <p className="text-sm">
                You were invited to join a household as a member.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Invited email: {invite.email}
              </p>
              {!user && !loading && (
                <p className="text-sm text-muted-foreground">
                  Please sign in with the invited email address, then return to
                  this page.
                </p>
              )}
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!canAccept || busy}
                onClick={onAccept}
              >
                {busy ? "Accepting…" : "Accept Invitation"}
              </Button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
