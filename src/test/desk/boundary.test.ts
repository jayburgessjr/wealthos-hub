// @vitest-environment node
// Static proof of the import boundary: agents and read-only jobs can never reach a trade-capable broker.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "supabase", "functions");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
const files = walk(ROOT).map((p) => ({ path: relative(ROOT, p), src: readFileSync(p, "utf8") }));
const importsBroker = (src: string) => /from\s+["'][^"']*\/broker\/[^"']*["']/.test(src);
const SUBMIT = /\b(submitOrder|cancelOrder|BrokerTradePort|makeBroker|AlpacaBroker|PaperBroker)\b/;

describe("broker import boundary", () => {
  it("only the allowlisted modules import anything under broker/", () => {
    const allowed = new Set([
      "desk-approve-order/index.ts", // the only function that builds a trade-capable broker
      "desk-account/index.ts", // read port
      "desk-mark-positions/index.ts", // read port
      "_shared/desk/pipeline/approve.ts", // takes a BrokerPort by injection
      "_shared/desk/pipeline/paper-store.ts", // DB-backed ledger for the paper broker (type + ledger only)
    ]);
    const offenders = files.filter((f) => !f.path.startsWith("_shared/desk/broker/") && importsBroker(f.src) && !allowed.has(f.path)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("agent modules never reference the broker, the approval flow, or any submit capability", () => {
    const agentFiles = files.filter((f) => ["_shared/desk/pipeline/agents.ts", "_shared/desk/scanners.ts", "desk-run-agent/index.ts"].includes(f.path));
    expect(agentFiles.length).toBe(3);
    for (const f of agentFiles) {
      expect(importsBroker(f.src), `${f.path} imports broker`).toBe(false);
      expect(SUBMIT.test(f.src), `${f.path} references a submit capability`).toBe(false);
      expect(/pipeline\/approve\.ts/.test(f.src), `${f.path} imports the approval flow`).toBe(false);
      expect(/insertOrder|insertApproval|ALPACA_/.test(f.src), `${f.path} touches orders, approvals or broker keys`).toBe(false);
    }
  });

  it("read-only functions never reference submit capabilities or the trade-capable factory", () => {
    for (const p of ["desk-account/index.ts", "desk-mark-positions/index.ts", "desk-scorecard/index.ts", "desk-reset-kill-switch/index.ts", "desk-claim-owner/index.ts"]) {
      const f = files.find((x) => x.path === p);
      expect(f, `${p} exists`).toBeTruthy();
      expect(SUBMIT.test(f!.src), `${p} references a submit capability`).toBe(false);
    }
  });

  it("the agent repository type exposes no order, approval or position writes", () => {
    const repo = files.find((f) => f.path === "_shared/desk/pipeline/repo.ts")!.src;
    const agentRepo = /export interface AgentRepo \{([\s\S]*?)\n\}/.exec(repo)![1];
    expect(/insertOrder|insertApproval|openPosition|updateOrder|setProposalStatus/.test(agentRepo)).toBe(false);
  });

  it("Alpaca and live-mode secrets are referenced only by the approve function and the read-only account/mark functions", () => {
    const users = files.filter((f) => /ALPACA_(KEY_ID|SECRET)/.test(f.src)).map((f) => f.path).sort();
    expect(users.every((p) => ["desk-approve-order/index.ts", "desk-account/index.ts", "desk-mark-positions/index.ts"].includes(p))).toBe(true);
  });

  it("no client code (src/) touches broker keys or imports the broker adapters", () => {
    const srcRoot = join(process.cwd(), "src");
    const clientFiles = walk(srcRoot).filter((p) => !p.includes(`${join("src", "test")}`));
    for (const p of clientFiles) {
      const s = readFileSync(p, "utf8");
      expect(/ALPACA_|ANTHROPIC_API_KEY|OPENAI_API_KEY|SERVICE_ROLE/.test(s), `${p} references a server secret`).toBe(false);
      expect(importsBroker(s), `${p} imports broker adapters`).toBe(false);
    }
  });
});
