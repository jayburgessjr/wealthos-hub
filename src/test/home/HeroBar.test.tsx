import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HeroBar } from "@/components/home/HeroBar";

const defaultProps = {
  greeting: "Good morning",
  displayName: "Jay",
  netWorth: 482340,
  budgetLeft: 840,
  budgetPct: 72,
  billsDueCount: 3,
};

describe("HeroBar", () => {
  it("renders greeting and display name", () => {
    render(<HeroBar {...defaultProps} />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
    expect(screen.getByText(/Jay/i)).toBeInTheDocument();
  });

  it("renders net worth chip", () => {
    render(<HeroBar {...defaultProps} />);
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("renders bills due chip with red color class when billsDueCount > 0", () => {
    render(<HeroBar {...defaultProps} />);
    const chip = screen.getByTestId("bills-due-chip");
    expect(chip).toHaveClass("text-red-400");
  });

  it("renders bills due chip as neutral when billsDueCount is 0", () => {
    render(<HeroBar {...defaultProps} billsDueCount={0} />);
    const chip = screen.getByTestId("bills-due-chip");
    expect(chip).not.toHaveClass("text-red-400");
  });

  it("renders budget left chip amber when under 20% remaining", () => {
    render(<HeroBar {...defaultProps} budgetPct={85} budgetLeft={100} />);
    const chip = screen.getByTestId("budget-left-chip");
    expect(chip).toHaveClass("text-amber-400");
  });
});
