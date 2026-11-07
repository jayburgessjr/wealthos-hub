// @vitest-environment node
// Static proof of the import boundary: agents and read-only jobs can never reach a trade-capable broker.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";
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
      "desk-reconcile-orders/index.ts", // read port (getOrder by client id); never submits
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
    for (const p of ["desk-account/index.ts", "desk-mark-positions/index.ts", "desk-scorecard/index.ts", "desk-reset-kill-switch/index.ts", "desk-claim-owner/index.ts", "desk-reconcile-orders/index.ts"]) {
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
    expect(users.every((p) => ["desk-approve-order/index.ts", "desk-account/index.ts", "desk-mark-positions/index.ts", "desk-reconcile-orders/index.ts"].includes(p))).toBe(true);
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

// ---------------------------------------------------------------------------------------------
// Transitive import graph (audit B11). A text check on the entry files misses a leak through a helper, so build the
// real graph from relative imports and assert on the closure of every entry point.
// ---------------------------------------------------------------------------------------------
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
const SPEC = /(?:\bimport\s*(?:type\s*)?(?:[\w*${}\s,]+?\s*from\s*)?|\bexport\s*(?:type\s*)?(?:[\w*${}\s,]+?\s*)from\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;

/** Relative import specifiers of a module (static, side-effect, re-export and dynamic import). Comments are ignored. */
export function importSpecs(src: string): string[] {
  return [...stripComments(src).matchAll(SPEC)].map((m) => m[1]).filter((x) => x.startsWith("."));
}

/** All modules reachable from `entry`, as paths relative to the functions root (posix). */
export function closure(entry: string, sources: Map<string, string>): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const src = sources.get(cur);
    if (src === undefined) continue;
    for (const spec of importSpecs(src)) {
      const target = posix.normalize(posix.join(posix.dirname(cur), spec));
      stack.push(sources.has(target) ? target : sources.has(`${target}.ts`) ? `${target}.ts` : target);
    }
  }
  return seen;
}

const graphSources = new Map(files.map((f) => [f.path.split("\\").join("/"), f.src]));
const reach = (entry: string) => closure(entry, graphSources);
const FORBIDDEN_FOR_NON_TRADE = ["_shared/desk/broker/alpaca.ts", "_shared/desk/broker/factory.ts", "_shared/desk/pipeline/approve.ts"];

describe("import graph boundary (transitive)", () => {
  it("the closure builder follows static, re-export, dynamic and side-effect imports and ignores comments", () => {
    const m = new Map<string, string>([
      ["a.ts", `import { x } from "./b.ts";\n// import "./never.ts";\n/* import "./never2.ts" */\nconst l = () => import("./c.ts");`],
      ["b.ts", `export { y } from "./broker/trade.ts";`],
      ["c.ts", `import "./d.ts";`],
      ["d.ts", ""], ["broker/trade.ts", ""], ["never.ts", ""], ["never2.ts", ""],
    ]);
    const r = closure("a.ts", m);
    expect([...r].sort()).toEqual(["a.ts", "b.ts", "broker/trade.ts", "c.ts", "d.ts"]);
  });

  it("a leak through a helper is caught even when the entry file looks clean", () => {
    const m = new Map<string, string>([["agent.ts", `import { h } from "./helper.ts";`], ["helper.ts", `import { A } from "./broker/alpaca.ts";`], ["broker/alpaca.ts", ""]]);
    expect([...closure("agent.ts", m)].some((p) => p.startsWith("broker/"))).toBe(true);
  });

  it("agent entry points reach nothing under broker/, nor the approval flow, settlement or reconciler", () => {
    for (const entry of ["_shared/desk/pipeline/agents.ts", "_shared/desk/scanners.ts", "desk-run-agent/index.ts"]) {
      expect(graphSources.has(entry), `${entry} exists`).toBe(true);
      const bad = [...reach(entry)].filter((p) => p.startsWith("_shared/desk/broker/") || ["_shared/desk/pipeline/approve.ts", "_shared/desk/pipeline/settle.ts", "_shared/desk/pipeline/reconcile.ts"].includes(p));
      expect(bad, `${entry} transitively reaches`).toEqual([]);
    }
  });

  it("read-only and owner functions never reach the Alpaca adapter, the broker factory or the approval flow", () => {
    for (const entry of ["desk-account", "desk-mark-positions", "desk-reconcile-orders", "desk-scorecard", "desk-reset-kill-switch", "desk-claim-owner", "desk-run-agent"].map((f) => `${f}/index.ts`)) {
      expect(graphSources.has(entry), `${entry} exists`).toBe(true);
      const bad = [...reach(entry)].filter((p) => FORBIDDEN_FOR_NON_TRADE.includes(p));
      expect(bad, `${entry} transitively reaches`).toEqual([]);
    }
  });

  it("only desk-approve-order (directly or via approve.ts) imports the broker factory, the Alpaca adapter or the approval flow", () => {
    const importers = (target: string) => [...graphSources.keys()].filter((k) => k !== target && reach(k).has(target) && [...importSpecs(graphSources.get(k)!)].some((s) => posix.normalize(posix.join(posix.dirname(k), s)).replace(/\.ts$/, "") === target.replace(/\.ts$/, "")));
    expect(importers("_shared/desk/broker/factory.ts").sort()).toEqual(["desk-approve-order/index.ts"]);
    expect(importers("_shared/desk/pipeline/approve.ts").sort()).toEqual(["desk-approve-order/index.ts"]);
    expect(importers("_shared/desk/broker/alpaca.ts").sort()).toEqual(["_shared/desk/broker/factory.ts"]);
  });

  it("the reconciler can only read from the broker: it imports no submit-capable type or class", () => {
    const src = graphSources.get("_shared/desk/pipeline/reconcile.ts")!;
    expect(SUBMIT.test(stripComments(src))).toBe(false);
    expect(importsBroker(stripComments(src))).toBe(false);
  });
});
