import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useResetKillSwitch } from "@/lib/desk/hooks";
import { money, pct, pnlClass, shortTime, signedMoney, signedPct } from "@/lib/desk/format";
import type { DeskAccount } from "@/lib/desk/types";
import { GHOST_BTN, MICRO, NUM, ORANGE_BG, ORANGE_TEXT } from "./Panel";
import { cn } from "@/lib/utils";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-1.5">
      <span className={MICRO}>{label}</span>
      <span className={cn(NUM, "text-sm text-foreground")}>{children}</span>
    </div>
  );
}

export function KillSwitchBanner({ account }: { account: DeskAccount }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const reset = useResetKillSwitch();
  if (!account.state.halted) return null;

  const submit = () => {
    reset.mutate(note.trim(), {
      onSuccess: () => {
        toast.success("Kill switch reset");
        setOpen(false);
        setNote("");
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div role="alert" className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2 text-foreground">
      <div className="flex items-center gap-2">
        <ShieldAlert className={cn("h-4 w-4", ORANGE_TEXT)} aria-hidden="true" />
        <span className="font-semibold">Kill switch engaged</span>
        <span className="text-muted-foreground">
          New orders are halted{account.state.halted_reason ? `: ${account.state.halted_reason}` : ""}
          {account.state.halted_at ? ` (since ${shortTime(account.state.halted_at)})` : ""}.
        </span>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
        Reset kill switch
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-muted/40 text-foreground">
          <DialogHeader>
            <DialogTitle>Reset kill switch</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Resuming allows new orders again. Record why it is safe to resume; the note is stored in the audit log.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="desk-reset-note" className={MICRO}>
            Reason
          </label>
          <Textarea
            id="desk-reset-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border-border bg-card text-xs text-foreground"
            rows={3}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className={GHOST_BTN}>
              Cancel
            </Button>
            <Button type="button" disabled={note.trim().length < 10 || reset.isPending} onClick={submit} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
              {reset.isPending ? "Resetting..." : "Confirm reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HeaderStrip({ account }: { account: DeskAccount }) {
  const { equity } = account.account;
  const { day_start_equity: dayStart, high_water_mark: hwm, halted } = account.state;
  const dayPnl = dayStart > 0 ? equity - dayStart : NaN;
  const dayPct = dayStart > 0 ? dayPnl / dayStart : NaN;
  const dd = hwm > 0 ? Math.max(0, (hwm - equity) / hwm) : NaN;
  const live = account.mode === "live";

  return (
    <div className="flex flex-wrap items-center divide-x divide-border border-b border-border bg-muted/40">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            live ? "border-[hsl(20,82%,51%)] bg-[hsl(20,82%,51%)] text-[hsl(240,6%,10%)]" : "border-foreground/30 text-foreground",
          )}
        >
          {live ? "Live" : "Paper"}
        </span>
        <span className={cn(MICRO, "text-muted-foreground")}>{account.broker}</span>
      </div>
      <Stat label="Equity">{money(equity)}</Stat>
      <Stat label="Day P&L">
        <span className={pnlClass(dayPnl)}>
          {signedMoney(dayPnl)} <span className="text-muted-foreground">({signedPct(dayPct)})</span>
        </span>
      </Stat>
      <Stat label="High-water mark">{money(hwm)}</Stat>
      <Stat label="Drawdown">{pct(dd)}</Stat>
      <Stat label="Kill switch">
        <span className={halted ? ORANGE_TEXT : "text-foreground"}>{halted ? "Engaged" : "Clear"}</span>
      </Stat>
      <div className="ml-auto px-3 py-1.5 text-[10px] text-muted-foreground">As of {shortTime(account.account.asOf)}</div>
    </div>
  );
}
