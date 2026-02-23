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
  ├── Pool list:    GET /api/proxy/{dlmm,damm,raydium} → Express proxies to upstream REST APIs
  ├── Pool detail:  GET /api/pool/:address/bins → DLMM SDK on-chain read (real bins + active price)
  ├── Whale tracker: GET /api/pool/:address/positions → DLMM SDK position queries
  ├── RPC calls:    POST /api/helius/rpc, /api/helius/batch → proxied to Helius
  ├── WebSocket:    wss://host/ws → server relays to Helius Enhanced/Standard WS
  └── Supabase:     alerts, preferences, pool history (direct from browser)
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
| `package.json` | Root: Express backend deps + DLMM SDK (express, cors, ws, dotenv, @meteora-ag/dlmm) |
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

### WHAT NEEDS TO HAPPEN — PRIORITY ROADMAP

**Full overhaul.** Do NOT add patches. Rewrite data flows cleanly, then layer on SDK power.

---

### PRIORITY 1: WebSocket Service Rewrite (CRITICAL — live transactions are broken)

**Goal**: Real-time, always-flowing live transactions under expanded scorecards.

**1a. Server WebSocket relay (`server/index.js` WS section, lines ~428-695)**:
   - Simplify. Connect to Helius WS on server startup (not lazily on first client).
   - Keep the connection alive with proper ping/pong.
   - When a client subscribes to a pool address, subscribe on Helius WS.
   - Relay transaction notifications to clients immediately.
   - Handle reconnection cleanly.

**1b. Client WebSocket service (`app/src/services/wsService.ts`)**:
   - **REWRITE FROM SCRATCH.** The current version is ~400 lines of tangled state.
   - Simple state machine: DISCONNECTED → CONNECTING → CONNECTED → SUBSCRIBED.
   - NEVER call `ws.send()` unless `ws.readyState === WebSocket.OPEN`.
   - Queue messages if WS is connecting, flush when open.
   - On subscribe: send subscribe message, then immediately fetch recent transactions via HTTP (one-time backfill).
   - On WS message: parse and push to store immediately.
   - Polling fallback: simple setInterval that fetches via `/api/helius/rpc` every 5-6 seconds as backup. Only active when a pool is expanded.
   - On unsubscribe: stop polling, send unsubscribe.

**1c. Transaction fetching (`fetchPoolTransactions` in wsService.ts)**:
   - Uses POST `/api/helius/rpc` with `getSignaturesForAddress` then POST `/api/helius/batch` with `getTransaction`.
   - This works fine mechanically — the issue is it's gated behind broken WS logic and over-aggressive rate limiting.
   - Keep the fetch logic but call it directly: once on expand (backfill), then on each WS notification or poll tick.

**1d. PoolCard expand/collapse (`app/src/components/PoolCard.tsx`)**:
   - useEffect subscribes on expand, unsubscribes on collapse — this pattern is fine.
   - Just needs the wsService to actually work.

**Key Principles**:
- **Simple over clever.** No pre-subscription, no complex deduplication sets, no per-pool rate limit maps.
- **Always check readyState before send.** The `InvalidStateError` must never happen.
- **HTTP polling is the reliable backbone.** WebSocket push is a bonus for speed.
- **Show transactions immediately.** On expand, fetch via HTTP first (instant), then stream via WS.
- **One expanded pool at a time.** Don't try to track transactions for pools that aren't visible.

---

### PRIORITY 2: DLMM SDK Integration — Real Bins & On-Chain Data

**Goal**: Replace fake/synthetic bin charts with real on-chain liquidity distribution. Get real-time active bin pricing.

**Package**: `@meteora-ag/dlmm` (v1.9.3) — install in root `package.json` (server-side only).
**Deps**: `@solana/web3.js@1.91.6`, `@coral-xyz/anchor@0.31.0` (pulled in automatically).

**Why**: The current REST API (`dlmm-api.meteora.ag/pair/all`) gives aggregate stats (TVL, volume, APR) but NO real bin data. The expanded pool chart uses `generateBins()` which creates **synthetic bins with random noise** — completely fake. The SDK reads actual on-chain state.

**Hybrid Architecture — REST API + SDK**:
```
Pool List / Scorecards (compact view)
  → REST API via /api/proxy/dlmm (current, keep as-is)
  → Fast, bulk stats for 500+ pools, scores, sorting

Expanded Pool Detail (on click)
  → DLMM SDK server-side: DLMM.create(connection, poolAddress)
  → getActiveBin()   → real-time price from chain
  → getBinArrays()   → actual X/Y token amounts per bin (REAL liquidity chart)
  → getBinsBetweenLowerAndUpperBound() → focused range around active bin
```

