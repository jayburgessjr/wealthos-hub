import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { useAccount, useClaimOwner, useIsOwner } from "@/lib/desk/hooks";
import { ApprovalQueue } from "@/components/desk/ApprovalQueue";
import { HeaderStrip, KillSwitchBanner } from "@/components/desk/HeaderStrip";
import { Journal } from "@/components/desk/Journal";
import { GHOST_BTN, ACCENT_BG } from "@/components/desk/Panel";
import { Positions } from "@/components/desk/Positions";
import { RiskGauges } from "@/components/desk/RiskGauges";
import { Scorecard } from "@/components/desk/Scorecard";
import { SignalFeed } from "@/components/desk/SignalFeed";
import { Watchlist } from "@/components/desk/Watchlist";
import { cn } from "@/lib/utils";

export type DeskView = "overview" | "portfolio" | "research" | "performance";

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
          {children}
        </div>
      </div>
    </DashboardLayout>
  );
}

const GRID = "grid gap-4 text-xs lg:grid-cols-12 lg:[&>*]:max-h-[460px]";

function ViewPanels({ view }: { view: DeskView }) {
  switch (view) {
    case "portfolio":
      return (
        <div className={GRID}>
          <div className="lg:col-span-12">
            <Positions />
          </div>
        </div>
      );
    case "research":
      return (
        <div className={GRID}>
          <div className="lg:col-span-8">
            <SignalFeed />
          </div>
          <div className="lg:col-span-4">
            <Watchlist />
          </div>
        </div>
      );
    case "performance":
      return (
        <div className={GRID}>
          <div className="lg:col-span-7">
            <Scorecard />
          </div>
          <div className="lg:col-span-5">
            <Journal />
          </div>
        </div>
      );
    default:
      return (
        <div className={GRID}>
          <div className="lg:col-span-8">
            <ApprovalQueue />
          </div>
          <div className="lg:col-span-4">
            <RiskGauges />
          </div>
        </div>
      );
  }
}

function Terminal({ view }: { view: DeskView }) {
  const account = useAccount();
  return (
    <DashboardLayout>
      <TabNav group="desk" />
      <div className="space-y-4">
        {account.isLoading && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading account...
          </p>
        )}
        {account.error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground/80"
          >
            <span>Account data failed to load: {(account.error as Error).message}</span>
            <Button type="button" onClick={() => account.refetch()} className={GHOST_BTN}>
              Retry
            </Button>
          </div>
        )}
        {account.data && (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <HeaderStrip account={account.data} />
            <KillSwitchBanner account={account.data} />
          </div>
        )}
        <ViewPanels view={view} />
      </div>
    </DashboardLayout>
  );
}

export default function DeskPage({ view = "overview" }: { view?: DeskView }) {
  const owner = useIsOwner();
  const claim = useClaimOwner();

  if (owner.isLoading) {
    return (
      <DashboardLayout>
        <p role="status" className="text-sm text-muted-foreground">
          Checking access...
        </p>
      </DashboardLayout>
    );
  }
  if (owner.error) {
    return (
      <Message title="Could not check access">
        <p role="alert" className="mt-2 text-sm text-muted-foreground">
          {(owner.error as Error).message}
        </p>
        <Button type="button" onClick={() => owner.refetch()} className={cn(GHOST_BTN, "mt-3")}>
          Retry
        </Button>
      </Message>
    );
  }
  if (!owner.data) {
    return (
      <Message title="Not available">
        <p className="mt-2 text-sm text-muted-foreground">This page is private.</p>
        <Button
          type="button"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(undefined, {
              onSuccess: () => toast.success("Desk claimed"),
              onError: (e) => toast.error(e.message),
            })
          }
          className={cn("mt-3 h-7 rounded-sm px-3 text-xs", ACCENT_BG)}
        >
          Claim desk
        </Button>
      </Message>
    );
  }
  return <Terminal view={view} />;
}
