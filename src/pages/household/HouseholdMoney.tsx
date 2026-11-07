import DashboardLayout from "@/components/layout/DashboardLayout";
import { useMoneySnapshot } from "@/hooks/useMoneySnapshot";
import { debtOrder, emergencyFund, netWorth, nextBestMoves, subscriptionReport } from "@/lib/money/engine";

const usd = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function HouseholdMoney() {
  const { data, isLoading, error, refetch } = useMoneySnapshot();

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
        <header>
          <h1 className="text-lg font-semibold text-foreground">Money coach</h1>
          <p className="text-xs text-muted-foreground">Built from the accounts, debts, bills and subscriptions you have entered. Not financial advice.</p>
        </header>

        {isLoading && <p role="status" className="text-sm text-muted-foreground">Reading your numbers...</p>}
        {error && (
          <p role="alert" className="text-sm text-bearish">
            Could not load your data: {(error as Error).message}{" "}
            <button type="button" onClick={() => refetch()} className="underline">Retry</button>
          </p>
        )}

        {data && <Body data={data} />}
      </div>
    </DashboardLayout>
  );
}

function Body({ data }: { data: NonNullable<ReturnType<typeof useMoneySnapshot>["data"]> }) {
  const s = data.snapshot;
  const nw = netWorth(s);
  const moves = nextBestMoves(s);
  const subs = subscriptionReport(s.subscriptions);
  const debts = debtOrder(s.debts);
  const fund = emergencyFund(s);

  return (
    <>
      {!data.hasHousehold && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground/80">
          No household is set up yet, so only your Invest balance is counted. Finish Household setup to get the full picture.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Net worth"><p className="text-2xl font-bold text-foreground">{usd(nw.total)}</p></Card>
        <Card title="Cash"><p className="text-xl font-semibold text-foreground">{usd(nw.cash)}</p></Card>
        <Card title="Invested"><p className="text-xl font-semibold text-foreground">{usd(nw.invested)}</p></Card>
        <Card title="Debt"><p className="text-xl font-semibold text-foreground">{usd(nw.debt)}</p></Card>
      </div>

      <Card title="Next best moves">
        <ol className="flex flex-col gap-2">
          {moves.map((m) => (
            <li key={m.kind + m.title} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
              <p className="text-sm font-semibold text-foreground">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.detail}</p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Emergency fund">
          {fund.monthlyNeed === 0 ? (
            <p className="text-sm text-muted-foreground">Add bills or debts to measure this.</p>
          ) : (
            <p className="text-sm text-foreground">
              {fund.monthsCovered} months covered. Target {usd(fund.target)}
              {fund.shortfall > 0 ? `, short by ${usd(fund.shortfall)}.` : ", met."}
            </p>
          )}
        </Card>
        <Card title="Subscriptions">
          {s.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">None recorded.</p>
          ) : (
            <p className="text-sm text-foreground">{usd(subs.monthlyTotal)} a month, {usd(subs.annualTotal)} a year.</p>
          )}
        </Card>
      </div>

      <Card title="Debt payoff order (highest rate first)">
        {debts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active debt recorded.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {debts.map((d) => (
              <li key={d.name} className="flex flex-wrap justify-between gap-2">
                <span className="text-foreground">{d.name}</span>
                <span className="text-muted-foreground">
                  {usd(d.balance)} at {d.rate ?? "unknown"}%, {d.monthsToPayoff === null ? "payment does not cover interest" : `${d.monthsToPayoff} months`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
