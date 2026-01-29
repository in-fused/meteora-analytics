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

## Pending / Future

- [ ] Install npm dependencies and verify build compiles
- [ ] Test card expansion in all contexts (React version)
- [ ] Add Jupiter Ultra swap execution (in-app swaps)
- [ ] Add toast notification system (React)
- [ ] Add wallet selection modal (choose between Phantom/Solflare/Backpack)
- [ ] Add email capture component
- [ ] Add tip jar modal
- [ ] Performance testing on mobile devices
- [ ] Add error boundaries to React components
- [ ] Add loading skeletons for pool cards
- [ ] Implement alert checking logic in background refresh
- [ ] Add alert notification dropdown component
- [ ] E2E testing with Playwright
- [ ] Deploy React version to Vercel
