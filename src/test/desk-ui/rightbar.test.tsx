import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() }, from: vi.fn() } }));

import RightBar from "@/components/layout/RightBar";

const renderBar = () =>
  render(
    <MemoryRouter initialEntries={["/invs/dashboard"]}>
      <RightBar />
    </MemoryRouter>,
  );

describe("RightBar assistant", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("is collapsed by default and shows only the open button", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Open assistant" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Assistant" })).toBeNull();
    expect(screen.queryByText("Quick prompts")).toBeNull();
  });

  it("opens from the button, closes from the panel, and remembers the choice", () => {
    const first = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Open assistant" }));
    expect(screen.getByRole("complementary", { name: "Assistant" })).toBeTruthy();
    expect(localStorage.getItem("rightbar-open")).toBe("true");

    first.unmount();
    renderBar();
    expect(screen.getByRole("complementary", { name: "Assistant" })).toBeTruthy();

    const closers = screen.getAllByRole("button", { name: "Close assistant" });
    fireEvent.click(closers[closers.length - 1]);
    expect(screen.queryByRole("complementary", { name: "Assistant" })).toBeNull();
    expect(localStorage.getItem("rightbar-open")).toBe("false");
  });
});
