import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lock, Rocket, Crown, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGateProps {
  children: ReactNode;
  tier?: "pro" | "elite";
}

const TIER_CONFIG = {
  pro: {
    label: "Pro Feature",
    price: "$29/mo",
    icon: Rocket,
    description: "Upgrade to AJE Pro to unlock AI Advisor, Strategy Allocator, and institutional-grade signals.",
    features: [
      "Full AI Advisor access",
      "Advanced Strategy Allocator",
      "Real-time AI signals",
      "Portfolio optimization tools",
    ],
    cta: "Upgrade to Pro — $29/mo",
  },
  elite: {
    label: "Elite Feature",
    price: "$250/mo",
    icon: Crown,
    description: "Upgrade to AJE Elite for full platform access — Options Flow, Prediction Markets, Wealth Planning, and every advanced tool.",
    features: [
      "Options Flow & Insider Activity",
      "Prediction Markets (Kalshi, Polymarket)",
      "Full Wealth Planning suite",
      "Trading Bots & Tax Harvesting",
    ],
    cta: "Upgrade to Elite — $250/mo",
  },
};

export function SubscriptionGate({ children, tier = "pro" }: SubscriptionGateProps) {
  const { isPro, isElite, isLoading } = useSubscription();

  const handleUpgrade = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan: tier },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to initiate upgrade. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-8 text-center">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
    );
  }

  const hasAccess = tier === "elite" ? isElite : isPro;
  if (hasAccess) return <>{children}</>;

  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock size={40} />
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {cfg.label} Required
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
        {cfg.description}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 text-left max-w-md mx-auto mb-10">
        {cfg.features.map((feat) => (
          <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-primary" />
            <span>{feat}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button onClick={handleUpgrade} size="lg" className="rounded-full px-8 h-12 text-base gap-2">
          <Icon size={18} /> {cfg.cta}
        </Button>
        <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base border-border/50">
          Learn More
        </Button>
      </div>
    </div>
  );
}
