import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SubscriptionGate } from "@/components/SubscriptionGate";

describe("SubscriptionGate", () => {
  it.each([undefined, "pro", "elite"] as const)("always renders children (tier %s) with no upsell", (tier) => {
    render(
      <SubscriptionGate tier={tier}>
        <p>secret feature</p>
      </SubscriptionGate>,
    );
    expect(screen.getByText("secret feature")).toBeInTheDocument();
    expect(screen.queryByText(/upgrade|required|\$\d+\/mo/i)).toBeNull();
  });
});
