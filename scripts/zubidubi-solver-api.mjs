import { createServer } from 'node:http'
import { listZubiDubiMarkets, quoteZubiDubiRoute, toPublicQuote } from './zubidubi-solver-core.mjs'

const port = Number(process.env.PORT || process.env.ZUBIDUBI_SOLVER_PORT || 8787)

const pitch = {
  name: 'ZubiDubi',
  oneLiner: 'A self-custodial term-liquidity network for Pendle-like maturing DeFi assets.',
  thesis: 'Makers quote programmable risk curves through Aqua and SwapVM; sellers get instant USDC for delayed-redemption assets without LPs locking capital into isolated pools.',
  whyAqua: 'Aqua lets one maker wallet share the same USDC across many maturing-asset strategies while settlement still checks real balance, allowance, and virtual liquidity at execution time.',
  whySwapVM: 'SwapVM turns each maker position into executable pricing logic: oracle backing, maturity discount, inventory exposure, liquidity depth, risk tier, max discount, and stale/deviating oracle protection.',
  demo: 'The API reads the live Subgraph Studio market book, reconstructs executable orders, calls the Sepolia route executor for a fresh quote, and returns a route split that can be executed atomically.',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'OPTIONS') {
      return send(res, 204, null)
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'zubidubi-solver-api' })
    }

    if (req.method === 'GET' && url.pathname === '/pitch') {
      return send(res, 200, pitch)
    }

    if (req.method === 'GET' && url.pathname === '/markets') {
      return send(res, 200, await listZubiDubiMarkets())
    }

    if (url.pathname === '/quote' && (req.method === 'GET' || req.method === 'POST')) {
      const body = req.method === 'POST' ? await readJson(req) : {}
      const tokenIn = body.tokenIn || url.searchParams.get('tokenIn') || undefined
      const tokenOut = body.tokenOut || url.searchParams.get('tokenOut') || undefined
      const amountIn = body.amountIn || url.searchParams.get('amountIn') || undefined
      const inputDecimals = body.inputDecimals || url.searchParams.get('inputDecimals') || undefined
      const quote = await quoteZubiDubiRoute({ tokenIn, tokenOut, amountIn, inputDecimals })
      return send(res, 200, toPublicQuote(quote))
    }

    return send(res, 404, {
      error: 'not_found',
      routes: [
        'GET /health',
        'GET /pitch',
        'GET /markets',
        'GET /quote?tokenIn=0x...&amountIn=0.003',
        'POST /quote {"tokenIn":"0x...","amountIn":"0.003"}',
      ],
    })
  } catch (error) {
    return send(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, () => {
  console.log(`ZubiDubi solver API listening on http://localhost:${port}`)
  console.log('Routes: GET /health | GET /pitch | GET /markets | GET /quote?amountIn=0.003')
})

function send(res, status, body) {
  res.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8',
  })
  res.end(body == null ? '' : JSON.stringify(body, null, 2))
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}
