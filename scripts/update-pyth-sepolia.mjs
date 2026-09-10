import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv(join(root, 'swap-vm/.env'))

const deployment = JSON.parse(readFileSync(join(root, 'swap-vm/deployments/sepolia/ZubiDubiAssets.json'), 'utf8'))
const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL
const privateKey = process.env.SEPOLIA_PRIVATE_KEY
const pyth = process.env.ZUBIDUBI_PYTH || deployment.pyth
const priceId = (process.env.ZUBIDUBI_PYTH_ETH_USD_ID || deployment.pythEthUsdPriceId).replace(/^0x/u, '')
const apiKey = process.env.PYTH_HERMES_API_KEY
const hermesUrl = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network'

if (!rpcUrl) throw new Error('Missing SEPOLIA_RPC_URL in swap-vm/.env.')
if (!privateKey) throw new Error('Missing SEPOLIA_PRIVATE_KEY in swap-vm/.env.')
if (!apiKey) throw new Error('Missing PYTH_HERMES_API_KEY. Pyth Hermes requires an API key for price update routes.')

const account = privateKeyToAccount(privateKey)
const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) })
const pythAbi = parseAbi([
  'function getUpdateFee(bytes[] updateData) view returns (uint256)',
  'function updatePriceFeeds(bytes[] updateData) payable',
  'function getPriceUnsafe(bytes32 id) view returns (tuple(int64 price,uint64 conf,int32 expo,uint32 publishTime))',
])

const updateData = await fetchUpdateData()
const fee = await publicClient.readContract({
  address: pyth,
  abi: pythAbi,
  functionName: 'getUpdateFee',
  args: [updateData],
})

const hash = await wallet.writeContract({
  address: pyth,
  abi: pythAbi,
  functionName: 'updatePriceFeeds',
  args: [updateData],
  value: fee,
})
const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') throw new Error(`Pyth update failed: ${hash}`)

const price = await publicClient.readContract({
  address: pyth,
  abi: pythAbi,
  functionName: 'getPriceUnsafe',
  args: [`0x${priceId}`],
})

console.log(JSON.stringify({
  pyth,
  priceId: `0x${priceId}`,
  updateTx: hash,
  feeWei: fee.toString(),
  price: price.price.toString(),
  confidence: price.conf.toString(),
  exponent: price.expo,
  publishTime: price.publishTime,
}, null, 2))

async function fetchUpdateData() {
  const url = new URL('/v2/updates/price/latest', hermesUrl)
  url.searchParams.append('ids[]', priceId)
  const res = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      authorization: `Bearer ${apiKey}`,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.binary?.data?.length) {
    throw new Error(`Hermes update fetch failed: ${res.status} ${JSON.stringify(body)}`)
  }
  return body.binary.data.map((hex) => `0x${hex.replace(/^0x/u, '')}`)
}

function loadEnv(path) {
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')
    if (!process.env[key]) process.env[key] = value
  }
}
