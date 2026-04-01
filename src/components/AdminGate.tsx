import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Navigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminGateProps {
  children: ReactNode;
}

export function AdminGate({ children }: AdminGateProps) {
  const { isAdmin, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-8 text-center">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-bearish/10 text-bearish animate-pulse">
          <ShieldAlert size={40} />
        </div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Restricted Area
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          You do not have the required permissions to access the Admin Hub.
        </p>
        <button 
          onClick={() => window.location.href = "/dashboard"}
          className="mt-8 rounded-full bg-accent px-8 py-3 font-semibold text-foreground transition-fast hover:bg-accent/80"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
