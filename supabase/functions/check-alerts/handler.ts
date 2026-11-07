// check-alerts request handler (separate from index.ts so Vitest can import it).
// Two callers: an approved user (user-scoped client, RLS limits the scan to their own alerts) or the
// scheduler presenting x-cron-secret (only then is the service-role client built).
import {
  errorResponse,
  fetchT,
  isResponse,
  jsonResponse,
  preflight,
  requireCronOrUser,
  type AuthDeps,
} from '../_shared/auth.ts'
import { DATA_DAILY_CAP, consumeUsage, usageResponse } from '../_shared/limits.ts'

export const FN_NAME = 'check-alerts'

/** Minimal shape of the alerts client (user-scoped or service-role). */
export interface AlertsDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

export interface CheckAlertsDeps {
  auth: AuthDeps
  /** Builds the service-role client. Called ONLY after the caller is authenticated as cron. */
  makeAdminClient: () => AlertsDb
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Alert {
  id: string
  user_id: string
  symbol: string
  condition_type: string
  threshold: number
  delivery: string
  webhook_url: string | null
  note: string | null
}

interface OHLCVBar {
  o: number
  h: number
  l: number
  c: number
  v: number
  t: number
}

// ── RSI computation ────────────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  const changes = closes.slice(1).map((c, i) => c - closes[i])
  let gains = 0
  let losses = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) gains += changes[i]
    else losses += Math.abs(changes[i])
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] >= 0 ? changes[i] : 0
    const l = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ── Polygon helpers ────────────────────────────────────────────────────────

async function fetchLastTrade(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetchT(`https://api.polygon.io/v2/last/trade/${encodeURIComponent(symbol)}?apiKey=${apiKey}`)
    const data = await res.json()
    return data?.results?.p ?? null
  } catch {
    return null
  }
}

async function fetchPrevClose(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetchT(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${apiKey}`)
    const data = await res.json()
    const result = data?.results?.[0]
    return result?.c ?? null
  } catch {
    return null
  }
}

async function fetch14DayBars(symbol: string, apiKey: string): Promise<OHLCVBar[]> {
  try {
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0]
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=20&apiKey=${apiKey}`
    const res = await fetchT(url)
    const data = await res.json()
    return data?.results ?? []
  } catch {
    return []
  }
}

// ── Condition evaluator ────────────────────────────────────────────────────

interface EvalResult {
  triggered: boolean
  currentValue: number | null
}

