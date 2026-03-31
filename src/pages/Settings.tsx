import DashboardLayout from "@/components/layout/DashboardLayout";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <h2 className="mb-6 font-display text-xl font-bold text-foreground">Settings</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Profile</h3>
          {["Display Name", "Email"].map((l) => (
            <div key={l}>
              <label className="mb-1 block text-xs text-muted-foreground">{l}</label>
              <input
                placeholder={l}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground outline-none focus:border-bullish transition-fast"
              />
            </div>
          ))}
          <button className="rounded-lg bg-bullish px-4 py-2 text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110">
            Save Profile
          </button>
        </div>

        {/* Risk Controls */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Risk Controls</h3>
          {[
            { label: "Max Position Size (%)", placeholder: "15" },
            { label: "Max Portfolio Risk (%)", placeholder: "25" },
            { label: "Stop Loss Default (%)", placeholder: "5" },
            { label: "Daily Loss Limit ($)", placeholder: "500" },
          ].map((f) => (
            <div key={f.label}>
              <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
              <input
                type="number"
                placeholder={f.placeholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-bullish transition-fast"
              />
            </div>
          ))}
          <button className="rounded-lg bg-bullish px-4 py-2 text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110">
            Update Risk Controls
          </button>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-foreground">Notifications</h3>
          {["New Signals", "Position Alerts", "P&L Updates", "Market Regime Changes"].map((n) => (
            <div key={n} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{n}</span>
              <div className="h-5 w-9 cursor-pointer rounded-full bg-bullish p-0.5">
                <div className="h-4 w-4 translate-x-4 rounded-full bg-primary-foreground transition-fast" />
              </div>
            </div>
          ))}
        </div>

        {/* Danger */}
        <div className="rounded-lg border border-bearish/30 bg-card p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold text-bearish">Danger Zone</h3>
          <p className="text-xs text-muted-foreground">Reset all positions and start fresh. This action cannot be undone.</p>
          <button className="rounded-lg border border-bearish/30 bg-bearish/10 px-4 py-2 text-sm font-semibold text-bearish transition-fast hover:bg-bearish/20">
            Reset Portfolio
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
