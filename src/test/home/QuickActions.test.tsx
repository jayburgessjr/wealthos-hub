import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { QuickActions } from "@/components/home/QuickActions";

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe("QuickActions", () => {
  it("renders all 5 action links", () => {
    render(wrap(<QuickActions billsDueCount={0} />));
    expect(screen.getByText("Log Expense")).toBeInTheDocument();
    expect(screen.getByText("Add Trade")).toBeInTheDocument();
    expect(screen.getByText("View Signals")).toBeInTheDocument();
    expect(screen.getByText("Pay Bills")).toBeInTheDocument();
    expect(screen.getByText("View Tasks")).toBeInTheDocument();
  });

  it("shows red badge on Pay Bills when billsDueCount > 0", () => {
    render(wrap(<QuickActions billsDueCount={3} />));
    expect(screen.getByTestId("bills-badge")).toHaveTextContent("3");
  });

  it("hides badge on Pay Bills when billsDueCount is 0", () => {
    render(wrap(<QuickActions billsDueCount={0} />));
    expect(screen.queryByTestId("bills-badge")).not.toBeInTheDocument();
  });
});
