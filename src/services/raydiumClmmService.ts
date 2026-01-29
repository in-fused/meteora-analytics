// services/raydiumClmmService.ts
import { Connection, PublicKey } from '@solana/web3.js'
import { Clmm } from '@raydium-io/raydium-sdk-v2'
import { UnifiedBinSnapshot } from './meteoraBinService'

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com'

const connection = new Connection(RPC_URL, 'confirmed')

/**
 * Fetch REAL Raydium CLMM concentrated liquidity
 * Ticks are normalized into "bins" for UI compatibility
 */
export async function fetchRaydiumCLMMBins(
  poolAddress: string
): Promise<UnifiedBinSnapshot> {
  const poolKey = new PublicKey(poolAddress)

  const poolInfo = await Clmm.fetchPoolInfo({
    connection,
    poolAddress: poolKey
  })

  const tickArrays = await Clmm.fetchTickArrays({
    connection,
    poolInfo
  })

  const bins = tickArrays.flatMap((arr: any) =>
    arr.ticks
      .filter((t: any) => t.liquidityGross > 0)
      .map((tick: any) => ({
        id: tick.tickIndex,
        liquidity: Number(tick.liquidityGross)
      }))
  )

  return {
    protocol: 'raydium',
    poolAddress,
    activeBin: poolInfo.currentTick,
    bins,
    timestamp: Date.now()
  }
}
