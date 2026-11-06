import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RISK_LIMITS } from "../../../supabase/functions/_shared/desk/risk/limits.ts";
import type { DeskAccount, ProposedOrderRow, ScorecardRow, ThesisRow } from "@/lib/desk/types";

const mocks = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "eq", "order", "limit", "insert", "update"]) chain[k] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
  return { rpc: vi.fn(), invoke: vi.fn(), from: vi.fn(() => chain) };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from, functions: { invoke: mocks.invoke } },
}));

import DeskPage from "@/pages/desk/DeskPage";
import { ProposalCard } from "@/components/desk/ApprovalQueue";
import { KillSwitchBanner } from "@/components/desk/HeaderStrip";
import { ScorecardView } from "@/components/desk/Scorecard";
import { computeScorecard } from "@/lib/desk/scorecard";

// Test fixtures only. The shipped UI never contains fabricated data.
const account = (over: Partial<DeskAccount> = {}, halted = false): DeskAccount => ({
  ok: true,
  mode: "paper",
  broker: "paper",
  account: { equity: 100_000, cash: 60_000, buyingPower: 120_000, asOf: "2026-11-06T15:00:00Z" },
  positions: [],
  state: { halted, halted_reason: halted ? "Drawdown limit" : null, halted_at: null, high_water_mark: 100_000, day_start_equity: 100_000, last_equity: 100_000 },
  quotes: { AAPL: 100 },
  limits: RISK_LIMITS,
  ...over,
});

const proposal = (over: Partial<ProposedOrderRow> = {}): ProposedOrderRow => ({
  id: "po-1",
  thesis_id: "th-1",
  instrument_id: "ins-1",
  agent_name: "momentum",
  intent: "open",
  position_id: null,
  structure: "stock",
  side: "buy",
  qty: 10,
  order_type: "market",
  limit_price: null,
  legs: null,
  stop_price: 95,
  stop_basis: "price",
  target_price: 112,
  max_loss: 51,
  rationale: null,
  status: "pending",
  expires_at: "2026-11-07T15:00:00Z",
  created_at: "2026-11-06T14:00:00Z",
  ...over,
});

const thesis: ThesisRow = {
  id: "th-1",
  instrument_id: "ins-1",
  agent_name: "momentum",
  direction: "long",
  bull_case: "Breakout above the 50 day on volume.",
  bear_case: "Macro print could reverse the tape.",
  catalysts: [{ event: "Earnings", date: "2026-11-20" }],
  entry_price: 100,
  stop_price: 95,
  target_price: 112,
  confidence: 0.64,
  invalidation: "Close below 95.",
  horizon_days: 20,
};

const wrap = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
};

const card = (p = proposal(), acct: DeskAccount | undefined = account()) =>
  wrap(<ProposalCard proposal={p} thesis={thesis} symbol="AAPL" account={acct} openPositions={[]} />);

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.invoke.mockReset();
});

describe("owner gate", () => {
  it("shows Not available and a claim button to a non-owner", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    wrap(<DeskPage />);
    expect(await screen.findByText("Not available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Claim desk" })).toBeInTheDocument();
    expect(screen.queryByText("Approval queue")).not.toBeInTheDocument();
  });

  it("claims through desk-claim-owner", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    mocks.invoke.mockResolvedValue({ data: { ok: true, owner: true }, error: null });
    wrap(<DeskPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Claim desk" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("desk-claim-owner", { body: {} }));
  });

  it("renders the terminal for the owner", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.invoke.mockResolvedValue({ data: account(), error: null });
    wrap(<DeskPage />);
    expect(await screen.findByLabelText("Approval queue")).toBeInTheDocument();
    expect(await screen.findByText("Equity")).toBeInTheDocument();
  });
});

