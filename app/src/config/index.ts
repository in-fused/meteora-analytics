// ═══════════════════════════════════════════════════════════════════════════
// APPLICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const IS_MOBILE = /Mobi|Android/i.test(navigator.userAgent);

export const CONFIG = {
  // Platform detection
  IS_MOBILE,
  IS_IOS,
  RENDER_BATCH_SIZE: IS_MOBILE ? 20 : 50,
  ANIMATION_ENABLED: !IS_IOS,

  // Meteora API endpoints (via proxy)
  METEORA_DLMM: '/api/proxy/dlmm',
  METEORA_DAMM_V2: '/api/proxy/damm',
  METEORA_DLMM_PROGRAM: '9y5u1v31x1787u493xj2476k9x27288591f9k3792181',

  // Raydium Concentrated Liquidity Pools
  RAYDIUM_CLMM: '/api/proxy/raydium',
  RAYDIUM_CLMM_PROGRAM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',

  // Jupiter (authenticated via server proxy)
  JUPITER_PRICE: 'https://api.jup.ag/price/v3/price',
  JUPITER_TOKENS: '/api/proxy/jupiter-tokens',
  JUPITER_ULTRA_API: 'https://api.jup.ag/ultra/v1',

  // Helius RPC (via server proxy — server uses Gatekeeper beta internally)
  HELIUS_RPC: '/api/helius/rpc',
  HELIUS_BATCH: '/api/helius/batch',

  // WebSocket (server handles Enhanced WS → standard fallback internally)
  WS_URL: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
  WS_RECONNECT_DELAY: 3000,
  MAX_ERRORS: 5,

  // Refresh intervals
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
  } as Record<string, string>,

  // Supabase
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || 'https://gdcjtkzxyafvexaaghgh.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkY2p0a3p4eWFmdmV4YWFnaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMjM3MDYsImV4cCI6MjA4NjU5OTcwNn0.UQxbRBt1mR-vOOiU68Rt59Drre2gTNGQK__SlEc36wY',

  // Platform fee
  PLATFORM_FEE_BPS: 10, // 0.1%
  FEE_WALLET: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',

  // Tip jar
  TIP_WALLET: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',

  // Wallet providers
  WALLETS: {
    phantom: {
      name: 'Phantom',
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjNTUyQkYwIiByeD0iOCIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0yOSAxOWMtMS44LTEuNS00LjItMi44LTctMi44LTQuMiAwLTcuNyAzLjYtNy43IDguMiAwIDIuOCAxLjIgNS4yIDMuMyA2LjguMi4xLjMuMi41LjJzLjMtLjEuNC0uMmMuNC0uMy44LS41IDEuMS0uNS44IDAgMS41LjcgMS42IDEuNSAwIC4yLjIuMy4zLjNoNC41Yy4xIDAgLjMtLjEuMy0uMy4yLTEuNCAxLjQtMi40IDIuOC0yLjQuNyAwIDEuNC4zIDEuOS44LjEuMS4zLjIuNC4ycy4zLS4xLjQtLjJjMi0xLjcgMy4zLTQuMiAzLjMtNyAwLTEuNy0uNS0zLjMtMS41LTQuNi0uMy0uNC0uNi0uNy0uOS0xLS4zLS4zLS42LS41LS44LS44em0tNyAyLjJjMCAuNy0uNiAxLjMtMS4zIDEuM3MtMS4zLS42LTEuMy0xLjMuNi0xLjMgMS4zLTEuMyAxLjMuNiAxLjMgMS4zem00LjggMGMwIC43LS42IDEuMy0xLjMgMS4zcy0xLjMtLjYtMS4zLTEuMy42LTEuMyAxLjMtMS4zIDEuMy42IDEuMyAxLjN6Ii8+PC9zdmc+',
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
