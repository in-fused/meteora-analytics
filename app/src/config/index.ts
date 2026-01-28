// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const CONFIG = {
  // Platform detection
  IS_MOBILE,
  IS_IOS,

  // Meteora API endpoints (via proxy)
  METEORA_DLMM: '/api/proxy/dlmm',
  METEORA_DAMM_V2: '/api/proxy/damm',
  METEORA_PROGRAM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',

  // Raydium Concentrated Liquidity Pools
  RAYDIUM_CLMM: '/api/proxy/raydium',

  // Jupiter Token Verification (via proxy)
  JUPITER_PRICE: 'https://api.jup.ag/price/v3/price',
  JUPITER_TOKENS: '/api/proxy/jupiter-tokens',
  JUPITER_ULTRA_API: 'https://api.jup.ag/ultra/v1',

  // Helius RPC (via proxy)
  HELIUS_RPC: '/api/helius/rpc',
  HELIUS_BATCH: '/api/helius/batch',

  // WebSocket
  WS_URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,

  // Refresh intervals (optimized)
  REFRESH_INTERVAL: 60000,  // 60 seconds
  FAST_REFRESH: 30000,      // 30 seconds

  // Pool limits
  POOL_LIMIT: IS_MOBILE ? 200 : 500,

  // Scoring thresholds
  SCORE_HIGH: 75,
  SCORE_MEDIUM: 50,
  SCORE_LOW: 25,

  // Common Solana mints
  MINTS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  },

  // Platform fee
  PLATFORM_FEE_BPS: 10, // 0.1%
  FEE_WALLET: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',

  // Tip jar
  TIP_WALLET: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',

  // Wallet providers
  WALLETS: {
    phantom: {
      name: 'Phantom',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjQUIzN0YyIi8+PHBhdGggZD0iTTI5LjUgMjAuNUMyOS41IDI2LjUgMjUgMzEgMjAgMzFDMTUgMzEgMTAuNSAyNi41IDEwLjUgMjAuNUMxMC41IDE0LjUgMTUgMTAgMjAgMTBDMjUgMTAgMjkuNSAxNC41IDI5LjUgMjAuNVoiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
      getProvider: () => (window as any).phantom?.solana,
      downloadUrl: 'https://phantom.app',
    },
    solflare: {
      name: 'Solflare',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkM2QjFEIi8+PHBhdGggZD0iTTIwIDEwTDI4IDE1VjI1TDIwIDMwTDEyIDI1VjE1TDIwIDEwWiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
      getProvider: () => (window as any).solflare,
      downloadUrl: 'https://solflare.com',
    },
    backpack: {
      name: 'Backpack',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRTMzNjI5Ii8+PHBhdGggZD0iTTIwIDhDMTMuNCAgOCA4IDEzLjQgOCAyMFYyOEgzMlYyMEMzMiAxMy40IDI2LjYgOCAyMCA4WiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=',
      getProvider: () => (window as any).backpack,
      downloadUrl: 'https://backpack.app',
    },
  },
} as const;
