# CLAUDE.md — Meteora Analytics Project Context

## Project Overview
LiquidityPro v7 / Meteora Analytics — A Solana DeFi analytics dashboard showing real-time pool data from Meteora DLMM, Meteora DAMM v2, and Raydium CLMM. Deployed on Fly.io.

- **Frontend**: React 18 + TypeScript + Vite + Zustand + Tailwind CSS (in `app/`)
- **Backend**: Node.js/Express + WebSocket server (in `server/index.js`)
- **Build**: Vite builds to `public/`, Express serves static files from `public/`
- **Deploy**: Fly.io (`fly.toml`), Dockerfile at root
- **App URL**: https://meteora-analytics-main.fly.dev

## Architecture
```
Browser → React SPA (Vite-built, served from /public)
  ├── Pool data: GET /api/proxy/{dlmm,damm,raydium} → Express proxies to upstream APIs
  ├── RPC calls: POST /api/helius/rpc, /api/helius/batch → proxied to Helius
  ├── WebSocket: wss://host/ws → server relays to Helius Enhanced/Standard WS
  └── Supabase: alerts, preferences, pool history (direct from browser)
```

## Key Files
| File | Purpose |
|------|---------|
| `server/index.js` | Express backend: proxy endpoints, Helius RPC proxy, WebSocket relay, LRU cache, circuit breakers |
| `app/src/config/index.ts` | Frontend config: all API endpoints, WS URL, platform detection |
| `app/src/services/dataService.ts` | Pool data fetching from all 3 sources + DexScreener fallback |
| `app/src/services/wsService.ts` | WebSocket client + polling fallback for live transactions |
| `app/src/components/PoolCard.tsx` | Pool/Opportunity card with expanded view (chart + live tx feed) |
| `app/src/hooks/useAppState.tsx` | Zustand store — all app state |
| `app/src/lib/utils.ts` | Scoring, safety calc, opportunity detection, formatting |
| `app/src/App.tsx` | Main app: init sequence, tab routing, modals |
| `fly.toml` | Fly.io config: min_machines_running=1, auto_stop=off |
| `Dockerfile` | Node 18 slim, copies pre-built public/, runs server |
| `package.json` | Root: Express backend deps only (express, cors, ws, dotenv) |
| `app/package.json` | Frontend: React, Zustand, Supabase, Vite, Tailwind |

## API Keys (hardcoded as fallbacks in server/index.js)
- Helius: `HELIUS_KEY` env var, fallback `050de531-c2bf-41f8-98cb-1167dfbfc9ee`
- Jupiter: `JUPITER_API_KEY` env var, fallback `59819a46-e0b4-46c3-9d1d-1654cf850419`
- Supabase: hardcoded in `app/src/config/index.ts` (anon key, public)

## Helius RPC Endpoints
- Gatekeeper beta: `https://beta.helius-rpc.com/?api-key=KEY`
- Standard fallback: `https://mainnet.helius-rpc.com/?api-key=KEY`
- Enhanced WS: `wss://atlas-mainnet.helius-rpc.com/?api-key=KEY`
- Standard WS fallback: `wss://mainnet.helius-rpc.com/?api-key=KEY`

## Build & Deploy
```bash
cd app && npm install && npm run build  # builds to ../public/
cd .. && flyctl deploy                  # deploys from Dockerfile
```
The Dockerfile does NOT build the frontend — it relies on pre-built files in `public/`.

---

## CRITICAL ISSUE — LIVE TRANSACTION FEED IS BROKEN

### Symptoms
- Zero live transactions flowing under expanded scorecards
- Console error: `InvalidStateError: Failed to execute 'send' on 'WebSocket'`
- Bad gateway (502) errors from proxy endpoints
- Transaction feed shows "Loading transactions..." forever

### Root Cause Analysis
The WebSocket service (`app/src/services/wsService.ts`) has a fundamental race condition:
- It tries to `ws.send()` before the WebSocket connection is actually open (readyState !== OPEN)
- The `InvalidStateError` means code calls `ws.send()` while WS is in CONNECTING state
- The service architecture is overcomplicated: it mixes WebSocket push with HTTP polling fallback, has complex deduplication, per-pool rate limiting, and pre-subscription — but the core WS lifecycle is buggy

