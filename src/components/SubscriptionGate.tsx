import { ReactNode } from "react";

interface SubscriptionGateProps {
  children: ReactNode;
  /** Kept so existing call sites compile. It no longer changes behavior. */
  tier?: "pro" | "elite";
}

/**
 * Private friends-and-family app: there are no plans, so nothing is gated.
 * The component API is unchanged so existing imports keep working.
 */
export function SubscriptionGate({ children }: SubscriptionGateProps) {
  return <>{children}</>;
}
