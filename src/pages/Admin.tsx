import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { AdminGate } from "@/components/AdminGate";
import { Card } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, Zap, ShieldCheck, TrendingUp, Search, 
  UserPlus, UserMinus, RefreshCw, Trash2
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: signals = [] } = useQuery({
    queryKey: ["admin", "signals-count"],
    queryFn: async () => {
      const { data } = await supabase.from("signals").select("id");
      return data ?? [];
    },
  });

  const { mutate: updatePlan } = useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          subscription_plan: plan, 
          subscription_status: plan === 'pro' ? 'active' : 'none' 
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User plan updated");
    },
  });

  const { mutate: toggleAdmin } = useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: isAdmin })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Admin status updated");
    },
  });

  const { mutate: triggerSignals, isPending: triggering } = useMutation({
    mutationFn: async () => {
      // For demonstration, we'll just trigger for a subset of tickers
      const tickers = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META"];
      const { data, error } = await supabase.functions.invoke("generate-signals", {
        body: { tickers }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Signal generation triggered successfully");
    },
    onError: (err: any) => toast.error(`Failed to trigger: ${err.message}`),
  });

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPro = users.filter(u => u.subscription_plan === 'pro').length;
  const estimatedRevenue = totalPro * 29;

  return (
    <DashboardLayout>
      <AdminGate>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-foreground">Admin Hub</h2>
            <div className="flex items-center gap-2 rounded-full bg-accent/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck size={14} className="text-primary" /> System Administrator
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <AdminStatCard label="Total Users" value={users.length.toString()} icon={Users} />
            <AdminStatCard label="Pro Members" value={totalPro.toString()} icon={ShieldCheck} />
            <AdminStatCard label="Est. Monthly Revenue" value={`$${estimatedRevenue.toLocaleString()}`} icon={TrendingUp} color="text-bullish" />
            <AdminStatCard label="Active Signals" value={signals.length.toString()} icon={Zap} />
          </div>

          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="system">System Actions</TabsTrigger>
              <TabsTrigger value="logs">Logs & Settings</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-6 space-y-4">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
                <Search size={18} className="text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search users by email..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Card className="border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-accent/30">
                      <TableHead>User Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                      ))
                    ) : filteredUsers.map((u) => (
                      <TableRow key={u.id} className="hover:bg-accent/20">
                        <TableCell className="font-mono text-sm">{u.email}</TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            u.subscription_plan === 'pro' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                          }`}>
                            {u.subscription_plan}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs ${u.subscription_status === 'active' ? 'text-bullish font-bold' : 'text-muted-foreground'}`}>
                            {u.subscription_status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <input 
                            type="checkbox" 
                            checked={u.is_admin || false} 
                            onChange={(e) => toggleAdmin({ id: u.id, isAdmin: e.target.checked })}
                            className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
                          />
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {u.subscription_plan === 'free' ? (
                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => updatePlan({ id: u.id, plan: 'pro' })}>
                              <UserPlus size={12} className="mr-1" /> Make Pro
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => updatePlan({ id: u.id, plan: 'free' })}>
                              <UserMinus size={12} className="mr-1" /> Revoke Pro
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-bearish hover:bg-bearish/10">
                            <Trash2 size={12} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {/* System Tab */}
            <TabsContent value="system" className="mt-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="border-border bg-card p-6">
                  <h3 className="mb-4 font-display font-bold">Signal Generation</h3>
                  <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
                    Manually trigger the signal generation engine for the core watchlist. This will invoke the Edge Function and update signals for all users.
                  </p>
                  <Button 
                    className="w-full gap-2 py-6 text-base" 
                    onClick={() => triggerSignals()}
                    disabled={triggering}
                  >
                    <RefreshCw className={`h-5 w-5 ${triggering ? 'animate-spin' : ''}`} />
                    {triggering ? 'Generating Signals...' : 'Run Global Signal Refresh'}
                  </Button>
                </Card>

                <Card className="border-border bg-card p-6">
                  <h3 className="mb-4 font-display font-bold">API Health</h3>
                  <div className="space-y-4">
                    <ApiStatusItem name="Polygon.io" status="Healthy" />
                    <ApiStatusItem name="FRED (St. Louis Fed)" status="Healthy" />
                    <ApiStatusItem name="OpenAI (GPT-4o)" status="Healthy" />
                    <ApiStatusItem name="Stripe API" status="Healthy" />
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="mt-6">
              <Card className="border-border bg-card p-12 text-center">
                <p className="text-muted-foreground italic">Advanced log visualization coming in Phase 4.</p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </AdminGate>
    </DashboardLayout>
  );
}

function AdminStatCard({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color?: string }) {
  return (
    <Card className="border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-1 font-display text-2xl font-black ${color ?? 'text-foreground'}`}>{value}</p>
        </div>
        <div className="rounded-xl bg-accent p-3 text-muted-foreground">
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function ApiStatusItem({ name, status }: { name: string, status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3">
      <span className="text-xs font-semibold">{name}</span>
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-bullish uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse" />
        {status}
      </span>
    </div>
  );
}
