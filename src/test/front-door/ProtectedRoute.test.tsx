import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string }, loading: false },
  demo: { isDemoMode: false },
}));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/DemoProvider", () => ({ useDemo: () => state.demo }));

import ProtectedRoute from "@/components/ProtectedRoute";

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/home"]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<div>home page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("ProtectedRoute demo behavior", () => {
  beforeEach(() => {
    state.auth = { user: null, loading: false };
    state.demo = { isDemoMode: false };
  });

  it("redirects logged-out visitors to login", () => {
    renderAt();
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("lets logged-out visitors in when demo mode is on", () => {
    state.demo = { isDemoMode: true };
    renderAt();
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("lets signed-in users in", () => {
    state.auth = { user: { id: "u1" }, loading: false };
    renderAt();
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("still waits while auth is loading", () => {
    state.auth = { user: null, loading: true };
    state.demo = { isDemoMode: true };
    renderAt();
    expect(screen.queryByText("home page")).toBeNull();
  });
});
