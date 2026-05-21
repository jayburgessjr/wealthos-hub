import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { createInvitation } from "@/integrations/supabase/household-queries";
import { toast } from "sonner";

export function InviteMemberForm() {
  const { user } = useAuth();
  const { householdId } = useHouseholdBudget();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !user) {
      toast.error("Sign in and select a household first");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    try {
      setBusy(true);
      const invite = await createInvitation(householdId, email.trim(), user.id);
      toast.success("Invitation created");
      setEmail("");
      console.info(
        "Invite link:",
        `${window.location.origin}/invite/${invite.token}`,
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to invite");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label className="font-mono text-xs uppercase">Invite by email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="partner@example.com"
        />
      </div>
      <Button type="submit" disabled={busy} className="font-mono w-full">
        {busy ? "Sending…" : "Send Invite"}
      </Button>
    </form>
  );
}
