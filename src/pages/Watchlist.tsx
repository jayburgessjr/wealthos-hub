import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export default function Watchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newName, setNewName] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['watchlist', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user!.id)
        .order('added_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { mutate: addAsset, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const ticker = newTicker.toUpperCase().trim();
      if (!ticker) throw new Error('Ticker is required');
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id,
        ticker,
        company_name: newName.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', user?.id] });
      toast.success(`${newTicker.toUpperCase()} added to watchlist`);
      setAddOpen(false);
      setNewTicker('');
      setNewName('');
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to add asset');
    },
  });

  const { mutate: removeAsset } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('watchlist').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist', user?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to remove asset');
    },
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Watchlist</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-fast hover:border-bullish/30 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add Asset
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-accent" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
          <p className="text-sm font-medium text-foreground">Watchlist is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">Add tickers to monitor them for signals.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-3 text-xs font-medium">Ticker</th>
                <th className="px-4 py-3 text-xs font-medium">Name</th>
                <th className="px-4 py-3 text-xs font-medium">Alert Above</th>
                <th className="px-4 py-3 text-xs font-medium">Alert Below</th>
                <th className="px-4 py-3 text-xs font-medium">Added</th>
                <th className="px-4 py-3 text-xs font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                  <td className="px-4 py-4 font-mono font-bold text-foreground">{w.ticker}</td>
                  <td className="px-4 py-4 text-muted-foreground">{w.company_name ?? '—'}</td>
                  <td className="px-4 py-4 font-mono text-muted-foreground">
                    {w.alert_price_above ? `$${w.alert_price_above}` : '—'}
                  </td>
                  <td className="px-4 py-4 font-mono text-muted-foreground">
                    {w.alert_price_below ? `$${w.alert_price_below}` : '—'}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                    {w.added_at ? new Date(w.added_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => removeAsset(w.id)}
                      className="rounded p-1 text-muted-foreground transition-fast hover:bg-bearish/10 hover:text-bearish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">Add to Watchlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Ticker *</label>
              <input
                placeholder="NVDA"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-fast focus:border-bullish"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Company Name (optional)</label>
              <input
                placeholder="NVIDIA Corporation"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground outline-none transition-fast focus:border-bullish"
              />
            </div>
            <button
              onClick={() => addAsset()}
              disabled={isAdding || !newTicker.trim()}
              className="w-full rounded-lg bg-bullish py-2.5 font-body text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? 'Adding…' : 'Add to Watchlist'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
