import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TIMEFRAME_MAP = {
  '1D': { multiplier: 5,  timespan: 'minute', days: 1   },
  '5D': { multiplier: 1,  timespan: 'hour',   days: 5   },
  '1M': { multiplier: 1,  timespan: 'day',    days: 30  },
  '3M': { multiplier: 1,  timespan: 'day',    days: 90  },
  '1Y': { multiplier: 1,  timespan: 'week',   days: 365 },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ticker, timeframe } = await req.json()
    const tf = TIMEFRAME_MAP[timeframe as keyof typeof TIMEFRAME_MAP] || TIMEFRAME_MAP['1M']
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - tf.days * 86400000)
      .toISOString().split('T')[0]
    
    const key = Deno.env.get('POLYGON_KEY')
    if (!key) {
      return new Response(JSON.stringify({ error: 'POLYGON_KEY not set' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${key}`
    const res = await fetch(url)
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
