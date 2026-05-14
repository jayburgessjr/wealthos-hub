import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  UserPlus,
  UserMinus,
  TrendingUp,
  Calendar,
  BarChart3,
  Users,
  ArrowLeft,
  Heart,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ── Types ─────────────────────────────────────────────────────────────────────
type ActionType = "buy" | "sell" | "short" | "watch" | "hold";
type TimeframeType = "intraday" | "swing" | "position" | "long_term";

interface TradeIdea {
  id: string;
  user_id: string;
  ticker: string;
  title: string;
  thesis: string;
  action: ActionType;
  timeframe: TimeframeType;
  entry_price: number | null;
  target_price: number | null;
  stop_price: number | null;
  risk_reward: number | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  idea_likes: { user_id: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getInitials(email: string): string {
  if (!email) return "?";
  const parts = email.split("@")[0].split(/[._-]/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const ACTION_COLORS: Record<ActionType, string> = {
  buy: "text-bullish border-bullish/40 bg-bullish/10",
  hold: "text-bullish border-bullish/40 bg-bullish/10",
  sell: "text-bearish border-bearish/40 bg-bearish/10",
  short: "text-bearish border-bearish/40 bg-bearish/10",
  watch: "text-neutral border-neutral/40 bg-neutral/10",
};

const ACTION_BORDER: Record<ActionType, string> = {
  buy: "border-l-bullish",
  hold: "border-l-bullish",
  sell: "border-l-bearish",
  short: "border-l-bearish",
  watch: "border-l-neutral",
};

const TIMEFRAME_LABELS: Record<TimeframeType, string> = {
  intraday: "Intraday",
  swing: "Swing",
  position: "Position",
  long_term: "Long-Term",
};

// ── Profile Idea Card ─────────────────────────────────────────────────────────
interface ProfileIdeaCardProps {
  idea: TradeIdea;
  currentUserId: string | null;
  onLike: (ideaId: string, isLiked: boolean) => void;
  isLikePending: boolean;
}

function ProfileIdeaCard({
  idea,
  currentUserId,
  onLike,
  isLikePending,
}: ProfileIdeaCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isLiked =
    idea.idea_likes?.some((l) => l.user_id === currentUserId) ?? false;
  const thesisLong = idea.thesis.length > 180;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`bg-card border border-border rounded-lg p-4 border-l-4 ${ACTION_BORDER[idea.action]} flex flex-col gap-3`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`font-mono text-xs font-semibold px-2 py-0.5 ${ACTION_COLORS[idea.action]}`}
        >
          ${idea.ticker}
        </Badge>
        <span className="text-foreground font-medium text-sm flex-1 min-w-0 truncate">
          {idea.title}
        </span>
        <Badge
          variant="outline"
          className={`text-xs capitalize ${ACTION_COLORS[idea.action]}`}
        >
          {idea.action}
        </Badge>
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {TIMEFRAME_LABELS[idea.timeframe]}
        </Badge>
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {timeAgo(idea.created_at)}
        </span>
      </div>

      {/* Thesis */}
      <div className="text-sm text-muted-foreground leading-relaxed">
        {thesisLong && !expanded ? (
          <>
            {idea.thesis.slice(0, 180)}…{" "}
            <button
              onClick={() => setExpanded(true)}
              className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
            >
              Read more
            </button>
          </>
        ) : (
          <>
            {idea.thesis}
            {thesisLong && (
              <>
                {" "}
                <button
                  onClick={() => setExpanded(false)}
                  className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
                >
                  Show less
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Price levels */}
      {(idea.entry_price || idea.target_price || idea.stop_price) && (
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-muted/30 rounded px-3 py-2">
          {idea.entry_price && (
            <span>
              <span className="text-muted-foreground">Entry </span>
              <span className="text-foreground">${idea.entry_price.toFixed(2)}</span>
            </span>
          )}
          {idea.entry_price && idea.target_price && (
            <span className="text-muted-foreground">→</span>
          )}
          {idea.target_price && (
            <span>
              <span className="text-muted-foreground">Target </span>
              <span className="text-bullish">${idea.target_price.toFixed(2)}</span>
            </span>
          )}
          {idea.stop_price && (
            <>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="text-muted-foreground">Stop </span>
                <span className="text-bearish">${idea.stop_price.toFixed(2)}</span>
              </span>
            </>
          )}
          {idea.risk_reward && (
            <>
              <span className="text-muted-foreground">|</span>
              <span>
                <span className="text-muted-foreground">R:R </span>
                <span className="text-foreground">{idea.risk_reward}x</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={() => onLike(idea.id, isLiked)}
          disabled={isLikePending}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isLiked
              ? "text-bearish"
              : "text-muted-foreground hover:text-bearish"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
          <span className="font-mono">{idea.likes_count}</span>
        </button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="font-mono">{idea.comments_count}</span>
        </div>
        <button
          onClick={() => navigate(`/chart?ticker=${idea.ticker}`)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          <span>Chart</span>
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isOwnProfile = currentUser?.id === userId;

  // ── Profile data ────────────────────────────────────────────────────────────
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["trader-profile", userId],
    queryFn: async () => {
      if (!userId) throw new Error("no-user-id");

      const [profileRes, ideasRes, followersRes, followingRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, email")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("trade_ideas")
            .select("*, idea_likes(user_id)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("trader_follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", userId),
          supabase
            .from("trader_follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", userId),
        ]);

      const ideas = (ideasRes.data ?? []) as TradeIdea[];
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const ideasThisMonth = ideas.filter(
        (i) => new Date(i.created_at) >= thisMonthStart
      ).length;

      const validRR = ideas.filter((i) => i.risk_reward != null);
      const avgRR =
        validRR.length > 0
          ? validRR.reduce((sum, i) => sum + (i.risk_reward ?? 0), 0) /
            validRR.length
          : null;

      return {
        email: profileRes.data?.email ?? `${userId?.slice(0, 8)}…`,
        ideas,
        totalIdeas: ideas.length,
        ideasThisMonth,
        avgRR: avgRR != null ? avgRR.toFixed(2) : "—",
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
    enabled: !!userId,
  });

  // ── Is following ────────────────────────────────────────────────────────────
  const { data: isFollowing = false } = useQuery({
    queryKey: ["is-following", currentUser?.id, userId],
    queryFn: async () => {
      if (!currentUser || !userId) return false;
      const { data } = await supabase
        .from("trader_follows")
        .select("id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", userId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!currentUser && !!userId && !isOwnProfile,
  });

  // ── Toggle follow ───────────────────────────────────────────────────────────
  const followMutation = useMutation({
    mutationFn: async (following: boolean) => {
      if (!currentUser || !userId) throw new Error("not-authenticated");
      if (following) {
        const { error } = await supabase
          .from("trader_follows")
          .delete()
          .match({ follower_id: currentUser.id, following_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trader_follows")
          .insert({ follower_id: currentUser.id, following_id: userId });
        if (error) throw error;
      }
    },
    onError: () => toast.error("Failed to update follow status"),
    onSuccess: (_, following) => {
      toast.success(following ? "Unfollowed" : "Following!");
      queryClient.invalidateQueries({
        queryKey: ["is-following", currentUser?.id, userId],
      });
      queryClient.invalidateQueries({ queryKey: ["trader-profile", userId] });
    },
  });

  const handleToggleFollow = () => {
    if (!currentUser) {
      toast.error("Sign in to follow traders");
      return;
    }
    followMutation.mutate(isFollowing);
  };

  // ── Like mutation ───────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: async ({
      ideaId,
      isLiked,
    }: {
      ideaId: string;
      isLiked: boolean;
    }) => {
      if (!currentUser) throw new Error("not-authenticated");
      if (isLiked) {
        const { error } = await supabase
          .from("idea_likes")
          .delete()
          .match({ user_id: currentUser.id, idea_id: ideaId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("idea_likes")
          .insert({ user_id: currentUser.id, idea_id: ideaId });
        if (error) throw error;
      }
    },
    onError: (err: Error) => {
      if (err.message === "not-authenticated") toast.error("Sign in to like ideas");
      else toast.error("Failed to update like");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trader-profile", userId] });
    },
  });

  const toggleLike = (ideaId: string, isLiked: boolean) => {
    if (!currentUser) {
      toast.error("Sign in to like ideas");
      return;
    }
    likeMutation.mutate({ ideaId, isLiked });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Profile header */}
        {profileLoading ? (
          <div className="bg-card border border-border rounded-lg p-6 flex items-center gap-5">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-6 flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="text-lg bg-muted text-muted-foreground">
                {getInitials(profileData?.email ?? "")}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-base truncate">
                {profileData?.email ?? "Unknown Trader"}
              </p>
              <p className="text-muted-foreground text-sm mt-0.5">
                {profileData?.totalIdeas ?? 0} ideas posted
              </p>
            </div>

            {!isOwnProfile && (
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={handleToggleFollow}
                disabled={followMutation.isPending}
                className="shrink-0"
              >
                {isFollowing ? (
                  <>
                    <UserMinus className="h-4 w-4 mr-1.5" />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Follow
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Stats row */}
        {profileLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              {
                icon: <TrendingUp className="h-4 w-4" />,
                label: "Total Ideas",
                value: profileData?.totalIdeas ?? 0,
              },
              {
                icon: <Calendar className="h-4 w-4" />,
                label: "This Month",
                value: profileData?.ideasThisMonth ?? 0,
              },
              {
                icon: <BarChart3 className="h-4 w-4" />,
                label: "Avg R:R",
                value: profileData?.avgRR ?? "—",
              },
              {
                icon: <Users className="h-4 w-4" />,
                label: "Followers",
                value: profileData?.followers ?? 0,
              },
              {
                icon: <UserPlus className="h-4 w-4" />,
                label: "Following",
                value: profileData?.following ?? 0,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <span className="text-muted-foreground shrink-0">{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                  <p className="font-mono font-semibold text-foreground text-sm">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ideas grid */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Ideas</h2>
          {profileLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : !profileData?.ideas.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border rounded-lg">
              <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No ideas yet.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {profileData.ideas.map((idea) => (
                  <ProfileIdeaCard
                    key={idea.id}
                    idea={idea}
                    currentUserId={currentUser?.id ?? null}
                    onLike={toggleLike}
                    isLikePending={likeMutation.isPending}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
