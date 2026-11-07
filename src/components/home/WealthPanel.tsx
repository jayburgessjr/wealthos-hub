import { Link } from "react-router-dom";

export function WealthPanel() {
  return (
    <div className="rounded-xl border border-border border-t-2 border-t-indigo-400 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-400">
            Wealth
          </p>
          <p className="mt-0.5 text-sm font-bold">Property, dividends and taxes</p>
        </div>
        <Link
          to="/wealth"
          className="rounded-md bg-indigo-400 px-2 py-1 text-xs font-bold text-black hover:bg-indigo-300 transition-colors"
        >
          → Hub
        </Link>
      </div>

      <div className="space-y-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Real Estate</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Not tracked yet</p>
          <Link
            to="/wealth/assets/real-estate"
            className="text-xs text-indigo-400 hover:underline"
          >
            Start tracking
          </Link>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Dividends</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Not tracked yet</p>
          <Link
            to="/wealth/assets/dividends"
            className="text-xs text-indigo-400 hover:underline"
          >
            Start tracking
          </Link>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Tax Saved YTD</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Not tracked yet</p>
          <Link
            to="/wealth/protection/tax-harvesting"
            className="text-xs text-indigo-400 hover:underline"
          >
            Start tracking
          </Link>
        </div>
      </div>
    </div>
  );
}
