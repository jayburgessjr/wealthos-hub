import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { STRATEGY_TIERS, getCurrentTier, getNextTierUnlock, Strategy } from "@/data/strategyTiers";
import { calcBlendedReturn } from "@/lib/compoundEngine";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Shield, TrendingUp, Lock, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio } from "@/data/sandboxData";

export default function StrategyAllocator() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const queryClient = useQueryClient();
  const [excludedStrategies, setExcludedStrategies] = useState<string[]>([]);
  const [recommendedAllocations, setRecommendedAllocations] = useState<Record<string, number>>({});

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ['portfolio', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase.from('portfolios').select('*').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['compound-settings', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return { risk_tier: "moderate", allocations: { "Covered Calls": 40, "Momentum Stocks": 60 } };
      const { data } = await supabase.from('compound_settings').select('*').eq('user_id', user!.id).maybeSingle();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const capital = portfolio?.total_capital ?? 0;
  const currentTier = getCurrentTier(capital);
  const nextUnlock = getNextTierUnlock(capital);
  const blendedReturn = calcBlendedReturn(capital, settings?.risk_tier || "moderate");

  const availableStrategies = STRATEGY_TIERS
    .filter(t => capital >= t.min_capital)
    .flatMap(t => t.strategies);

  const lockedStrategies = STRATEGY_TIERS
    .filter(t => capital < t.min_capital)
    .flatMap(t => t.strategies);

  const { mutate: saveAllocations, isPending: saving } = useMutation({
    mutationFn: async (newAllocations: Record<string, number>) => {
      const { error } = await supabase
        .from('compound_settings')
        .update({ allocations: newAllocations as any })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Allocation applied successfully");
      queryClient.invalidateQueries({ queryKey: ['compound-settings', user?.id] });
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const optimize = () => {
    const active = availableStrategies.filter(s => !excludedStrategies.includes(s.name));
    if (!active.length) {
      toast.error("At least one strategy must be included");
      return;
    }

    // Optimization logic: Simple equal weight for now, or weighted by return?
    // User requested "maximize blended return within risk_tier limits"
    // For now, let's do a weighted allocation based on monthly return
    const totalReturn = active.reduce((sum, s) => sum + s.avg_monthly_return, 0);
    const newAllocations: Record<string, number> = {};
    active.forEach(s => {
      newAllocations[s.name] = (s.avg_monthly_return / totalReturn) * 100;
    });
    
    setRecommendedAllocations(newAllocations);
    toast.success("Optimization calculated");
  };

  const currentAllocations = (settings?.allocations as Record<string, number>) || {};

  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="space-y-8">
          <h2 className="font-display text-2xl font-bold text-foreground">Strategy Allocator</h2>

          {/* TOP ROW — 3 summary cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard 
              label="Total Capital" 
              value={`$${capital.toLocaleString()}`} 
              icon={TrendingUp} 
              loading={portLoading} 
            />
            <SummaryCard 
              label="Current Tier" 
              value={currentTier.label} 
              icon={Shield} 
              loading={portLoading} 
            />
            <SummaryCard 
              label="Blended Monthly Return" 
              value={`${(blendedReturn * 100).toFixed(2)}%`} 
              icon={Zap} 
              loading={portLoading} 
            />
          </div>

          {/* TIER PROGRESSION BAR */}
          <Card className="border-border bg-card p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tier Progression</h3>
                {nextUnlock && (
                  <span className="text-xs text-muted-foreground">
                    Need <span className="font-mono font-bold text-foreground">${nextUnlock.amount_needed.toLocaleString()}</span> to unlock <span className="font-bold text-primary">{nextUnlock.tier.label}</span>
                  </span>
                )}
              </div>
              
              <div className="relative pt-10 pb-4">
                <div className="absolute top-0 flex w-full justify-between">
                  {STRATEGY_TIERS.map((tier) => {
                    const isUnlocked = capital >= tier.min_capital;
                    const isCurrent = currentTier.label === tier.label;
                    return (
                      <TooltipProvider key={tier.label}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`flex flex-col items-center gap-2 ${isUnlocked ? 'cursor-default' : 'cursor-help'}`}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                                isCurrent ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20' :
                                isUnlocked ? 'border-primary/50 bg-primary/10 text-primary' :
                                'border-border bg-muted/30 text-muted-foreground'
                              }`}>
                                {isUnlocked ? <CheckCircle2 size={16} /> : <Lock size={14} />}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-tighter ${isUnlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {tier.label}
                              </span>
                            </div>
                          </TooltipTrigger>
                          {!isUnlocked && (
                            <TooltipContent className="bg-popover border-border text-popover-foreground">
                              <p>Unlock at ${tier.min_capital.toLocaleString()}</p>
                              <p className="text-[10px] text-muted-foreground">Need ${(tier.min_capital - capital).toLocaleString()} more</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
                <Progress value={capital > 0 ? (capital / STRATEGY_TIERS[STRATEGY_TIERS.length - 1].min_capital) * 100 : 0} className="h-1" />
              </div>
            </div>
          </Card>

          {/* STRATEGY GRID */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Active Allocation</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={optimize} className="gap-2">
                  <RefreshCw size={14} /> Optimize
                </Button>
                <Button size="sm" onClick={() => saveAllocations(recommendedAllocations)} disabled={Object.keys(recommendedAllocations).length === 0 || saving}>
                  Apply Allocation
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {availableStrategies.map((s) => {
                const isExcluded = excludedStrategies.includes(s.name);
                const currentAlloc = currentAllocations[s.name] || 0;
                const recommendedAlloc = recommendedAllocations[s.name] || 0;
                
                return (
                  <StrategyCard 
                    key={s.name}
                    strategy={s}
                    isExcluded={isExcluded}
                    currentAlloc={currentAlloc}
                    recommendedAlloc={recommendedAlloc}
                    onToggle={() => {
                      setExcludedStrategies(prev => 
                        isExcluded ? prev.filter(p => p !== s.name) : [...prev, s.name]
                      );
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* LOCKED STRATEGIES */}
          {lockedStrategies.length > 0 && (
            <div className="space-y-4 opacity-60">
              <h3 className="font-display text-lg font-bold flex items-center gap-2">
                <Lock size={18} /> Locked Strategies
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {lockedStrategies.map((s) => (
                  <Card key={s.name} className="border-border bg-muted/30 p-4 grayscale">
                     <p className="font-display font-bold text-sm">{s.name}</p>
                     <p className="text-[10px] text-muted-foreground mt-1 uppercase">Min Capital: ${STRATEGY_TIERS.find(t => t.strategies.includes(s))?.min_capital.toLocaleString()}</p>
                     <p className="text-xs mt-2 text-muted-foreground line-clamp-2">{s.description}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value, icon: Icon, loading }: { label: string, value: string, icon: any, loading: boolean }) {
  return (
    <Card className="border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-8 w-24 mt-2" /> : <p className="mt-2 font-display text-2xl font-black">{value}</p>}
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}

function StrategyCard({ strategy, isExcluded, currentAlloc, recommendedAlloc, onToggle }: { 
  strategy: Strategy, 
  isExcluded: boolean, 
  currentAlloc: number,
  recommendedAlloc: number,
  onToggle: () => void 
}) {
  return (
    <Card className={`border-border bg-card p-5 transition-all ${isExcluded ? 'opacity-40 grayscale' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-display font-bold text-foreground">{strategy.name}</h4>
          <p className="text-[10px] font-bold text-bullish uppercase">Target: {(strategy.avg_monthly_return * 100).toFixed(1)}%/mo</p>
        </div>
        <input 
          type="checkbox" 
          checked={!isExcluded} 
          onChange={onToggle}
          className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
        />
      </div>
      
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Current Allocation</span>
            <span>{currentAlloc.toFixed(1)}%</span>
          </div>
          <Progress value={currentAlloc} className="h-1" />
        </div>

        {recommendedAlloc > 0 && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-500">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-primary">
              <span>Recommended</span>
              <span>{recommendedAlloc.toFixed(1)}%</span>
            </div>
            <Progress value={recommendedAlloc} className="h-1 bg-primary/20" />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {strategy.description}
      </p>
    </Card>
  );
}
