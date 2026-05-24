import { Link } from "react-router-dom";

export function WealthPanel() {
  return (
    <div className="rounded-xl border border-border border-t-2 border-t-indigo-400 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-indigo-400">
            💎 Wealth
          </p>
          <p className="mt-0.5 text-sm font-bold">Alt Assets</p>
        </div>
        <Link
          to="/real-estate"
          className="rounded-md bg-indigo-400 px-2 py-1 text-xs font-bold text-black hover:bg-indigo-300 transition-colors"
        >
          → Hub
        </Link>
      </div>

      <div className="space-y-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Real Estate</p>
          <p className="font-mono text-base font-bold mt-0.5">$—</p>
          <Link
            to="/real-estate"
            className="text-xs text-indigo-400 hover:underline"
          >
            Set up →
          </Link>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Dividends</p>
          <p className="font-mono text-base font-bold mt-0.5">$—</p>
          <Link
            to="/dividend-tracker"
            className="text-xs text-indigo-400 hover:underline"
          >
            Set up →
          </Link>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Tax Saved YTD</p>
          <p className="font-mono text-base font-bold mt-0.5">$—</p>
          <Link
            to="/tax-harvesting"
            className="text-xs text-indigo-400 hover:underline"
          >
            Set up →
          </Link>
        </div>
      </div>
    </div>
  );
}
