import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { HouseholdPanel } from "@/components/home/HouseholdPanel";

const defaultProps = {
  budgetSpent: 3456,
  budgetTotal: 4800,
  billsDueCount: 3,
  activeGoalsCount: 4,
  monthlyNet: 1200,
};

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe("HouseholdPanel", () => {
  it("renders section label", () => {
    render(wrap(<HouseholdPanel {...defaultProps} />));
    expect(screen.getByText(/Household/i)).toBeInTheDocument();
  });

  it("renders budget progress bar", () => {
    render(wrap(<HouseholdPanel {...defaultProps} />));
    expect(screen.getByTestId("budget-bar")).toBeInTheDocument();
  });

  it("renders bills due count", () => {
    render(wrap(<HouseholdPanel {...defaultProps} />));
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders active goals count", () => {
    render(wrap(<HouseholdPanel {...defaultProps} />));
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders monthly net in green when positive", () => {
    render(wrap(<HouseholdPanel {...defaultProps} />));
    const net = screen.getByTestId("monthly-net");
    expect(net).toHaveClass("text-emerald-500");
  });

  it("renders monthly net in red when negative", () => {
    render(wrap(<HouseholdPanel {...defaultProps} monthlyNet={-200} />));
    const net = screen.getByTestId("monthly-net");
    expect(net).toHaveClass("text-red-400");
  });
});
