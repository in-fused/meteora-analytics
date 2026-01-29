// services/transactionStream.ts
import EventEmitter from 'eventemitter3'
import { fetchMeteoraBins, UnifiedBinSnapshot } from './meteoraBinService'
import { fetchRaydiumCLMMBins } from './raydiumClmmService'

type PoolProtocol = 'meteora' | 'raydium'

type PoolRef = {
  protocol: PoolProtocol
  refCount: number
  lastSnapshot?: UnifiedBinSnapshot
  polling: boolean
}

export type PoolUpdate = {
  snapshot: UnifiedBinSnapshot
  deltas: Map<number, number>
}

class TransactionStreamService {
  private emitter = new EventEmitter()
  private pools = new Map<string, PoolRef>()
  private initialized = false

  initialize() {
    this.initialized = true
  }

  shutdown() {
    this.emitter.removeAllListeners()
    this.pools.clear()
    this.initialized = false
  }

  registerPools(
    pools: { address: string; protocol: PoolProtocol }[]
  ) {
    pools.forEach(({ address, protocol }) => {
      if (!this.pools.has(address)) {
        this.pools.set(address, {
          protocol,
          refCount: 0,
          polling: false
        })
        this.startPolling(address)
      }
    })
  }

  subscribe(pool: string, cb: (u: PoolUpdate) => void) {
    const ref = this.pools.get(pool)
    if (!ref) return

    ref.refCount++
    this.emitter.on(pool, cb)
  }

  unsubscribe(pool: string, cb: (u: PoolUpdate) => void) {
    const ref = this.pools.get(pool)
    if (!ref) return

    ref.refCount--
    this.emitter.off(pool, cb)

    console.assert(ref.refCount >= 0, 'Negative refCount detected')
  }

  private async fetchSnapshot(
    pool: string,
    protocol: PoolProtocol
  ): Promise<UnifiedBinSnapshot> {
    if (protocol === 'meteora') {
      return fetchMeteoraBins(pool)
    }
    return fetchRaydiumCLMMBins(pool)
  }

  private startPolling(pool: string) {
    const ref = this.pools.get(pool)
    if (!ref || ref.polling) return

    ref.polling = true

    const poll = async () => {
      try {
        const snapshot = await this.fetchSnapshot(pool, ref.protocol)
        const deltas = new Map<number, number>()

        if (ref.lastSnapshot) {
          snapshot.bins.forEach(bin => {
            const prev = ref.lastSnapshot!.bins.find(
              b => b.id === bin.id
            )
            if (!prev) return
            const delta = bin.liquidity - prev.liquidity
            if (delta !== 0) deltas.set(bin.id, delta)
          })
        }

        ref.lastSnapshot = snapshot

        this.emitter.emit(pool, { snapshot, deltas })
      } catch (err) {
        console.warn('[TransactionStream]', pool, err)
      } finally {
        setTimeout(poll, 2000)
      }
    }

    poll()
  }
}

export const transactionStream = new TransactionStreamService()