describe("approval card", () => {
  it("shows thesis detail and enables Approve when the preview passes", () => {
    card();
    expect(screen.getByText("Breakout above the 50 day on volume.")).toBeInTheDocument();
    expect(screen.getByText("Close below 95.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("disables Approve with a reason when there is no stop", () => {
    card(proposal({ stop_price: null }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByText(/mandatory_stop/)).toBeInTheDocument();
  });

  it("disables Approve when the order is oversize", () => {
    card(proposal({ qty: 1000 }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getAllByText(/risk_per_trade|position_cap/).length).toBeGreaterThan(0);
  });

  it("disables Approve while the kill switch is engaged", () => {
    card(proposal(), account({}, true));
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getAllByText(/Kill switch is engaged/).length).toBeGreaterThan(0);
  });

  it("requires the exact live phrase in live mode", async () => {
    card(proposal(), account({ mode: "live" }));
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    const input = screen.getByLabelText(/Live confirmation/);
    fireEvent.change(input, { target: { value: "LIVE AAPL BUY 1" } });
    expect(approve).toBeDisabled();
    fireEvent.change(input, { target: { value: "LIVE AAPL BUY 10" } });
    expect(approve).toBeEnabled();
  });

  it("sends only proposed_order_id and decision in paper mode", async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, decision: "approved", order: { id: "o1", status: "filled" } }, error: null });
    card();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    const [fn, opts] = mocks.invoke.mock.calls[0];
    expect(fn).toBe("desk-approve-order");
    expect(Object.keys(opts.body).sort()).toEqual(["decision", "proposed_order_id"]);
    expect(opts.body).toEqual({ proposed_order_id: "po-1", decision: "approved" });
  });

  it("sends live_confirmation only in live mode, and nothing client-computed", async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, decision: "approved" }, error: null });
    card(proposal(), account({ mode: "live" }));
    fireEvent.change(screen.getByLabelText(/Live confirmation/), { target: { value: "LIVE AAPL BUY 10" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    const body = mocks.invoke.mock.calls[0][1].body;
    expect(Object.keys(body).sort()).toEqual(["decision", "live_confirmation", "proposed_order_id"]);
    expect(body.live_confirmation).toBe("LIVE AAPL BUY 10");
  });

  it("rejects without a live phrase", async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, decision: "rejected" }, error: null });
    card(proposal(), account({ mode: "live" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke.mock.calls[0][1].body).toEqual({ proposed_order_id: "po-1", decision: "rejected" });
  });

  it("re-previews while modifying and blocks Approve until saved", async () => {
    card();
    fireEvent.click(screen.getByRole("button", { name: "Modify" }));
    const qty = screen.getByLabelText("Qty");
    fireEvent.change(qty, { target: { value: "5000" } });
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByText(/Save or discard your edits/)).toBeInTheDocument();
  });
});

describe("kill switch banner", () => {
  it("shows when halted and offers a reset", () => {
    wrap(<KillSwitchBanner account={account({}, true)} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Kill switch engaged");
    expect(screen.getByRole("button", { name: "Reset kill switch" })).toBeInTheDocument();
  });

  it("renders nothing when clear", () => {
    wrap(<KillSwitchBanner account={account()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("scorecard", () => {
  const row = (id: string, kind: ScorecardRow["subject_kind"], agent: string, h: number, ret: number, bench: number): ScorecardRow => ({
    id,
    subject_kind: kind,
    subject_id: id,
    agent_name: agent,
    horizon_days: h,
    tn_date: `2026-10-${String(10 + Number(id.slice(1))).padStart(2, "0")}`,
    return_pct: ret,
    benchmark_return_pct: bench,
    alpha_pct: ret - bench,
  });
  const rows = [
    row("r1", "thesis", "momentum", 1, 0.02, 0.01),
    row("r2", "thesis", "momentum", 1, -0.01, 0.0),
    row("r3", "thesis", "earnings", 1, 0.03, 0.01),
    row("r4", "trade", "earnings", 5, 0.04, 0.02),
  ];

  it("computes stats from fractional rows", () => {
    const s = computeScorecard(rows);
    expect(s.overall.n).toBe(4);
    expect(s.overall.hitRate).toBeCloseTo(0.75);
    expect(s.horizons[1].n).toBe(3);
    expect(Object.keys(s.agents)).toEqual(["earnings", "momentum"]);
    expect(computeScorecard(rows, "trade").overall.n).toBe(1);
  });

  it("renders horizon and agent tables", () => {
    render(<ScorecardView stats={computeScorecard(rows)} />);
    expect(screen.getAllByText("75.0%").length).toBeGreaterThan(0);
    expect(screen.getByText("1 day")).toBeInTheDocument();
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.getByText("20 days")).toBeInTheDocument();
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByText("earnings")).toBeInTheDocument();
  });
});
