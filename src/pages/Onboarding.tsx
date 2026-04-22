import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Rocket, ArrowRight, ArrowLeft, CheckCircle2, 
  Target, Shield, TrendingUp, Cpu, Landmark, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const steps = [
  { id: "persona", title: "Investment Persona" },
  { id: "capital", title: "Capital & Goals" },
  { id: "risk", title: "Risk Profile" },
  { id: "sectors", title: "Interests" },
  { id: "launch", title: "Launch" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form State
  const [persona, setPersona] = useState("");
  const [capital, setCapital] = useState("10000");
  const [monthly, setMonthly] = useState("500");
  const [risk, setRisk] = useState("moderate");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    try {
      // 1. Update Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user!.id);
      
      if (profileError) throw profileError;

      // 2. Set Capital Stats
      const capVal = parseFloat(capital);
      const { error: portError } = await supabase
        .from('portfolios')
        .upsert({
          user_id: user!.id,
          total_capital: capVal,
          available_capital: capVal,
          deployed_capital: 0,
          total_pnl: 0,
          win_rate: 0,
          total_trades: 0
        }, { onConflict: 'user_id' });
      
      if (portError) throw portError;

      // 3. Set Compound Settings
      const { error: settingsError } = await supabase
        .from('compound_settings')
        .upsert({
          user_id: user!.id,
          starting_capital: capVal,
          monthly_contribution: parseFloat(monthly),
          risk_tier: risk,
          reinvestment_pct: 100
        }, { onConflict: 'user_id' });
      
      if (settingsError) throw settingsError;

      // 4. Add initial watchlist items based on sectors
      const sectorToTicker: Record<string, string[]> = {
        "AI": ["NVDA", "MSFT", "GOOGL"],
        "Crypto": ["BTC", "ETH", "COIN"],
        "Value": ["BRK.B", "JPM", "V"],
        "Growth": ["TSLA", "AMZN", "META"]
      };

      const tickersToAdd = selectedSectors.flatMap(s => sectorToTicker[s] || []);
      if (tickersToAdd.length > 0) {
        const watchlistRows = Array.from(new Set(tickersToAdd)).map(t => ({
          user_id: user!.id,
          ticker: t,
          company_name: t
        }));
        await supabase.from('watchlist').insert(watchlistRows);
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("WealthOS Hub Configured!");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress Bar */}
        <div className="mb-12 flex justify-between">
          {steps.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-2 flex-1">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${i <= currentStep ? 'text-primary' : 'text-muted-foreground'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <div className="text-center space-y-8">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <Target size={40} />
                </div>
                <div className="space-y-4">
                  <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Welcome to WealthOS.</h1>
                  <p className="text-lg text-muted-foreground">To tailor your decision intelligence experience, tell us about your background.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {["Novice", "Professional", "Institutional"].map(p => (
                    <Card 
                      key={p} 
                      onClick={() => setPersona(p)}
                      className={`cursor-pointer p-6 border-2 transition-all hover:scale-[1.02] ${persona === p ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border'}`}
                    >
                      <span className="font-display font-bold">{p}</span>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral/10 text-neutral">
                    <Landmark size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-bold">Capital & Goals</h2>
                  <p className="text-muted-foreground">Define your starting ammunition and monthly contributions.</p>
                </div>
                <div className="space-y-6 max-w-md mx-auto">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Starting Capital ($)</label>
                    <input 
                      type="number" 
                      value={capital}
                      onChange={(e) => setCapital(e.target.value)}
                      className="w-full bg-accent border border-border rounded-xl px-4 py-4 font-mono text-2xl font-bold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Monthly Contribution ($)</label>
                    <input 
                      type="number" 
                      value={monthly}
                      onChange={(e) => setMonthly(e.target.value)}
                      className="w-full bg-accent border border-border rounded-xl px-4 py-4 font-mono text-2xl font-bold focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-watch/10 text-watch">
                    <Shield size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-bold">Risk Management</h2>
                  <p className="text-muted-foreground">Choose a risk tier that matches your stomach for volatility.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { id: 'conservative', label: 'Conservative', desc: 'Focus on preservation & yield.' },
                    { id: 'moderate', label: 'Moderate', desc: 'Balanced growth & protection.' },
                    { id: 'aggressive', label: 'Aggressive', desc: 'Maximize alpha & compounding.' },
                  ].map(r => (
                    <Card 
                      key={r.id} 
                      onClick={() => setRisk(r.id)}
                      className={`cursor-pointer p-6 border-2 transition-all hover:scale-[1.02] ${risk === r.id ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border'}`}
                    >
                      <h4 className="font-display font-bold mb-2">{r.label}</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-8">
                <div className="text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bearish/10 text-bearish">
                    <Zap size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-bold">Asset Interests</h2>
                  <p className="text-muted-foreground">Select sectors to pre-configure your market signals.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {["AI", "Crypto", "Value", "Growth"].map(s => (
                    <div 
                      key={s} 
                      onClick={() => {
                        setSelectedSectors(prev => 
                          prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                        );
                      }}
                      className={`cursor-pointer flex items-center justify-between p-6 border-2 rounded-2xl transition-all ${selectedSectors.includes(s) ? 'border-primary bg-primary/5 shadow-md' : 'border-border'}`}
                    >
                      <span className="font-display font-bold">{s}</span>
                      {selectedSectors.includes(s) && <CheckCircle2 size={20} className="text-primary" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="text-center space-y-8">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-2xl shadow-primary/40 animate-bounce">
                  <Rocket size={48} />
                </div>
                <div className="space-y-4">
                  <h2 className="font-display text-4xl font-bold">Ready for Liftoff.</h2>
                  <p className="text-lg text-muted-foreground max-w-md mx-auto">
                    We've configured your WealthOS Hub with a <span className="text-foreground font-bold">{risk}</span> profile and starting capital of <span className="text-foreground font-bold">${capital}</span>.
                  </p>
                </div>
                <Card className="max-w-sm mx-auto p-6 bg-accent/50 border-primary/20">
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Persona</span>
                    <span className="font-bold">{persona || "None"}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Capital</span>
                    <span className="font-bold">${capital}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Interests</span>
                    <span className="font-bold">{selectedSectors.join(", ") || "Generic"}</span>
                  </div>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex items-center justify-between gap-4">
          <Button 
            variant="ghost" 
            onClick={handleBack} 
            disabled={currentStep === 0}
            className="rounded-full px-8 h-12"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          
          {currentStep === steps.length - 1 ? (
            <Button 
              onClick={handleFinish}
              className="rounded-full px-12 h-12 text-base font-bold shadow-xl shadow-primary/20"
            >
              Launch My Hub <Rocket className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleNext}
              disabled={currentStep === 0 && !persona}
              className="rounded-full px-12 h-12 text-base font-bold shadow-xl shadow-primary/20"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
