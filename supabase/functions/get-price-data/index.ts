import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { realAuthDeps } from '../_shared/auth-deno.ts'
import { corsHeaders as sharedCors, errorResponse, fetchT, isResponse, preflight, readJsonBody, requireUser } from '../_shared/auth.ts'
import { BODY_CAP_BYTES, DATA_DAILY_CAP, consumeUsage, usageResponse } from '../_shared/limits.ts'
import { asObject, cleanTicker } from '../_shared/validate.ts'

const TIMEFRAME_MAP = {
  '1D': { multiplier: 5,  timespan: 'minute', days: 1   },
  '5D': { multiplier: 1,  timespan: 'hour',   days: 5   },
  '1M': { multiplier: 1,  timespan: 'day',    days: 30  },
  '3M': { multiplier: 1,  timespan: 'day',    days: 90  },
  '1Y': { multiplier: 1,  timespan: 'week',   days: 365 },
}

serve(async (req) => {
  const deps = realAuthDeps()
  const env = deps.env
  const corsHeaders = sharedCors(req, env)

  const pre = preflight(req, env)
  if (pre) return pre
  const auth = await requireUser(req, deps)
  if (isResponse(auth)) return auth
  const parsed = await readJsonBody(req, env, BODY_CAP_BYTES.default)
  if (!parsed.ok) return parsed.response

  const { ticker: rawTicker, timeframe: rawTf } = asObject(parsed.body)
  const ticker = cleanTicker(rawTicker)
  // Shape-checked only: unknown but well-formed values (the chart UI sends 6M) fall back to 1M as before.
  const timeframe = rawTf === undefined || rawTf === null ? '1M' : typeof rawTf === 'string' && /^[0-9A-Za-z]{1,4}$/.test(rawTf) ? rawTf : null
  if (!ticker || !timeframe) return errorResponse(req, env, 400, 'invalid ticker or timeframe')

  const gate = await consumeUsage(auth.client, 'data', 'get-price-data', DATA_DAILY_CAP)
  if (gate !== 'ok') return usageResponse(req, env, gate)

  try {
    const tf = TIMEFRAME_MAP[timeframe as keyof typeof TIMEFRAME_MAP] || TIMEFRAME_MAP['1M']
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - tf.days * 86400000)
      .toISOString().split('T')[0]

    const key = env('POLYGON_KEY')
    if (!key) return errorResponse(req, env, 500, 'POLYGON_KEY not set')

    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${key}`
    const res = await fetchT(url)
    const data = await res.json()

    const candles = (data.results || []).map((r: any) => ({
      time: Math.floor(r.t / 1000),
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v
    }))

    return new Response(JSON.stringify({ candles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return errorResponse(req, env, 502, error)
  }
})
