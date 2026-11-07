import { act, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OnboardingAnswers } from "@/lib/onboardingProfile";

const auth = vi.hoisted(() => ({ user: { id: "u1", email: "a@b.test" } as { id: string; email: string } | null }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isAdmin: false }) }));

import { getDefaultNavMode, useNavMode } from "@/lib/navMode";
import { SidebarNavList } from "@/components/layout/Sidebar";

const answers = (experience: OnboardingAnswers["experience"]): OnboardingAnswers => ({
  goal: "grow_wealth",
  experience,
  startingAmount: 0,
  monthlyAmount: 0,
  hasEmergencyFund: false,
  hasHighInterestDebt: false,
  risk: "balanced",
  assetInterests: [],
});

beforeEach(() => {
  localStorage.clear();
  auth.user = { id: "u1", email: "a@b.test" };
});

describe("nav mode default", () => {
  it("is simple for new, some and no data; pro for experienced", () => {
    expect(getDefaultNavMode(answers("new"))).toBe("simple");
    expect(getDefaultNavMode(answers("some"))).toBe("simple");
    expect(getDefaultNavMode(null)).toBe("simple");
    expect(getDefaultNavMode(answers("experienced"))).toBe("pro");
  });

  it("hook picks pro for an experienced stored profile", () => {
    localStorage.setItem("bwh_onboarding_v1_u1", JSON.stringify(answers("experienced")));
    const { result } = renderHook(() => useNavMode());
    expect(result.current.mode).toBe("pro");
  });

  it("hook defaults to simple with no onboarding data", () => {
    const { result } = renderHook(() => useNavMode());
    expect(result.current.mode).toBe("simple");
  });

  it("toggle persists and wins over the default", () => {
    const { result, unmount } = renderHook(() => useNavMode());
    act(() => result.current.setMode("pro"));
    expect(result.current.mode).toBe("pro");
    expect(localStorage.getItem("bwh_nav_mode_v1")).toBe("pro");
    unmount();
    const again = renderHook(() => useNavMode());
    expect(again.result.current.mode).toBe("pro");
  });

  it("survives unavailable storage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useNavMode());
    expect(result.current.mode).toBe("simple");
    spy.mockRestore();
  });
});

describe("sidebar nav list", () => {
  it("simple mode shows six plain items", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <SidebarNavList isOpen />
      </MemoryRouter>,
    );
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names).toEqual(["Home", "My plan", "Money", "Grow", "Learn", "Coach"]);
    expect(screen.getByRole("link", { name: "Coach" })).toHaveAttribute("href", "/invs/strategy");
  });

  it("pro mode keeps the existing groups and adds a Home link", () => {
    localStorage.setItem("bwh_nav_mode_v1", "pro");
    render(
      <MemoryRouter initialEntries={["/invs/dashboard"]}>
        <SidebarNavList isOpen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: "Decision Hub" })).toBeInTheDocument();
    expect(screen.getByText("Orient")).toBeInTheDocument();
  });
});
