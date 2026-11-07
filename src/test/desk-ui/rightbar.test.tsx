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

const panel = () => screen.queryByRole("complementary", { name: "Assistant" });
// The pin button is the rail's first child; the panel's close button also matches once open, so take the first.
const rail = () => screen.getAllByRole("button", { name: /assistant/i })[0].parentElement as HTMLElement;

describe("RightBar assistant", () => {
  beforeEach(() => {
    localStorage.clear();
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("is a collapsed rail by default", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Pin assistant open" })).toBeTruthy();
    expect(panel()).toBeNull();
  });

  it("pops out on hover and closes on mouse leave without pinning", () => {
    renderBar();
    fireEvent.mouseEnter(rail());
    expect(panel()).toBeTruthy();
    fireEvent.mouseLeave(rail());
    expect(panel()).toBeNull();
    expect(localStorage.getItem("rightbar-open")).toBeNull();
  });

  it("stays open after the mouse leaves once pinned, and remembers across reloads", () => {
    const first = renderBar();
    fireEvent.mouseEnter(rail());
    fireEvent.click(screen.getByRole("button", { name: "Pin assistant open" }));
    expect(localStorage.getItem("rightbar-open")).toBe("true");
    fireEvent.mouseLeave(rail());
    expect(panel()).toBeTruthy();

    first.unmount();
    renderBar();
    expect(panel()).toBeTruthy();
  });

  it("the close button unpins and hides the panel", () => {
    localStorage.setItem("rightbar-open", "true");
    renderBar();
    expect(panel()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close assistant" }));
    expect(panel()).toBeNull();
    expect(localStorage.getItem("rightbar-open")).toBe("false");
  });
});
