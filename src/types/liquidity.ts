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
  price?: number
  timestamp: number
}