**2a. Server: new endpoint `GET /api/pool/:address/bins`**:
```js
import DLMM from '@meteora-ag/dlmm';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection(HELIUS_RPC_URL);

app.get('/api/pool/:address/bins', async (req, res) => {
  const dlmm = await DLMM.create(connection, new PublicKey(req.params.address));
  const activeBin = await dlmm.getActiveBin();
  const binArrays = await dlmm.getBinArrays();
  res.json({ activeBin, bins: binArrays });
});
```
- Cache results for ~10s (bins don't change every second).
- Use existing Helius RPC connection (reuse the key, respect rate limits).
- Only called when a pool card is expanded — not bulk.

**2b. Client: replace `generateBins()` with real data**:
- On pool expand: fetch `/api/pool/:address/bins`.
- Render actual liquidity distribution in the chart.
- Show real active bin price instead of cached REST API price.
- Keep REST API data for all other scorecard fields (TVL, volume, APR, fees).

**SDK Key Methods Reference**:
| Method | Returns | Use Case |
|--------|---------|----------|
| `DLMM.create(conn, pubkey)` | DLMM instance | Instantiate pool reader |
| `DLMM.createMultiple(conn, [pubkeys])` | DLMM[] | Batch instantiation |
| `getActiveBin()` | `{ binId, price }` | Real-time price |
| `getBinArrays()` | Bin[] with X/Y amounts | Liquidity distribution chart |
| `getBinsBetweenLowerAndUpperBound(lower, upper)` | Bin[] | Focused range query |
| `getPriceOfBinByBinId(binId)` | price | Price at specific bin |
| `getPositionsByUserAndLbPair(userPubkey)` | Position[] | User's LP positions |
| `getAllLbPairPositionsByUser(userPubkey)` | Map<pool, Position[]> | All user positions across pools |
| `getClaimableSwapFee(positionPubkey)` | fee amounts | Unclaimed fees |
| `getClaimableLMReward(positionPubkey)` | reward amounts | Unclaimed rewards |
| `swapQuote(inAmount, swapForY, ...)` | quote | Simulate a swap |

---

### PRIORITY 3: Whale Tracking & Smart Opportunity Detection

**Goal**: Track large LP positions moving between pools to detect whale flows. Use this signal to enhance opportunity scoring — if whales are piling into a pool, it's a signal. If they're exiting, it's a warning.

**3a. Server: whale position scanner**:
- New endpoint: `GET /api/pool/:address/positions` (or batch for top pools).
- Uses `DLMM.create(conn, addr)` then queries on-chain position accounts.
- Track large positions (>$10K liquidity) and their changes over time.
- Store snapshots in Supabase for historical comparison.

**3b. Whale flow detection logic**:
- Periodically scan top-scored pools (every 5-10 min).
- For each pool, fetch position data via SDK.
- Compare against previous snapshot:
  - New large positions = "whale entry" signal.
  - Removed large positions = "whale exit" signal.
  - Position range shifts = whale repositioning (following price action).
- Aggregate: "3 whales entered this pool in the last hour" / "whale exodus detected".

**3c. Enhanced opportunity scoring (`app/src/lib/utils.ts`)**:
- Add whale flow signals to `detectOpportunities()` and `calculateScore()`:
  - Whale entry streak → boost opportunity score.
  - Whale exit streak → penalize or flag as risky.
  - Large position concentration → flag potential rug/IL risk.
- New opportunity narrative: "3 wallets with >$50K added positions in the last 2 hours".

**3d. UI: whale activity indicator on PoolCard**:
- Compact view: whale icon with count (e.g., "3 whales active").
- Expanded view: position table showing top LPs, their ranges, and entry times.
- Timeline of whale movements in the expanded detail section.

**Data flow**:
```
Cron (every 5-10 min) → DLMM SDK position queries → Supabase snapshots
                                                        ↓
PoolCard UI ← /api/pool/:address/whale-signals ← diff against previous snapshot
                                                        ↓
Opportunity scoring ← whale_entry_count, whale_exit_count, concentration_ratio
```

---

### Server-side Considerations (applies to all priorities)
- Cache warming on startup is good (added in latest commit) — keep it.
- Helius Gatekeeper beta may or may not work — the auto-fallback logic is good, keep it.
- The proxy endpoints with circuit breakers and stale-cache fallback are solid — keep them.
- The WS relay on the server side should be simplified to match the client rewrite.
- DLMM SDK runs server-side only — too heavy for browser (~400KB+ with @solana/web3.js).
- All SDK calls go through the existing Helius RPC connection — respect rate limits.

### Pool data fetching (`app/src/services/dataService.ts`)
- Mostly fine. Fetches DLMM + DAMM + Raydium in parallel via server proxy.
- Keep as-is but ensure error handling doesn't silently swallow failures.
- After Priority 2: augment expanded pool data with SDK-sourced bin/price data.

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
