import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq", "order", "limit", "insert", "update", "maybeSingle", "single"]) chain[k] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
  return { rpc: vi.fn(), from: vi.fn(() => chain) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from, auth: { signOut: vi.fn() } },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1", email: "a@b.test" } }) }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));

import Navbar from "@/components/layout/Navbar";

const renderNav = (path = "/invs/dashboard") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("Navbar Desk tab", () => {
  beforeEach(() => mocks.rpc.mockReset());

  it("shows the Desk tab for a desk owner", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    renderNav();
    expect(await screen.findByRole("button", { name: /^desk$/i })).toBeTruthy();
  });

  it("hides the Desk tab for a non-owner", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    renderNav();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^desk$/i })).toBeNull();
  });
});
