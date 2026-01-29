// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - LiquidityPro
// ═══════════════════════════════════════════════════════════════════════════

export const CONFIG = {
  // Meteora APIs
  METEORA_DAMM_V2: 'https://dammv2-api.meteora.ag',
  METEORA_DLMM: 'https://dlmm-api.meteora.ag',
  METEORA_PROGRAM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  
  // Jupiter APIs
  JUPITER_PRICE: 'https://api.jup.ag/price/v3/price',
  JUPITER_TOKENS: 'https://api.jup.ag/tokens/v2/tag?query=verified',
  JUPITER_API_KEY: '1259f9c1-9259-43db-aac0-0dc441c39592',
  JUPITER_ULTRA_API: 'https://api.jup.ag/ultra/v1',
  
  // Helius API
  HELIUS_KEY: '66097387-f0e6-4f93-a800-dbaac4a4c113',
  HELIUS_RPC: 'https://mainnet.helius-rpc.com/?api-key=66097387-f0e6-4f93-a800-dbaac4a4c113',
  HELIUS_WS: 'wss://mainnet.helius-rpc.com/?api-key=66097387-f0e6-4f93-a800-dbaac4a4c113',
  
  // Raydium API
  RAYDIUM_API: 'https://api.raydium.io/v2',
  
  // Refresh intervals
  REFRESH_INTERVAL: 30000,       // 30 seconds for pool data
  FAST_REFRESH: 15000,           // 15 seconds for price-sensitive data
  WS_RECONNECT_DELAY: 3000,
  MAX_ERRORS: 3,
  
  // Platform
  PLATFORM_FEE_BPS: 10, // 0.1%
  FEE_WALLET: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',
  
  // Tip SOL Address
  TIP_SOL_ADDRESS: 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',
  
  // Token mints
  MINTS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  }
};

// Wallet configurations with hosted logos
export const WALLETS = {
  phantom: {
    name: 'Phantom',
    icon: 'https://mintcdn.com/phantom-e50e2e68/fkWrmnMWhjoXSGZ9/resources/images/Phantom_SVG_Icon.svg?fit=max&auto=format&n=fkWrmnMWhjoXSGZ9&q=85&s=2d31b98ce2d16ed7999e42466a5140b1',
    downloadUrl: 'https://phantom.app'
  },
  solflare: {
    name: 'Solflare',
    icon: 'https://cdn.brandfetch.io/idtkbbbh-o/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1752568857509',
    downloadUrl: 'https://solflare.com'
  },
  backpack: {
    name: 'Backpack',
    icon: 'https://backpack.app/icons/backpack-icon.svg',
    downloadUrl: 'https://backpack.app'
  }
};
