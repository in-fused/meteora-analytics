# Task Checklist

## Completed

- [x] Fix scorecard expansion in Search & Alerts tab (duplicate DOM ID bug)
- [x] Fix scorecard expansion across all tabs (AI Opportunities, Search Pools, Pool Filters)
- [x] Relax CSS containment for smooth expand/collapse animations
- [x] Add Raydium CLMM as core data source (proxy, processing, UI)
- [x] Replace Birdeye with Raydium in API status badges
- [x] Make Helius WebSocket on-demand (lazy connect, auto-disconnect)
- [x] Optimize background refresh interval (45s → 60s)
- [x] Create React + TypeScript + Vite + Tailwind project structure
- [x] Extract types, config, utils into separate modules
- [x] Create Zustand global state store
- [x] Create DataService (Meteora, Raydium, Jupiter, DexScreener)
- [x] Create WSService (lazy on-demand Helius)
- [x] Create WalletService (Phantom, Solflare, Backpack)
- [x] Create all React components (Header, HeroSection, PoolCard, etc.)
- [x] Create App.tsx with init, background refresh, keyboard shortcuts
- [x] Extract CSS from monolith into index.css
- [x] Create PRD, Developer Instructions, Task Checklist
- [x] Add toast notification system (DOM-based, XSS-safe)
- [x] Add wallet selection modal (choose between Phantom/Solflare/Backpack)
- [x] Implement alert checking logic in background refresh
- [x] Add alert notification dropdown component

## Audit Fixes Applied (2026-01-29)

- [x] CRIT-1: Remove hardcoded Helius API key fallback from 3 files (server, rpc, batch)
- [x] CRIT-2: Fix PoolCard prop interface mismatch (SearchAlertsSection passed isExpanded/onToggle)
- [x] CRIT-3: Fix DexScreener fallback protocol label (was hardcoded 'Meteora DLMM')
- [x] CRIT-4: Add retry limit (3x) with exponential backoff to fetchPools
- [x] HIGH-1: Rename wsService.connect() to init() for clarity
- [x] HIGH-2: Fix innerHTML XSS vulnerability in toastService (use textContent)
- [x] HIGH-3: Add alert deduplication with 5-minute cooldown
- [x] HIGH-4: Fix formatLastRefresh stale memoization (useEffect interval)
- [x] HIGH-5: Fix column resize responsiveness (useColumnCount hook)
- [x] MED-2: Fix autoConnect to restore any saved wallet provider
- [x] MED-3: Fix generateBins non-deterministic Math.random() (deterministic seed)
- [x] MED-4: Fix server cache eviction (TTL-based + LRU fallback)
- [x] MED-5: Add configurable CORS origins via CORS_ORIGINS env var
- [x] MED-6: Add RPC method allowlist to Helius proxy (server + Vercel)
- [x] MED-8: Fix hardcoded 1e6 token decimals in execution modal
- [x] LOW-3: Remove unused copyIcon export from utils
- [x] LOW-4: Remove unused FAST_REFRESH config value
- [x] LOW-5: Remove unused searchResults state from Zustand store

## Pending / Future

- [ ] Install npm dependencies and verify TypeScript build compiles
- [ ] Test card expansion in all contexts (React version)
- [ ] Add Jupiter Ultra swap execution (in-app signing)
- [ ] Add email capture component
- [ ] Add tip jar modal
- [ ] Performance testing on mobile devices
- [ ] Add error boundaries to React components
- [ ] Add loading skeletons for pool cards
- [ ] Extract shared PoolExpanded subcomponent (deduplicate ~140 lines)
- [ ] E2E testing with Playwright
- [ ] Deploy React version to Vercel
- [ ] Restrict Vercel serverless CORS origins for production
- [ ] Rotate exposed Helius API key (key was in git history)
