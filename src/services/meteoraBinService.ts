// services/meteoraBinService.ts
import { Connection, PublicKey } from '@solana/web3.js'
import { MeteoraSDK } from '@meteora-ag/dlmm-sdk'

export type LiquidityProtocol = 'meteora' | 'raydium'

export interface UnifiedBin {
  id: number
  liquidity: number
}

export interface UnifiedBinSnapshot {
  protocol: LiquidityProtocol
  poolAddress: string
  activeBin: number
  bins: UnifiedBin[]
  timestamp: number
}

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC ||
  'https://api.mainnet-beta.solana.com'

const connection = new Connection(RPC_URL, 'confirmed')
const meteora = new MeteoraSDK(connection)

/**
 * Fetch REAL on-chain bin liquidity from Meteora DLMM / DAMM v2
 * This is the single source of truth for Meteora pools
 */
export async function fetchMeteoraBins(
  poolAddress: string
): Promise<UnifiedBinSnapshot> {
  const poolKey = new PublicKey(poolAddress)
  const poolState = await meteora.getPool(poolKey)

  return {
    protocol: 'meteora',
    poolAddress,
    activeBin: poolState.activeBinId,
    bins: poolState.bins.map((bin: any) => ({
      id: bin.binId,
      liquidity: Number(bin.liquidity)
    })),
    timestamp: Date.now()
  }
}
