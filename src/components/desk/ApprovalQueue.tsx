import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount, useDecideOrder, useInstruments, useOpenPositions, usePatchProposal, usePendingProposals, useTheses } from "@/lib/desk/hooks";
import { money, pct, price, qtyText, shortTime, toNum } from "@/lib/desk/format";
import { approvalBlockers, buildOrder, draftFrom, livePhrase, previewRisk, snapshotPositions, type Draft } from "@/lib/desk/preview";
import type { OpenPositionSnapshot } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import type { DeskAccount, ProposedOrderRow, ThesisRow } from "@/lib/desk/types";
import { FIELD, GHOST_BTN, MICRO, NUM, ORANGE_BG, ORANGE_TEXT, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

interface CardProps {
  proposal: ProposedOrderRow;
  thesis?: ThesisRow;
  symbol: string;
  account?: DeskAccount;
  openPositions: OpenPositionSnapshot[];
}

function Field({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className={MICRO}>
        {label}
      </label>
      <Input id={id} inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, NUM, "w-24 disabled:opacity-100")} />
    </div>
  );
}

export function ProposalCard({ proposal: p, thesis, symbol, account, openPositions }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(p));
  const [typed, setTyped] = useState("");
  const decide = useDecideOrder();
  const patch = usePatchProposal();

  const saved = useMemo(() => draftFrom(p), [p]);
  const dirty = (Object.keys(saved) as (keyof Draft)[]).some((k) => saved[k] !== draft[k]);
  const mode = account?.mode ?? "paper";
  const decision = useMemo(() => (account ? previewRisk(buildOrder(p, symbol, draft), account, openPositions) : null), [account, p, symbol, draft, openPositions]);
  const expected = livePhrase(symbol, p.side, draft.qty);
  const blockers = approvalBlockers({
    decision,
    halted: account?.state.halted ?? false,
    intent: p.intent,
    mode,
    typed,
    expectedPhrase: expected,
    dirty,
    busy: decide.isPending || patch.isPending,
  });
  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (decisionValue: "approved" | "rejected") => {
    decide.mutate(
      {
        proposed_order_id: p.id,
        decision: decisionValue,
        ...(decisionValue === "approved" && mode === "live" ? { live_confirmation: typed } : {}),
      },
      {
        onSuccess: (res) => {
          if (res.ok === false) {
            toast.error(res.error ?? res.risk?.reasons.join("; ") ?? "The server did not accept this decision.");
          } else if (decisionValue === "rejected") {
            toast.success(`${symbol} proposal rejected`);
          } else {
            toast.success(`${symbol} order ${res.order?.status ?? "submitted"}`);
          }
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const save = () => {
    const qty = Number(draft.qty);
    const stop = Number(draft.stop);
    if (!(qty > 0) || !(stop > 0)) {
      toast.error("Quantity and stop must be positive numbers.");
      return;
    }
    const limit = draft.limit.trim() === "" ? null : Number(draft.limit);
    const target = draft.target.trim() === "" ? null : Number(draft.target);
    if ((limit !== null && !(limit > 0)) || (target !== null && !(target > 0))) {
      toast.error("Limit and target must be positive numbers or empty.");
      return;
    }
    patch.mutate(
      { id: p.id, qty, limit_price: limit, stop_price: stop, target_price: target },
      {
        onSuccess: () => {
          toast.success("Changes saved");
          setEditing(false);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const discard = () => {
    setDraft(saved);
    setEditing(false);
  };

  const reasonsId = `reasons-${p.id}`;

  return (
    <article aria-label={`Proposal ${symbol}`} className="border-t border-border px-3 py-2 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={cn(NUM, "text-sm font-bold text-foreground")}>{symbol}</span>
        <span className="font-semibold uppercase text-foreground">{p.side}</span>
        <span className="text-muted-foreground">{p.structure.replace(/_/g, " ")}</span>
        <span className="text-muted-foreground">from {p.agent_name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Expires {shortTime(p.expires_at)}</span>
      </div>

      {thesis && (
        <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-foreground/80 md:grid-cols-2">
          <div>
            <dt className={MICRO}>Bull case</dt>
            <dd>{thesis.bull_case}</dd>
          </div>
          <div>
            <dt className={MICRO}>Bear case</dt>
            <dd>{thesis.bear_case}</dd>
          </div>
          <div>
            <dt className={MICRO}>Catalysts</dt>
            <dd>{(thesis.catalysts ?? []).length === 0 ? "None listed" : (thesis.catalysts ?? []).map((c) => (c.date ? `${c.event} (${c.date})` : c.event)).join("; ")}</dd>
          </div>
          <div>
            <dt className={MICRO}>Invalidation</dt>
            <dd>{thesis.invalidation}</dd>
          </div>
          <div>
            <dt className={MICRO}>Confidence</dt>
            <dd className={NUM}>{(toNum(thesis.confidence) * 100).toFixed(0)}%</dd>
          </div>
        </dl>
      )}
      {!thesis && p.rationale && <p className="mt-1 text-foreground/80">{p.rationale}</p>}

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <Field id={`qty-${p.id}`} label="Qty" value={draft.qty} onChange={set("qty")} disabled={!editing} />
        {p.order_type === "limit" && <Field id={`limit-${p.id}`} label="Limit" value={draft.limit} onChange={set("limit")} disabled={!editing} />}
        <Field id={`stop-${p.id}`} label="Stop" value={draft.stop} onChange={set("stop")} disabled={!editing} />
        <Field id={`target-${p.id}`} label="Target" value={draft.target} onChange={set("target")} disabled={!editing} />
        {!editing ? (
          <Button type="button" onClick={() => setEditing(true)} className={GHOST_BTN}>
            Modify
          </Button>
        ) : (
          <>
            <Button type="button" onClick={save} disabled={patch.isPending || !dirty} className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}>
              Save changes
            </Button>
            <Button type="button" onClick={discard} className={GHOST_BTN}>
              Discard
            </Button>
          </>
        )}
      </div>

      <div className="mt-2 border border-border bg-muted/40 px-2 py-1.5" aria-label={`Risk preview for ${symbol}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={MICRO}>Risk preview (advisory)</span>
          <span className="text-[10px] text-muted-foreground">The server recomputes risk with its own quote before anything reaches the broker.</span>
        </div>
        {!decision ? (
          <p className="text-muted-foreground">Waiting for account data.</p>
        ) : (
          <>
            <p className={cn(NUM, "mt-0.5 text-foreground/80")}>
              Quote {account?.quotes?.[symbol] ? price(account.quotes[symbol]) : "n/a"} | Max qty {qtyText(decision.sized.maxQty)} | Risk {money(decision.sized.riskAmount)} | Exposure {money(decision.sized.exposure)}
              {account ? ` | ${pct(decision.sized.riskAmount / account.account.equity)} of equity` : ""}
            </p>
            <ul className="mt-0.5 grid gap-x-4 md:grid-cols-2">
              {decision.checks.map((c) => (
                <li key={c.rule} className="flex gap-2">
                  <span className={cn("w-8 shrink-0 font-semibold uppercase", c.passed ? "text-muted-foreground" : ORANGE_TEXT)}>{c.passed ? "Pass" : "Fail"}</span>
                  <span className="text-foreground/80">{c.message}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {mode === "live" && (
        <div className="mt-2 flex flex-col gap-0.5">
          <label htmlFor={`live-${p.id}`} className={MICRO}>
            Live confirmation: type {expected}
          </label>
          <Input id={`live-${p.id}`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={cn(FIELD, NUM, "w-72")} />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={() => submit("approved")}
          disabled={blockers.length > 0}
          aria-describedby={blockers.length > 0 ? reasonsId : undefined}
          className={cn("h-7 rounded-sm px-3 text-xs", ORANGE_BG)}
        >
          Approve
        </Button>
        <Button type="button" onClick={() => submit("rejected")} disabled={decide.isPending || patch.isPending} className={GHOST_BTN}>
          Reject
        </Button>
        {decide.isPending && <span role="status" className="text-muted-foreground">Sending decision...</span>}
      </div>
      {blockers.length > 0 && (
        <ul id={reasonsId} className="mt-1 list-disc pl-4 text-muted-foreground">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ApprovalQueue() {
  const proposals = usePendingProposals();
  const theses = useTheses();
  const instruments = useInstruments();
  const positions = useOpenPositions();
  const account = useAccount();

  const bySymbol = useMemo(() => new Map((instruments.data ?? []).map((i) => [i.id, i])), [instruments.data]);
  const thesisById = useMemo(() => new Map((theses.data ?? []).map((t) => [t.id, t])), [theses.data]);
  const snaps = useMemo(() => snapshotPositions(positions.data ?? [], bySymbol), [positions.data, bySymbol]);

  const loading = proposals.isLoading || instruments.isLoading;
  const error = (proposals.error ?? instruments.error) as Error | null;

  return (
    <Panel title="Approval queue" aside={<span className={cn(NUM, "text-xs text-muted-foreground")}>{(proposals.data ?? []).length} pending</span>}>
      <PanelState
        isLoading={loading}
        error={error}
        onRetry={() => {
          proposals.refetch();
          instruments.refetch();
        }}
        isEmpty={(proposals.data ?? []).length === 0}
        empty="Order proposals from agents wait here for your decision. Nothing is sent to the broker until you approve."
      >
        {account.error && (
          <p role="alert" className="border-b border-border px-3 py-1.5 text-foreground/80">
            Account data failed to load, so risk previews and approval are unavailable: {(account.error as Error).message}
          </p>
        )}
        {(proposals.data ?? []).map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            thesis={p.thesis_id ? thesisById.get(p.thesis_id) : undefined}
            symbol={bySymbol.get(p.instrument_id)?.symbol ?? "?"}
            account={account.data}
            openPositions={snaps}
          />
        ))}
      </PanelState>
    </Panel>
  );
}