async function evaluateAlert(alert: Alert, apiKey: string): Promise<EvalResult> {
  const { condition_type, threshold, symbol } = alert

  if (condition_type === 'price_above' || condition_type === 'price_below') {
    const price = await fetchLastTrade(symbol, apiKey)
    if (price === null) return { triggered: false, currentValue: null }
    const triggered = condition_type === 'price_above' ? price > threshold : price < threshold
    return { triggered, currentValue: price }
  }

  if (condition_type === 'pct_change_above' || condition_type === 'pct_change_below') {
    const [price, prevClose] = await Promise.all([
      fetchLastTrade(symbol, apiKey),
      fetchPrevClose(symbol, apiKey),
    ])
    if (price === null || prevClose === null || prevClose === 0) return { triggered: false, currentValue: null }
    const pct = ((price - prevClose) / prevClose) * 100
    const triggered = condition_type === 'pct_change_above' ? pct > threshold : pct < threshold
    return { triggered, currentValue: Math.round(pct * 100) / 100 }
  }

  if (condition_type === 'rsi_above' || condition_type === 'rsi_below') {
    const bars = await fetch14DayBars(symbol, apiKey)
    if (bars.length < 2) return { triggered: false, currentValue: null }
    const closes = bars.map((b) => b.c)
    const rsi = computeRSI(closes)
    const rounded = Math.round(rsi * 100) / 100
    const triggered = condition_type === 'rsi_above' ? rsi > threshold : rsi < threshold
    return { triggered, currentValue: rounded }
  }

  if (condition_type === 'volume_spike') {
    const bars = await fetch14DayBars(symbol, apiKey)
    if (bars.length < 2) return { triggered: false, currentValue: null }
    const avgVol = bars.slice(0, -1).reduce((s, b) => s + b.v, 0) / (bars.length - 1)
    const todayVol = bars[bars.length - 1].v
    const ratio = avgVol > 0 ? todayVol / avgVol : 0
    const rounded = Math.round(ratio * 100) / 100
    const triggered = ratio > threshold
    return { triggered, currentValue: rounded }
  }

  return { triggered: false, currentValue: null }
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function handle(req: Request, deps: CheckAlertsDeps): Promise<Response> {
  const env = deps.auth.env
  const pre = preflight(req, env)
  if (pre) return pre

  try {
    const caller = await requireCronOrUser(req, deps.auth)
    if (isResponse(caller)) return caller

    const POLYGON_KEY = env('POLYGON_KEY')
    if (!POLYGON_KEY) return errorResponse(req, env, 500, 'POLYGON_KEY is not configured')

    let db: AlertsDb
    if (caller.mode === 'cron') {
      db = deps.makeAdminClient()
    } else {
      // User mode: every query below runs as the caller, so RLS limits it to their own alerts.
      const gate = await consumeUsage(caller.client, 'data', FN_NAME, DATA_DAILY_CAP)
      if (gate !== 'ok') return usageResponse(req, env, gate)
      db = caller.client
    }

    // Fetch active alerts (all users in cron mode, the caller's own in user mode)
    const { data: activeAlerts, error: fetchError } = await db
      .from('alerts')
      .select('*')
      .eq('status', 'active')

    if (fetchError) throw new Error(fetchError.message)
    if (!activeAlerts || activeAlerts.length === 0) {
      return jsonResponse(req, env, { checked: 0, triggered: 0 })
    }

    let triggeredCount = 0
    const now = new Date().toISOString()

    // Evaluate each alert (group by symbol to share fetches where possible)
    await Promise.all(
      activeAlerts.map(async (alert: Alert) => {
        const { triggered, currentValue } = await evaluateAlert(alert, POLYGON_KEY)

        // Always update current_value even if not triggered
        const updatePayload: Record<string, unknown> = { current_value: currentValue }

        if (triggered) {
          updatePayload.status = 'triggered'
          updatePayload.triggered_at = now

          // Guarded by status='active' so overlapping runs cannot double-fire the webhook.
          const { data: claimed } = await db
            .from('alerts')
            .update(updatePayload)
            .eq('id', alert.id)
            .eq('status', 'active')
            .select('id')
          if (!claimed || claimed.length === 0) return
          triggeredCount++

          // Webhook delivery — validate URL to prevent SSRF
          if ((alert.delivery === 'webhook' || alert.delivery === 'both') && alert.webhook_url) {
            let safeUrl: URL;
            try {
              safeUrl = new URL(alert.webhook_url);
            } catch {
              console.warn(`Invalid webhook URL for alert ${alert.id}, skipping`);
              safeUrl = null as any;
            }
            const isAllowed = safeUrl &&
              safeUrl.protocol === 'https:' &&
              !['localhost','127.0.0.1','0.0.0.0','169.254.169.254','::1'].includes(safeUrl.hostname) &&
              !/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(safeUrl.hostname);
            if (!isAllowed) {
              console.warn(`Blocked unsafe webhook URL for alert ${alert.id}`);
            }
            if (isAllowed) try {
              await fetchT(alert.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: alert.symbol,
                  condition_type: alert.condition_type,
                  threshold: alert.threshold,
                  current_value: currentValue,
                  triggered_at: now,
                }),
              }, 10000)
            } catch {
              // Best-effort webhook delivery; don't block on failure
            }
          }
        } else {
          await db.from('alerts').update(updatePayload).eq('id', alert.id)
        }
      })
    )

    return jsonResponse(req, env, { checked: activeAlerts.length, triggered: triggeredCount })
  } catch (error) {
    return errorResponse(req, env, 500, error)
  }
}
