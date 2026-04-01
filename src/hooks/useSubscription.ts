import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";

export function useSubscription() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (isDemoMode) return { is_admin: false, subscription_status: "active", subscription_plan: "pro" };
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  return {
    profile,
    isLoading,
    isPro: isDemoMode || profile?.subscription_status === "active" || profile?.subscription_status === "trialing",
    isAdmin: !isDemoMode && (profile?.is_admin || false),
    subscriptionStatus: isDemoMode ? "active" : (profile?.subscription_status || "none"),
    subscriptionPlan: isDemoMode ? "pro" : (profile?.subscription_plan || "free"),
  };
}
