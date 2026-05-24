import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { WealthPanel } from "@/components/home/WealthPanel";

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe("WealthPanel", () => {
  it("renders section label", () => {
    render(wrap(<WealthPanel />));
    expect(screen.getByText(/Wealth/i)).toBeInTheDocument();
  });

  it("renders Real Estate placeholder", () => {
    render(wrap(<WealthPanel />));
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("renders Dividends placeholder", () => {
    render(wrap(<WealthPanel />));
    expect(screen.getByText("Dividends")).toBeInTheDocument();
  });

  it("renders Tax Saved placeholder", () => {
    render(wrap(<WealthPanel />));
    expect(screen.getByText("Tax Saved YTD")).toBeInTheDocument();
  });

  it("renders Hub link", () => {
    render(wrap(<WealthPanel />));
    expect(screen.getByRole("link", { name: /Hub/i })).toBeInTheDocument();
  });
});
