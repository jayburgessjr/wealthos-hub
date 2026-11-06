import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount, useClaimOwner, useIsOwner } from "@/lib/desk/hooks";
import { ApprovalQueue } from "@/components/desk/ApprovalQueue";
import { HeaderStrip, KillSwitchBanner } from "@/components/desk/HeaderStrip";
import { Journal } from "@/components/desk/Journal";
import { GHOST_BTN, ORANGE_BG } from "@/components/desk/Panel";
import { Positions } from "@/components/desk/Positions";
import { RiskGauges } from "@/components/desk/RiskGauges";
import { Scorecard } from "@/components/desk/Scorecard";
import { SignalFeed } from "@/components/desk/SignalFeed";
import { Watchlist } from "@/components/desk/Watchlist";
import { cn } from "@/lib/utils";

const SHELL = "min-h-screen bg-[hsl(240,6%,10%)] text-xs text-white";

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className={cn(SHELL, "flex items-center justify-center p-6")}>
      <div className="max-w-sm border border-white/10 bg-[hsl(220,45%,12%)] p-6 text-center">
        <h1 className="text-sm font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function Terminal() {
  const account = useAccount();
  return (
    <div className={SHELL}>
      <div className="flex items-center justify-between border-b border-white/10 bg-[hsl(220,45%,12%)] px-3 py-1.5">
        <h1 className="text-[11px] font-bold uppercase tracking-[0.2em]">Desk</h1>
        <Link to="/invs/dashboard" className="text-white/70 underline underline-offset-2 hover:text-white">
          Back to app
        </Link>
      </div>
      {account.isLoading && (
        <p role="status" className="border-b border-white/10 px-3 py-2 text-white/60">
          Loading account...
        </p>
      )}
      {account.error && (
        <div role="alert" className="flex items-center gap-3 border-b border-white/10 px-3 py-2 text-white/80">
          <span>Account data failed to load: {(account.error as Error).message}</span>
          <Button type="button" onClick={() => account.refetch()} className={GHOST_BTN}>
            Retry
          </Button>
        </div>
      )}
      {account.data && (
        <>
          <HeaderStrip account={account.data} />
          <KillSwitchBanner account={account.data} />
        </>
      )}
      <main className="grid gap-px bg-white/10 p-px lg:grid-cols-12 lg:[&>*]:max-h-[420px]">
        <div className="lg:col-span-8">
          <ApprovalQueue />
        </div>
        <div className="lg:col-span-4">
          <RiskGauges />
        </div>
        <div className="lg:col-span-3">
          <Watchlist />
        </div>
        <div className="lg:col-span-5">
          <Positions />
        </div>
        <div className="lg:col-span-4">
          <SignalFeed />
        </div>
        <div className="lg:col-span-6">
          <Scorecard />
        </div>
        <div className="lg:col-span-6">
          <Journal />
        </div>
      </main>
    </div>
  );
}

export default function DeskPage() {
  const owner = useIsOwner();
  const claim = useClaimOwner();

  if (owner.isLoading) {
    return (
      <main className={cn(SHELL, "flex items-center justify-center")}>
        <p role="status" className="text-white/70">Checking access...</p>
      </main>
    );
  }
  if (owner.error) {
    return (
      <Message title="Could not check access">
        <p role="alert" className="mt-2 text-white/70">{(owner.error as Error).message}</p>
        <Button type="button" onClick={() => owner.refetch()} className={cn(GHOST_BTN, "mt-3")}>
          Retry
        </Button>
      </Message>
    );
  }
  if (!owner.data) {
    return (
      <Message title="Not available">
        <p className="mt-2 text-white/70">This page is private.</p>
        <Button
          type="button"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(undefined, {
              onSuccess: () => toast.success("Desk claimed"),
              onError: (e) => toast.error(e.message),
            })
          }
          className={cn("mt-3 h-7 rounded-sm px-3 text-xs", ORANGE_BG)}
        >
          Claim desk
        </Button>
      </Message>
    );
  }
  return <Terminal />;
}
