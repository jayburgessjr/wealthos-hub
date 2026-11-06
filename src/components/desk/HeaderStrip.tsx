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
      <span className={cn(NUM, "text-sm text-white")}>{children}</span>
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
    <div role="alert" className="flex items-center justify-between gap-3 border-b border-white/10 bg-[hsl(220,45%,12%)] px-3 py-2 text-white">
      <div className="flex items-center gap-2">
        <ShieldAlert className={cn("h-4 w-4", ORANGE_TEXT)} aria-hidden="true" />
        <span className="font-semibold">Kill switch engaged</span>
        <span className="text-white/70">
          New orders are halted{account.state.halted_reason ? `: ${account.state.halted_reason}` : ""}
          {account.state.halted_at ? ` (since ${shortTime(account.state.halted_at)})` : ""}.
        </span>
      </div>
      <Button type="button" onClick={() => setOpen(true)} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
        Reset kill switch
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-[hsl(220,45%,12%)] text-white">
          <DialogHeader>
            <DialogTitle>Reset kill switch</DialogTitle>
            <DialogDescription className="text-white/70">
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
            className="border-white/10 bg-[hsl(240,6%,10%)] text-xs text-white"
            rows={3}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className={GHOST_BTN}>
              Cancel
            </Button>
            <Button type="button" disabled={note.trim().length < 5 || reset.isPending} onClick={submit} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
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
  const dayPnl = equity - dayStart;
  const dayPct = dayStart > 0 ? dayPnl / dayStart : NaN;
  const dd = hwm > 0 ? Math.max(0, (hwm - equity) / hwm) : NaN;
  const live = account.mode === "live";

  return (
    <div className="flex flex-wrap items-center divide-x divide-white/10 border-b border-white/10 bg-[hsl(220,45%,12%)]">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            live ? "border-[hsl(20,82%,51%)] bg-[hsl(20,82%,51%)] text-[hsl(240,6%,10%)]" : "border-white/30 text-white",
          )}
        >
          {live ? "Live" : "Paper"}
        </span>
        <span className={cn(MICRO, "text-white/70")}>{account.broker}</span>
      </div>
      <Stat label="Equity">{money(equity)}</Stat>
      <Stat label="Day P&L">
        <span className={pnlClass(dayPnl)}>
          {signedMoney(dayPnl)} <span className="text-white/60">({signedPct(dayPct)})</span>
        </span>
      </Stat>
      <Stat label="High-water mark">{money(hwm)}</Stat>
      <Stat label="Drawdown">{pct(dd)}</Stat>
      <Stat label="Kill switch">
        <span className={halted ? ORANGE_TEXT : "text-white"}>{halted ? "Engaged" : "Clear"}</span>
      </Stat>
      <div className="ml-auto px-3 py-1.5 text-[10px] text-white/50">As of {shortTime(account.account.asOf)}</div>
    </div>
  );
}
