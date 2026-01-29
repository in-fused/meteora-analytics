// state/useAppState.tsx
import { useEffect } from 'react'
import { transactionStream } from '../services/transactionStream'
import { opportunityPools } from '../config/opportunityPools'

export function useAppState() {
  useEffect(() => {
    transactionStream.initialize()

    transactionStream.registerPools(
      opportunityPools.map(p => ({
        address: p.poolAddress,
        protocol: p.protocol // 'meteora' | 'raydium'
      }))
    )

    return () => {
      transactionStream.shutdown()
    }
  }, [])
}
