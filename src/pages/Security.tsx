import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Lock, Unlock, Eye, EyeOff, Key, Globe,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Activity, Smartphone, Monitor, RefreshCw, Download
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ── Types ──────────────────────────────────────────────────────────────────────
type RiskLevel = "critical" | "high" | "medium" | "low" | "pass";
type EventType = "login" | "trade" | "settings" | "api" | "auth" | "alert";

interface SecurityCheck {
  id: string;
  category: string;
  label: string;
  description: string;
  status: RiskLevel;
  recommendation?: string;
}

interface AuditEvent {
  id: string;
  type: EventType;
  action: string;
  detail: string;
  ip: string;
  device: string;
  timestamp: Date;
  success: boolean;
}

// ── Static security checks ────────────────────────────────────────────────────
const SECURITY_CHECKS: SecurityCheck[] = [
  // Authentication
  { id: "c1", category: "Authentication", label: "Password Strength", description: "Account password meets complexity requirements", status: "pass" },
  { id: "c2", category: "Authentication", label: "Two-Factor Authentication", description: "2FA is enabled on this account", status: "high", recommendation: "Enable 2FA via Settings → Security to prevent unauthorised access" },
  { id: "c3", category: "Authentication", label: "Session Timeout", description: "Sessions expire after 24 hours of inactivity", status: "pass" },
  { id: "c4", category: "Authentication", label: "Login Anomaly Detection", description: "Unusual login patterns trigger alerts", status: "pass" },

  // API & Integrations
  { id: "c5", category: "API Security", label: "API Key Rotation", description: "API keys should be rotated every 90 days", status: "medium", recommendation: "Last rotation was 67 days ago. Rotate keys in Settings → API Keys" },
  { id: "c6", category: "API Security", label: "Least-Privilege Access", description: "API keys use minimum required permissions", status: "pass" },
  { id: "c7", category: "API Security", label: "Key Exposure Scan", description: "No API keys found exposed in logs or public repositories", status: "pass" },
  { id: "c8", category: "API Security", label: "Webhook Signature Verification", description: "Incoming webhooks are signature-verified", status: "pass" },

  // Data & Privacy
  { id: "c9",  category: "Data Protection", label: "Data Encryption at Rest", description: "All stored data is AES-256 encrypted", status: "pass" },
  { id: "c10", category: "Data Protection", label: "Data Encryption in Transit", description: "All connections use TLS 1.3", status: "pass" },
  { id: "c11", category: "Data Protection", label: "PII Data Minimisation", description: "Personal data collected is limited to account operation", status: "pass" },
  { id: "c12", category: "Data Protection", label: "GDPR Data Export Available", description: "One-click data export available via Settings", status: "pass" },

  // Risk & Compliance
  { id: "c13", category: "Risk Controls", label: "Position Limit Enforcement", description: "Max position size limits are active", status: "pass" },
  { id: "c14", category: "Risk Controls", label: "Daily Loss Limit", description: "Daily loss circuit breaker is configured", status: "medium", recommendation: "Set a daily loss limit in Settings → Risk Controls to protect against runaway losses" },
  { id: "c15", category: "Risk Controls", label: "Leverage Cap", description: "Maximum leverage is capped per your risk profile", status: "pass" },
  { id: "c16", category: "Risk Controls", label: "IP Allowlist", description: "Restrict API access to known IP addresses", status: "low", recommendation: "Configure IP allowlisting in Settings → API Keys to restrict access geographically" },
];

