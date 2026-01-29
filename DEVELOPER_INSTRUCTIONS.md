# Developer Instructions

## Project Structure

```
/meteora-analytics/
├── app/                          # React frontend (v2)
│   ├── src/
│   │   ├── types/index.ts        # Pool, Alert, Wallet interfaces
│   │   ├── config/index.ts       # API endpoints, constants, wallet configs
│   │   ├── lib/utils.ts          # Formatting, scoring, opportunity detection
│   │   ├── services/
│   │   │   ├── dataService.ts    # Meteora, Raydium, Jupiter fetching
│   │   │   ├── wsService.ts      # Helius WebSocket (lazy on-demand)
│   │   │   └── walletService.ts  # Phantom, Solflare, Backpack
│   │   ├── hooks/
│   │   │   └── useAppState.tsx   # Zustand global state (25+ properties)
│   │   ├── components/
│   │   │   ├── Header.tsx        # Nav, wallet, API status badges
│   │   │   ├── HeroSection.tsx   # Stats banner
│   │   │   ├── OpportunitiesSection.tsx  # AI opportunities grid
│   │   │   ├── SearchAlertsSection.tsx   # Search, filters, alerts
│   │   │   ├── GuideSection.tsx  # Documentation accordion
│   │   │   ├── PoolCard.tsx      # Pool scorecard + expansion
│   │   │   └── Particles.tsx     # Canvas particle background
│   │   ├── App.tsx               # Root + init + background refresh
│   │   ├── main.tsx              # React entry
│   │   └── index.css             # All styles (CSS variables + Tailwind)
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── server/                       # Express backend
│   └── index.js                  # API proxies, WebSocket, caching
│
├── api/                          # Vercel serverless functions
│   ├── proxy/
│   │   ├── dlmm.js              # Meteora DLMM proxy
│   │   ├── damm.js              # Meteora DAMM v2 proxy
│   │   ├── raydium.js           # Raydium CLMM proxy
│   │   └── jupiter-tokens.js    # Jupiter verified tokens
│   └── helius/
│       ├── rpc.js               # Helius RPC proxy
│       └── batch.js             # Helius batch RPC
│
├── public/
│   └── index.html               # Legacy monolithic frontend (v1)
│
├── LIQUIDITYPRO_PRD.md
├── DEVELOPER_INSTRUCTIONS.md
└── TASK_CHECKLIST.md
```

## Setup

```bash
# Backend
npm install
npm start                    # Starts Express on :8080

# Frontend (React)
cd app
npm install
npm run dev                  # Starts Vite dev server on :3000 (proxies to :8080)
npm run build                # Builds to ../public/
```

## Key Architecture Decisions

1. **Data Sources Priority**: Meteora DLMM > Meteora DAMM v2 > Raydium CLMM > DexScreener (fallback)
2. **Helius is on-demand**: WebSocket connects only when user expands a pool card. Disconnects when no subscriptions.
3. **Jupiter for safety only**: Token verification list, not pricing. Later: Jupiter Ultra for in-app swaps.
4. **60-second refresh**: Background data refresh every 60s, skipped when user has expanded card or tab hidden.
5. **Server-side API keys**: Helius key never exposed to client. All RPC calls go through Express/Vercel proxy.

## Environment Variables

```
HELIUS_KEY=<your-helius-api-key>
PORT=8080
```

## Data Flow

1. `dataService.fetchPools()` → parallel fetch DLMM + DAMM + Raydium → normalize → `store.setPools()`
2. `detectOpportunities(pools)` → score-based filtering → `store.setOpportunities()`
3. `dataService.applyFilters()` → client-side filter/sort → `store.setFilteredPools()`
4. Pool expand → `wsService.subscribeToPool()` → lazy WS connect → `store.setPoolTransactions()`
5. Background refresh every 60s → re-fetch + re-detect + re-filter
