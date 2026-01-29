// components/PoolCard.tsx
import { useEffect, useState } from 'react'
import { transactionStream, PoolUpdate } from '../services/transactionStream'

export function PoolCard({ poolAddress }: { poolAddress: string }) {
  const [snapshot, setSnapshot] = useState<any>(null)
  const [deltas, setDeltas] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    const handler = (update: PoolUpdate) => {
      setSnapshot(update.snapshot)
      setDeltas(update.deltas)
    }

    transactionStream.subscribe(poolAddress, handler)

    return () => {
      transactionStream.unsubscribe(poolAddress, handler)
    }
  }, [poolAddress])

  if (!snapshot) return null

  return (
    <div className="pool-card">
      {snapshot.bins.map(bin => {
        const delta = deltas.get(bin.id) || 0
        const isActive = bin.id === snapshot.activeBin

        return (
          <div
            key={bin.id}
            className={`bin ${
              isActive ? 'active' : ''
            } ${delta > 0 ? 'flash-green' : ''} ${
              delta < 0 ? 'flash-red' : ''
            }`}
          >
            {bin.liquidity}
          </div>
        )
      })}
    </div>
  )
}
