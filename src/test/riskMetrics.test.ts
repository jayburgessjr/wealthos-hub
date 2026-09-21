import { describe, it, expect } from "vitest";
import { sharpe, maxDrawdown, maxDrawdownFromEquity, calmar, var95 } from "@/lib/riskMetrics";

describe("sharpe", () => {
  it("returns null with fewer than 20 observations", () => {
    expect(sharpe([0.01, 0.02, -0.01])).toBeNull();
  });

  it("returns null when returns have zero variance", () => {
    expect(sharpe(Array(20).fill(0.001))).toBeNull();
  });

  it("matches the expected annualized value for a known series", () => {
    const returns = Array.from({ length: 10 }, () => [0.02, -0.01]).flat();
    expect(sharpe(returns)).toBeCloseTo(4.981508221639056, 10);
  });
});

describe("maxDrawdown", () => {
  it("is zero when equity only ever makes new highs", () => {
    expect(maxDrawdown([0.01, 0.02, 0.01, 0.03])).toBe(0);
  });

  it("finds the worst peak-to-trough decline", () => {
    expect(maxDrawdown([0.1, -0.2, 0.1])).toBeCloseTo(-0.2, 10);
  });
});

describe("maxDrawdownFromEquity", () => {
  it("is zero when the curve only ever makes new highs", () => {
    expect(maxDrawdownFromEquity([0, 500, 1200, 1800])).toBe(0);
  });

  it("finds the worst peak-to-trough decline on a dollar PnL curve", () => {
    expect(maxDrawdownFromEquity([0, 1000, -200, 400])).toBeCloseTo(-1.2, 10);
  });

  it("treats a non-positive peak as no drawdown", () => {
    expect(maxDrawdownFromEquity([0, -100, -50])).toBe(0);
  });
});

describe("calmar", () => {
  it("returns null when there is no drawdown", () => {
    expect(calmar([0.01, 0.02, 0.01, 0.03])).toBeNull();
  });

  it("divides annualized return by absolute max drawdown", () => {
    expect(calmar([0.1, -0.2, 0.1])).toBeCloseTo(0, 10);
  });
});

describe("var95", () => {
  it("computes the 5th percentile loss via linear interpolation", () => {
    const returns = Array.from({ length: 100 }, (_, i) => (i - 49) / 1000);
    expect(var95(returns)).toBeCloseTo(0.04405, 10);
  });
});