### What Worked Before (and regressed)
The first few iterations had simple, working live data. The regression came from adding layers of "optimization" that broke the core flow. The user wants to go back to basics: **constant, real-time, always-flowing Meteora DLMM and Raydium CLMM data under expanded scorecards.**

### WHAT NEEDS TO HAPPEN NEXT — FULL OVERHAUL

**The user explicitly requested a total API/data pull/fetch overhaul.** Do NOT add more patches. Rewrite the data flow cleanly:

1. **Server WebSocket relay (`server/index.js` WS section, lines ~428-695)**:
   - Simplify. Connect to Helius WS on server startup (not lazily on first client).
   - Keep the connection alive with proper ping/pong.
   - When a client subscribes to a pool address, subscribe on Helius WS.
   - Relay transaction notifications to clients immediately.
   - Handle reconnection cleanly.

2. **Client WebSocket service (`app/src/services/wsService.ts`)**:
   - **REWRITE FROM SCRATCH.** The current version is ~400 lines of tangled state.
   - Simple state machine: DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED.
   - NEVER call `ws.send()` unless `ws.readyState === WebSocket.OPEN`.
   - Queue messages if WS is connecting, flush when open.
   - On subscribe: send subscribe message, then immediately fetch recent transactions via HTTP (one-time backfill).
   - On WS message: parse and push to store immediately.
   - Polling fallback: simple setInterval that fetches via `/api/helius/rpc` every 5-6 seconds as backup. Only active when a pool is expanded.
   - On unsubscribe: stop polling, send unsubscribe.

3. **Transaction fetching (`fetchPoolTransactions` in wsService.ts)**:
   - Uses POST `/api/helius/rpc` with `getSignaturesForAddress` then POST `/api/helius/batch` with `getTransaction`.
   - This works fine mechanically — the issue is it's gated behind broken WS logic and over-aggressive rate limiting.
   - Keep the fetch logic but call it directly: once on expand (backfill), then on each WS notification or poll tick.

4. **Pool data fetching (`app/src/services/dataService.ts`)**:
   - This is mostly fine. Fetches DLMM + DAMM + Raydium in parallel via server proxy.
   - Keep as-is but ensure error handling doesn't silently swallow failures.

5. **PoolCard expand/collapse (`app/src/components/PoolCard.tsx`)**:
   - useEffect subscribes on expand, unsubscribes on collapse — this pattern is fine.
   - Just needs the wsService to actually work.

### Key Principles for the Rewrite
- **Simple over clever.** No pre-subscription, no complex deduplication sets, no per-pool rate limit maps.
- **Always check readyState before send.** The `InvalidStateError` must never happen.
- **HTTP polling is the reliable backbone.** WebSocket push is a bonus for speed.
- **Show transactions immediately.** On expand, fetch via HTTP first (instant), then stream via WS.
- **One expanded pool at a time.** Don't try to track transactions for pools that aren't visible.

### Server-side Considerations
- Cache warming on startup is good (added in latest commit) — keep it.
- Helius Gatekeeper beta may or may not work — the auto-fallback logic is good, keep it.
- The proxy endpoints with circuit breakers and stale-cache fallback are solid — keep them.
- The WS relay on the server side should be simplified to match the client rewrite.

---

## Previous Work & Commits (for context)
- `0969395` Fix deployment stability: keep machine alive, add timeouts, warm cache
- `2acd3f2` Fix form visibility, Jupiter API auth, memory optimizations, rebuild
- `c40017d` WIP: init parallelization, remove All Pools tab, JupShield, WS pre-subscribe
- `3dc5eef` Perf: parallelize init, fix grid layout, clean stale CSS
- `5e0322d` Merge PR #4: flyio-new-files
- `0af88c1` Fix Supabase anon key

## Branch
All work is on branch: `claude/refactor-backend-rpc-03pSt`