// ── Mock audit trail ──────────────────────────────────────────────────────────
const now = new Date();
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const AUDIT_EVENTS: AuditEvent[] = [
  { id: "a1",  type: "login",    action: "User Login",            detail: "Successful login via password",            ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(5),    success: true  },
  { id: "a2",  type: "trade",    action: "Position Opened",       detail: "Long NVDA 50 shares @ $874.50",            ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(18),   success: true  },
  { id: "a3",  type: "trade",    action: "Position Closed",       detail: "Closed AAPL @ $184.20 (+$212.50 P&L)",     ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(45),   success: true  },
  { id: "a4",  type: "settings", action: "Risk Settings Updated", detail: "Max position size changed from $10k → $15k", ip: "104.28.12.45", device: "Chrome / macOS",   timestamp: minsAgo(120),  success: true  },
  { id: "a5",  type: "api",      action: "API Key Created",       detail: "New read-only key generated",              ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(180),  success: true  },
  { id: "a6",  type: "auth",     action: "Failed Login Attempt",  detail: "Invalid password — account not locked",    ip: "185.234.219.12", device: "Unknown / Linux",  timestamp: minsAgo(240),  success: false },
  { id: "a7",  type: "alert",    action: "Anomaly Detected",      detail: "Login from new location (DE/Frankfurt)",   ip: "185.234.219.12", device: "Firefox / Linux",  timestamp: minsAgo(240),  success: false },
  { id: "a8",  type: "trade",    action: "Quantum Engine Run",    detail: "Portfolio optimisation — 2000 MC paths",   ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(320),  success: true  },
  { id: "a9",  type: "login",    action: "User Login",            detail: "Successful login via password",            ip: "173.245.48.1",   device: "Safari / iOS",     timestamp: minsAgo(480),  success: true  },
  { id: "a10", type: "settings", action: "Profile Updated",       detail: "Email address updated",                    ip: "173.245.48.1",   device: "Safari / iOS",     timestamp: minsAgo(500),  success: true  },
  { id: "a11", type: "api",      action: "API Request",           detail: "Market data fetch — 245 calls",            ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(600),  success: true  },
  { id: "a12", type: "trade",    action: "Strategy Lifecycle",    detail: "NVDA Momentum advanced to Live-Ready",     ip: "104.28.12.45",   device: "Chrome / macOS",   timestamp: minsAgo(720),  success: true  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<RiskLevel, { label: string; color: string; bg: string; icon: any }> = {
  pass:     { label: "Pass",     color: "#00cc73", bg: "bg-bullish/10",  icon: CheckCircle2 },
  low:      { label: "Low",      color: "#3D8EFF", bg: "bg-primary/10",  icon: ShieldCheck  },
  medium:   { label: "Medium",   color: "#F59E0B", bg: "bg-watch/10",    icon: ShieldAlert  },
  high:     { label: "High",     color: "#ef4444", bg: "bg-bearish/10",  icon: ShieldX      },
  critical: { label: "Critical", color: "#dc2626", bg: "bg-red-500/10",  icon: ShieldX      },
};

const EVENT_ICONS: Record<EventType, any> = {
  login:    Monitor,
  trade:    Activity,
  settings: Key,
  api:      Globe,
  auth:     Lock,
  alert:    AlertTriangle,
};

function timeAgo(date: Date): string {
  const m = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Security score calculator ─────────────────────────────────────────────────
function computeScore(checks: SecurityCheck[]): number {
  const weights: Record<RiskLevel, number> = { pass: 10, low: 6, medium: 3, high: 0, critical: -5 };
  const total = checks.reduce((s, c) => s + weights[c.status], 0);
  const max = checks.length * 10;
  return Math.round((total / max) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Security() {
  const [tab, setTab] = useState<"overview" | "audit">("overview");
  const [eventFilter, setEventFilter] = useState<EventType | "all">("all");
  const [showSuccess, setShowSuccess] = useState(true);
  const [showFailed, setShowFailed] = useState(true);

  const score = useMemo(() => computeScore(SECURITY_CHECKS), []);

  const scoreColor = score >= 85 ? "text-bullish" : score >= 65 ? "text-watch" : "text-bearish";
  const scoreLabel = score >= 85 ? "Strong" : score >= 65 ? "Fair" : "At Risk";
  const scoreIcon = score >= 85 ? ShieldCheck : score >= 65 ? ShieldAlert : ShieldX;
  const ScoreIcon = scoreIcon;

  const categorised = useMemo(() => {
    const cats: Record<string, SecurityCheck[]> = {};
    SECURITY_CHECKS.forEach(c => {
      if (!cats[c.category]) cats[c.category] = [];
      cats[c.category].push(c);
    });
    return cats;
  }, []);

  const issueCount = SECURITY_CHECKS.filter(c => c.status !== "pass").length;

  const filteredEvents = useMemo(() => {
    let evts = AUDIT_EVENTS;
    if (eventFilter !== "all") evts = evts.filter(e => e.type === eventFilter);
    if (!showSuccess) evts = evts.filter(e => !e.success);
    if (!showFailed)  evts = evts.filter(e => e.success);
    return evts;
  }, [eventFilter, showSuccess, showFailed]);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Shield size={12} className="text-muted-foreground" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Account Security</span>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight">Security & Audit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Security posture · Risk assessment · Audit trail
            </p>
          </div>
          <button className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 font-mono text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
            <Download size={13} /> Export Report
          </button>
        </div>

        {/* Score card */}
        <div className={`rounded-2xl border p-6 ${score >= 85 ? "border-bullish/30 bg-bullish/5" : score >= 65 ? "border-watch/30 bg-watch/5" : "border-bearish/30 bg-bearish/5"}`}>
          <div className="flex items-center gap-6">
            <div className="relative flex items-center justify-center">
              {/* Circular progress */}
              <svg width="100" height="100" className="-rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={score >= 85 ? "#00cc73" : score >= 65 ? "#F59E0B" : "#ef4444"}
                  strokeWidth="8"
                  strokeDasharray={`${(score / 100) * 263.9} 263.9`}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 6px ${score >= 85 ? "#00cc73" : score >= 65 ? "#F59E0B" : "#ef4444"}60)` }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className={`font-mono text-xl font-black ${scoreColor}`}>{score}</span>
                <span className="text-xs uppercase text-muted-foreground">/ 100</span>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ScoreIcon size={18} className={scoreColor} />
                <span className={`font-display text-2xl font-black ${scoreColor}`}>Security Score: {scoreLabel}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {issueCount === 0
                  ? "All checks passing. Your account is well-secured."
                  : `${issueCount} issue${issueCount > 1 ? "s" : ""} detected. Review recommendations below to improve your score.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(
                  SECURITY_CHECKS.reduce((acc, c) => {
                    acc[c.status] = (acc[c.status] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([status, count]) => {
                  const cfg = STATUS_CFG[status as RiskLevel];
                  return (
                    <span key={status} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg}`} style={{ color: cfg.color }}>
                      {count}× {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {(["overview", "audit"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg border border-b-0 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all capitalize ${
                tab === t
                  ? "border-border bg-card text-foreground -mb-px"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "overview" ? "Security Checks" : "Audit Trail"}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══ */}
        {tab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {Object.entries(categorised).map(([category, checks], catIdx) => {
              const catIssues = checks.filter(c => c.status !== "pass").length;
              return (
                <div key={category}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="font-display text-sm font-bold text-foreground">{category}</h3>
                    {catIssues > 0 && (
                      <span className="rounded-full bg-bearish/10 px-2 py-0.5 text-xs font-bold text-bearish">
                        {catIssues} issue{catIssues > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {checks.map((check, i) => {
                      const cfg = STATUS_CFG[check.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <motion.div
                          key={check.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: catIdx * 0.05 + i * 0.03 }}
                          className="rounded-xl border border-border bg-card p-4"
                        >
                          <div className="flex items-start gap-4">
                            <StatusIcon size={16} className="mt-0.5 shrink-0" style={{ color: cfg.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-foreground">{check.label}</span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.bg}`}
                                  style={{ color: cfg.color }}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{check.description}</p>
                              {check.recommendation && (
                                <div className="mt-2 flex items-start gap-2 rounded-lg border border-current/20 bg-current/5 p-2" style={{ borderColor: `${cfg.color}30`, background: `${cfg.color}08` }}>
                                  <AlertTriangle size={10} className="mt-0.5 shrink-0" style={{ color: cfg.color }} />
                                  <p className="text-xs leading-relaxed" style={{ color: cfg.color }}>{check.recommendation}</p>
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              {check.status === "pass"
                                ? <CheckCircle2 size={16} className="text-bullish" />
                                : <XCircle size={16} className="text-bearish" />}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ══ AUDIT TRAIL ══ */}
        {tab === "audit" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Filter:</span>

              {(["all", "login", "trade", "settings", "api", "auth", "alert"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold capitalize transition-all ${
                    eventFilter === f
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "All" : f}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowSuccess(v => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-all ${showSuccess ? "border-bullish/40 bg-bullish/10 text-bullish" : "border-border text-muted-foreground"}`}
                >
                  <Eye size={11} /> Success
                </button>
                <button
                  onClick={() => setShowFailed(v => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-all ${showFailed ? "border-bearish/40 bg-bearish/10 text-bearish" : "border-border text-muted-foreground"}`}
                >
                  <EyeOff size={11} /> Failed
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Time", "Type", "Action", "Detail", "IP Address", "Device", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center font-mono text-xs text-muted-foreground/50">
                        No events match your filter
                      </td>
                    </tr>
                  ) : filteredEvents.map((event, i) => {
                    const TypeIcon = EVENT_ICONS[event.type];
                    return (
                      <motion.tr
                        key={event.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`border-b border-border/40 transition-colors hover:bg-accent/20 ${!event.success ? "bg-bearish/5" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock size={10} /> {timeAgo(event.timestamp)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon size={12} className={`${
                              event.type === "alert" ? "text-bearish" :
                              event.type === "auth"  ? "text-bearish" :
                              event.type === "trade" ? "text-bullish" :
                              "text-muted-foreground"
                            }`} />
                            <span className="text-xs capitalize text-muted-foreground">{event.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">{event.action}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{event.detail}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{event.ip}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {event.device.includes("iOS") || event.device.includes("Android")
                              ? <Smartphone size={10} />
                              : <Monitor size={10} />}
                            {event.device}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                            event.success ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                          }`}>
                            {event.success ? <CheckCircle2 size={8} /> : <XCircle size={8} />}
                            {event.success ? "Success" : "Failed"}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-right text-xs uppercase tracking-widest text-muted-foreground/40">
              Audit log is illustrative · Connect to a live logging provider for production-grade audit trails
            </p>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
