import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

const calls = vi.hoisted(() => ({ updates: [] as unknown[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: (p: unknown) => {
        calls.updates.push(p);
        return { eq: async () => ({ error: null }) };
      },
      upsert: async () => ({ error: null }),
    }),
  },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import Onboarding from "@/pages/Onboarding";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/home" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Onboarding page", () => {
  it("option cards are keyboard accessible", () => {
    renderPage();
    const card = screen.getByRole("radio", { name: /build a starter fund/i });
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card).toHaveAttribute("aria-checked", "false");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(screen.getByRole("radio", { name: /build a starter fund/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("amount inputs have labels and no preset values", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: /pay down debt/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(await screen.findByRole("radio", { name: /new to this/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    const start = (await screen.findByLabelText(/money you have to start with/i)) as HTMLInputElement;
    expect(start.value).toBe("");
    expect((screen.getByLabelText(/each month/i) as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  it("skip marks onboarding complete and lands on /home", async () => {
    calls.updates.length = 0;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(await screen.findByText("home page")).toBeInTheDocument();
    expect(calls.updates).toContainEqual({ onboarding_completed: true });
  });
});
