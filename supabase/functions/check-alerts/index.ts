import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const res = await fetch(`https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${apiKey}`)
    const data = await res.json()
    return data?.results?.p ?? null
  } catch {
    return null
  }
}

async function fetchPrevClose(symbol: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${apiKey}`)
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
    const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=20&apiKey=${apiKey}`
    const res = await fetch(url)
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const POLYGON_KEY = Deno.env.get('POLYGON_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!POLYGON_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Fetch all active alerts
    const { data: activeAlerts, error: fetchError } = await db
      .from('alerts')
      .select('*')
      .eq('status', 'active')

    if (fetchError) throw new Error(fetchError.message)
    if (!activeAlerts || activeAlerts.length === 0) {
      return new Response(JSON.stringify({ checked: 0, triggered: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
          triggeredCount++
          updatePayload.status = 'triggered'
          updatePayload.triggered_at = now

          await db.from('alerts').update(updatePayload).eq('id', alert.id)

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
              await fetch(alert.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: alert.symbol,
                  condition_type: alert.condition_type,
                  threshold: alert.threshold,
                  current_value: currentValue,
                  triggered_at: now,
                }),
              })
            } catch {
              // Best-effort webhook delivery; don't block on failure
            }
          }
        } else {
          await db.from('alerts').update(updatePayload).eq('id', alert.id)
        }
      })
    )

    return new Response(
      JSON.stringify({ checked: activeAlerts.length, triggered: triggeredCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
