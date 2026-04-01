import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { CreditCard, ShieldCheck, Rocket } from "lucide-react";

const RISK_TIERS = ['conservative', 'moderate', 'aggressive'] as const;

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isPro, subscriptionStatus, subscriptionPlan, isLoading: subLoading } = useSubscription();

  const [displayName, setDisplayName] = useState('');
  const [riskTier, setRiskTier] = useState<string>('moderate');
  const [maxDrawdown, setMaxDrawdown] = useState('20');
  const [monthlyContribution, setMonthlyContribution] = useState('0');
  const [reinvestment, setReinvestment] = useState('100');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['compound_settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('compound_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (user?.user_metadata?.display_name) {
      setDisplayName(user.user_metadata.display_name);
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      setRiskTier(settings.risk_tier ?? 'moderate');
      setMaxDrawdown(String(settings.max_drawdown_pct ?? 20));
      setMonthlyContribution(String(settings.monthly_contribution ?? 0));
      setReinvestment(String(settings.reinvestment_pct ?? 100));
    }
  }, [settings]);

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Profile saved'),
    onError: () => toast.error('Failed to save profile'),
  });

  const { mutate: saveSettings, isPending: savingSettings } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('compound_settings').upsert({
        user_id: user.id,
        risk_tier: riskTier,
        max_drawdown_pct: parseFloat(maxDrawdown) || 20,
        monthly_contribution: parseFloat(monthlyContribution) || 0,
        reinvestment_pct: parseFloat(reinvestment) || 100,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compound_settings', user?.id] });
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save settings'),
  });

  const { mutate: resetPortfolio, isPending: resetting } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      await supabase.from('positions').update({ status: 'closed' }).eq('user_id', user.id).eq('status', 'open');
      await supabase.from('portfolios').update({
        total_capital: 0, available_capital: 0, deployed_capital: 0,
        total_pnl: 0, total_pnl_pct: 0, win_rate: 0, total_trades: 0,
      }).eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success('Portfolio reset');
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to reset portfolio'),
  });

  return (
    <DashboardLayout>
      <h2 className="mb-6 font-display text-xl font-bold text-foreground">Settings</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Profile */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold text-foreground">Profile</h3>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground outline-none transition-fast focus:border-bullish"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Email</label>
            <input
              value={user?.email ?? ''}
              readOnly
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-muted-foreground outline-none cursor-default"
            />
          </div>
          <button
            onClick={() => saveProfile()}
            disabled={savingProfile}
            className="rounded-lg bg-bullish px-4 py-2 text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110 disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        {/* Capital Settings */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h3 className="font-display text-sm font-semibold text-foreground">Capital Settings</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-accent" />
              ))}
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Risk Tier</label>
                <select
                  value={riskTier}
                  onChange={(e) => setRiskTier(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground outline-none transition-fast focus:border-bullish"
                >
                  {RISK_TIERS.map((t) => (
                    <option key={t} value={t} className="capitalize bg-background">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Max Drawdown (%)</label>
                <input
                  type="number"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-fast focus:border-bullish"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Monthly Contribution ($)</label>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-fast focus:border-bullish"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Reinvestment Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={reinvestment}
                  onChange={(e) => setReinvestment(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-fast focus:border-bullish"
                />
              </div>
              <button
                onClick={() => saveSettings()}
                disabled={savingSettings}
                className="rounded-lg bg-bullish px-4 py-2 text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110 disabled:opacity-50"
              >
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </>
          )}
        </div>

        {/* Notifications (UI only — no backend yet) */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
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

        {/* Subscription */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-foreground">Subscription</h3>
            {isPro && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                <ShieldCheck size={12} /> Pro Member
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
            <div className="rounded-full bg-accent p-3 text-muted-foreground">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {subscriptionPlan === 'pro' ? 'WealthOS Pro Plan' : 'Free Tier'}
              </p>
              <p className="text-xs text-muted-foreground uppercase">
                Status: <span className={isPro ? 'text-bullish font-bold' : ''}>{subscriptionStatus}</span>
              </p>
            </div>
          </div>

          <div className="pt-2">
            {!isPro ? (
              <button
                onClick={async () => {
                  try {
                    const { data, error } = await supabase.functions.invoke('stripe-checkout');
                    if (error) throw error;
                    if (data?.url) window.location.href = data.url;
                  } catch (err) {
                    toast.error('Failed to initiate upgrade');
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground transition-fast hover:brightness-110"
              >
                <Rocket size={16} /> Upgrade to Pro — $29/mo
              </button>
            ) : (
              <button
                onClick={() => toast.info('Portal integration coming soon')}
                className="w-full rounded-lg border border-border bg-background py-2 text-sm font-semibold text-foreground transition-fast hover:bg-accent"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4 rounded-lg border border-bearish/30 bg-card p-5">
          <h3 className="font-display text-sm font-semibold text-bearish">Danger Zone</h3>
          <p className="text-xs text-muted-foreground">
            Close all open positions and zero out portfolio stats. This cannot be undone.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Reset portfolio? This will close all positions and cannot be undone.')) {
                resetPortfolio();
              }
            }}
            disabled={resetting}
            className="rounded-lg border border-bearish/30 bg-bearish/10 px-4 py-2 text-sm font-semibold text-bearish transition-fast hover:bg-bearish/20 disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset Portfolio'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
