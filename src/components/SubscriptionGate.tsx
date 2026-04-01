import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Lock, Rocket, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { isPro, isLoading } = useSubscription();

  const handleUpgrade = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout");
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

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Lock size={40} />
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Pro Feature Required
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
        Upgrade to WealthOS Pro for $29/mo to unlock full access to AI Advisor, Strategy Allocator, and institutional-grade signals.
      </p>
      
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 text-left max-w-md mx-auto mb-10">
        {[
          "Full AI Advisor access",
          "Advanced Strategy Allocator",
          "Real-time institutional signals",
          "Portfolio optimization tools",
        ].map((feat) => (
          <div key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 size={16} className="text-primary" />
            <span>{feat}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button onClick={handleUpgrade} size="lg" className="rounded-full px-8 h-12 text-base gap-2">
          <Rocket size={18} /> Upgrade Now — $29/mo
        </Button>
        <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base border-border/50">
          Learn More
        </Button>
      </div>
    </div>
  );
}
