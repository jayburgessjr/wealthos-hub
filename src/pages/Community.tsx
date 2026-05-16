import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Heart,
  MessageSquare,
  Plus,
  TrendingUp,
  Users,
  BarChart3,
  Hash,
  ExternalLink,
  X,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  idea_comments: { id: string }[];
  author_email?: string;
}

interface IdeaComment {
  id: string;
  user_id: string;
  idea_id: string;
  content: string;
  created_at: string;
  author_email?: string;
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

function truncateEmail(email: string): string {
  if (!email) return "Anonymous";
  if (email.length <= 24) return email;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 12)}…@${domain}`;
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

// ── Idea Card ─────────────────────────────────────────────────────────────────
interface IdeaCardProps {
  idea: TradeIdea;
  currentUserId: string | null;
  onLike: (ideaId: string, isLiked: boolean) => void;
  onOpenComments: (idea: TradeIdea) => void;
  isLikePending: boolean;
}

function IdeaCard({
  idea,
  currentUserId,
  onLike,
  onOpenComments,
  isLikePending,
}: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isLiked = idea.idea_likes?.some((l) => l.user_id === currentUserId) ?? false;
  const thesisLong = idea.thesis.length > 180;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`bg-card border border-border rounded-lg p-4 border-l-4 ${ACTION_BORDER[idea.action]} flex flex-col gap-3`}
    >
      {/* Header row */}
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

      {/* Footer row */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate(`/profile/${idea.user_id}`)}
          className="flex items-center gap-2 group"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
              {getInitials(idea.author_email ?? "")}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
            {truncateEmail(idea.author_email ?? "Anonymous")}
          </span>
        </button>

        <div className="flex items-center gap-3 ml-auto">
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

          <button
            onClick={() => onOpenComments(idea)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="font-mono">{idea.comments_count}</span>
          </button>

          <button
            onClick={() => navigate(`/chart?ticker=${idea.ticker}`)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Chart</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── New Idea Form ─────────────────────────────────────────────────────────────
interface NewIdeaFormState {
  ticker: string;
  title: string;
  action: ActionType | "";
  timeframe: TimeframeType | "";
  thesis: string;
  entry_price: string;
  target_price: string;
  stop_price: string;
}

const EMPTY_FORM: NewIdeaFormState = {
  ticker: "",
  title: "",
  action: "",
  timeframe: "",
  thesis: "",
  entry_price: "",
  target_price: "",
  stop_price: "",
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Community() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"top" | "latest" | "following">("latest");
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [form, setForm] = useState<NewIdeaFormState>(EMPTY_FORM);
  const [commentSheet, setCommentSheet] = useState<TradeIdea | null>(null);
  const [newComment, setNewComment] = useState("");

  // ── Ideas Query ─────────────────────────────────────────────────────────────
  const { data: ideas = [], isLoading: ideasLoading } = useQuery({
    queryKey: ["community-ideas", activeTab, user?.id],
    queryFn: async () => {
      let query = supabase
        .from("trade_ideas")
        .select("*, idea_likes(user_id), idea_comments(id)");

      if (activeTab === "top") {
        query = query.order("likes_count", { ascending: false });
      } else if (activeTab === "latest") {
        query = query.order("created_at", { ascending: false });
      } else if (activeTab === "following" && user) {
        const { data: follows } = await supabase
          .from("trader_follows")
          .select("following_id")
          .eq("follower_id", user.id);
        const followingIds = (follows ?? []).map((f) => f.following_id);
        if (followingIds.length === 0) return [];
        query = query
          .in("user_id", followingIds)
          .order("created_at", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      // Fetch author emails from profiles (best-effort)
      const raw = data ?? [];
      const userIds = [...new Set(raw.map((i) => i.user_id))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        (profiles ?? []).forEach((p) => {
          emailMap[p.id] = p.email ?? "";
        });
      }

      return raw.map((idea) => ({
        ...idea,
        author_email: emailMap[idea.user_id] ?? idea.user_id.slice(0, 8),
      })) as TradeIdea[];
    },
    enabled: activeTab !== "following" || !!user,
  });

  // ── Stats Query ─────────────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ["community-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [todayRes, totalRes, tradersRes] = await Promise.all([
        supabase
          .from("trade_ideas")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today),
        supabase
          .from("trade_ideas")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("trade_ideas")
          .select("user_id"),
      ]);

      const allIdeas = tradersRes.data ?? [];
      const uniqueTraders = new Set(allIdeas.map((i) => i.user_id)).size;

      // Most discussed ticker
      const tickerCounts: Record<string, number> = {};
      allIdeas.forEach((i) => {
        tickerCounts[i.user_id] = (tickerCounts[i.user_id] ?? 0) + 1;
      });

      // Separate query for most discussed ticker
      const { data: tickerData } = await supabase
        .from("trade_ideas")
        .select("ticker, comments_count")
        .order("comments_count", { ascending: false })
        .limit(1);

      const topTicker = tickerData?.[0]?.ticker ?? "—";

      return {
        todayCount: todayRes.count ?? 0,
        totalCount: totalRes.count ?? 0,
        activeTraders: uniqueTraders,
        topTicker,
      };
    },
  });

  // ── Comments Query ──────────────────────────────────────────────────────────
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["idea-comments", commentSheet?.id],
    queryFn: async () => {
      if (!commentSheet) return [];
      const { data, error } = await supabase
        .from("idea_comments")
        .select("*")
        .eq("idea_id", commentSheet.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const raw = data ?? [];
      const userIds = [...new Set(raw.map((c) => c.user_id))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        (profiles ?? []).forEach((p) => {
          emailMap[p.id] = p.email ?? "";
        });
      }

      return raw.map((c) => ({
        ...c,
        author_email: emailMap[c.user_id] ?? c.user_id.slice(0, 8),
      })) as IdeaComment[];
    },
    enabled: !!commentSheet,
  });

  // ── Like Mutation ───────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: async ({
      ideaId,
      isLiked,
    }: {
      ideaId: string;
      isLiked: boolean;
    }) => {
      if (!user) throw new Error("not-authenticated");
      if (isLiked) {
        const { error } = await supabase
          .from("idea_likes")
          .delete()
          .match({ user_id: user.id, idea_id: ideaId });
        if (error) throw error;
        await supabase
          .from("trade_ideas")
          .update({ likes_count: supabase.rpc("decrement", { x: 1 }) as any })
          .eq("id", ideaId);
      } else {
        const { error } = await supabase
          .from("idea_likes")
          .insert({ user_id: user.id, idea_id: ideaId });
        if (error) throw error;
        await supabase
          .from("trade_ideas")
          .update({ likes_count: supabase.rpc("increment", { x: 1 }) as any })
          .eq("id", ideaId);
      }
    },
    onError: (err: Error) => {
      if (err.message === "not-authenticated") {
        toast.error("Sign in to like ideas");
      } else {
        toast.error("Failed to update like");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community-ideas"] });
    },
  });

  const toggleLike = (ideaId: string, isLiked: boolean) => {
    if (!user) {
      toast.error("Sign in to like ideas");
      return;
    }
    likeMutation.mutate({ ideaId, isLiked });
  };

  // ── Submit Idea ─────────────────────────────────────────────────────────────
  const submitIdeaMutation = useMutation({
    mutationFn: async (f: NewIdeaFormState) => {
      if (!user) throw new Error("not-authenticated");
      if (!f.action || !f.timeframe) throw new Error("missing-fields");
      if (f.thesis.trim().length < 50)
        throw new Error("thesis-too-short");

      const { error } = await supabase.from("trade_ideas").insert({
        user_id: user.id,
        ticker: f.ticker.toUpperCase().trim(),
        title: f.title.trim(),
        action: f.action as ActionType,
        timeframe: f.timeframe as TimeframeType,
        thesis: f.thesis.trim(),
        entry_price: f.entry_price ? parseFloat(f.entry_price) : null,
        target_price: f.target_price ? parseFloat(f.target_price) : null,
        stop_price: f.stop_price ? parseFloat(f.stop_price) : null,
      });
      if (error) throw error;
    },
    onError: (err: Error) => {
      if (err.message === "not-authenticated") toast.error("Sign in to post ideas");
      else if (err.message === "missing-fields") toast.error("Select an action and timeframe");
      else if (err.message === "thesis-too-short") toast.error("Thesis must be at least 50 characters");
      else toast.error("Failed to post idea");
    },
    onSuccess: () => {
      toast.success("Idea posted!");
      setShowNewIdea(false);
      setForm(EMPTY_FORM);
      queryClient.invalidateQueries({ queryKey: ["community-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["community-stats"] });
    },
  });

  const handleSubmitIdea = () => {
    if (!form.ticker.trim() || !form.title.trim() || !form.thesis.trim()) {
      toast.error("Ticker, title, and thesis are required");
      return;
    }
    submitIdeaMutation.mutate(form);
  };

  // ── Submit Comment ──────────────────────────────────────────────────────────
  const submitCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !commentSheet) throw new Error("not-authenticated");
      const { error } = await supabase.from("idea_comments").insert({
        user_id: user.id,
        idea_id: commentSheet.id,
        content: content.trim(),
      });
      if (error) throw error;
      await supabase
        .from("trade_ideas")
        .update({ comments_count: commentSheet.comments_count + 1 })
        .eq("id", commentSheet.id);
    },
    onError: () => toast.error("Failed to post comment"),
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["idea-comments", commentSheet?.id] });
      queryClient.invalidateQueries({ queryKey: ["community-ideas"] });
    },
  });

  const handleSubmitComment = () => {
    if (!user) { toast.error("Sign in to comment"); return; }
    if (!newComment.trim()) return;
    submitCommentMutation.mutate(newComment);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Community</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Share your ideas with the AJE community
            </p>
          </div>
          <Button
            onClick={() => {
              if (!user) { toast.error("Sign in to post ideas"); return; }
              setShowNewIdea(true);
            }}
            size="sm"
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Idea
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: <BarChart3 className="h-4 w-4" />,
              label: "Ideas Today",
              value: stats?.todayCount ?? 0,
            },
            {
              icon: <TrendingUp className="h-4 w-4" />,
              label: "Total Ideas",
              value: stats?.totalCount ?? 0,
            },
            {
              icon: <Users className="h-4 w-4" />,
              label: "Active Traders",
              value: stats?.activeTraders ?? 0,
            },
            {
              icon: <Hash className="h-4 w-4" />,
              label: "Most Discussed",
              value: stats?.topTicker ? `$${stats.topTicker}` : "—",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3"
            >
              <span className="text-muted-foreground">{s.icon}</span>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="font-mono font-semibold text-foreground text-sm">
                  {s.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList className="bg-muted/40">
            <TabsTrigger value="latest">Latest</TabsTrigger>
            <TabsTrigger value="top">Top Ideas</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>

          {(["latest", "top", "following"] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {ideasLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-lg" />
                ))
              ) : tab === "following" && ideas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Users className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Follow other traders to see their ideas here.
                  </p>
                </div>
              ) : ideas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No ideas yet. Be the first to share one!
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      currentUserId={user?.id ?? null}
                      onLike={toggleLike}
                      onOpenComments={setCommentSheet}
                      isLikePending={likeMutation.isPending}
                    />
                  ))}
                </AnimatePresence>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* New Idea Dialog */}
      <Dialog open={showNewIdea} onOpenChange={setShowNewIdea}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share a Trade Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Ticker *</label>
                <Input
                  placeholder="AAPL"
                  value={form.ticker}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ticker: e.target.value.toUpperCase(),
                    }))
                  }
                  className="font-mono uppercase"
                  maxLength={10}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Action *</label>
                <Select
                  value={form.action}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, action: v as ActionType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="watch">Watch</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Title *</label>
              <Input
                placeholder="e.g. AAPL breakout above 200 SMA"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Timeframe *</label>
              <Select
                value={form.timeframe}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, timeframe: v as TimeframeType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intraday">Intraday</SelectItem>
                  <SelectItem value="swing">Swing</SelectItem>
                  <SelectItem value="position">Position</SelectItem>
                  <SelectItem value="long_term">Long-Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                Thesis *{" "}
                <span
                  className={
                    form.thesis.length < 50
                      ? "text-bearish"
                      : "text-bullish"
                  }
                >
                  ({form.thesis.length}/50 min)
                </span>
              </label>
              <Textarea
                placeholder="Explain your reasoning, catalysts, and risk factors…"
                value={form.thesis}
                onChange={(e) => setForm((f) => ({ ...f, thesis: e.target.value }))}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Entry $</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.entry_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entry_price: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Target $</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.target_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_price: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Stop $</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.stop_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stop_price: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmitIdea}
              disabled={submitIdeaMutation.isPending}
              className="w-full"
            >
              {submitIdeaMutation.isPending ? "Posting…" : "Post Idea"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments Sheet */}
      <Sheet
        open={!!commentSheet}
        onOpenChange={(open) => { if (!open) setCommentSheet(null); }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border">
            <SheetTitle className="text-sm font-semibold">
              {commentSheet
                ? `${commentSheet.ticker} — ${commentSheet.title}`
                : "Comments"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {commentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded" />
              ))
            ) : comments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">
                No comments yet. Start the discussion!
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                      {getInitials(c.author_email ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground truncate">
                        {truncateEmail(c.author_email ?? "Anonymous")}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Comment input */}
          <div className="px-5 py-4 border-t border-border flex gap-2">
            <Textarea
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={2}
              className="resize-none flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmitComment();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || submitCommentMutation.isPending}
              className="self-end shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
