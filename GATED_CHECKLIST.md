# Gated Development Checklist — LiquidityPro v2

> **Purpose:** Every change MUST pass through these gates before merge. No regression allowed.
> Each gate has specific pass/fail criteria. A failure at any gate blocks progression.

---

## Gate 0: Environment Setup (Pre-Development)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 0.1 | `.env` file exists with `HELIUS_KEY` | `grep HELIUS_KEY .env` returns non-empty value | PASS |
| 0.2 | `.env` file exists with `JUP_API_KEY` | `grep JUP_API_KEY .env` returns non-empty value | PASS |
| 0.3 | `.env` is in `.gitignore` | `grep '\.env' .gitignore` returns match | PASS |
| 0.4 | No API keys in source code | `grep -r '050de531\|66097387' --include='*.ts' --include='*.js' app/ server/ api/` returns 0 matches | PASS |
| 0.5 | `npm install` succeeds in `app/` | Exit code 0, no vulnerability errors | |
| 0.6 | `npm install` succeeds in root `/` | Exit code 0 | |

---

## Gate 1: TypeScript Compilation (Build Gate)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 1.1 | `tsc -b` succeeds | Exit code 0, zero errors | |
| 1.2 | `vite build` succeeds | Exit code 0, outputs to `../public/` | |
| 1.3 | No `any` type suppressions added | `git diff` shows no new `// @ts-ignore` or `as any` lines | |
| 1.4 | All imports resolve | No "module not found" errors | |

**Gate 1 Blocker:** If TypeScript fails to compile, NO further gates are evaluated.

---

## Gate 2: Runtime — Frontend Loads (Smoke Test)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 2.1 | `npm run dev` starts on port 3000 | Vite dev server confirms "ready" | |
| 2.2 | Browser loads without JS errors | Zero red errors in console (warnings OK) | |
| 2.3 | Pool data loads (any source) | Console shows `[DataService] Loaded N pools from: ...` with N > 0 | PASS (DexScreener fallback) |
| 2.4 | Direct API fallback works | When no backend: DLMM/DAMM/Raydium load directly | PASS (NEW) |
| 2.5 | Helius errors are graceful | No infinite error spam in console; max 3 errors then stops | PASS (NEW) |
| 2.6 | WebSocket failure is graceful | Falls back to polling without error flood | PASS (NEW) |

**Gate 2 Blocker:** If the app doesn't load pools from any source, fix data pipeline first.

---

## Gate 3: Feature Verification (Functional Gate)

| # | Feature | Pass Criteria | Status |
|---|---------|---------------|--------|
| 3.1 | AI Opportunities tab | Shows 1+ opportunity cards with reason text | |
| 3.2 | All Pools tab | Shows pool cards with score, TVL, APR | |
| 3.3 | Pool card expand/collapse | Clicking a card expands it; clicking again collapses | |
| 3.4 | Only one card expanded at a time | Expanding card B auto-collapses card A | |
| 3.5 | Search Pools | Typing "SOL" and pressing Enter shows matching pools | |
| 3.6 | Pool Filters | Applying min TVL filter reduces visible pool count | |
| 3.7 | Tab switching | All 4 tabs render correctly | |
| 3.8 | JupShield toggle | Toggle changes visible pool count (filters danger) | |
| 3.9 | Refresh button | Click triggers data reload, timer resets | |
| 3.10 | API status badges | Badges show green/red based on source availability | |
| 3.11 | Alert creation | Can create an alert from alert panel | |
| 3.12 | Alert bell dropdown | Bell icon shows triggered alerts | |
| 3.13 | Wallet connect button | Button is visible and clickable | |
| 3.14 | Responsive columns | Resizing window changes column count (1/2/3) | PASS (NEW) |
| 3.15 | Refresh timer updates | "Xs ago" increments every 5s | PASS (NEW) |

---

## Gate 4: Security (Pre-Deploy)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 4.1 | No API keys in git history | `git log --all -p | grep -c '050de531'` = only in old commits before rotate | |
| 4.2 | Helius key requires env var | Server crashes if `HELIUS_KEY` not set | PASS |
| 4.3 | RPC method allowlist active | Only 6 allowed methods; others return 403 | PASS |
| 4.4 | No innerHTML with user data | All toast/UI uses `textContent` or DOM methods | PASS |
| 4.5 | CORS configurable | `CORS_ORIGINS` env var restricts origins in production | PASS |
| 4.6 | `.env` excluded from git | `git status` never shows `.env` as tracked | PASS |

---

## Gate 5: Performance (Pre-Deploy)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 5.1 | Initial load < 5s | Pool data appears within 5 seconds | |
| 5.2 | No infinite retry loops | Failed fetches retry max 3x then stop | PASS |
| 5.3 | Background refresh skips when hidden | `document.hidden` check prevents wasted fetches | |
| 5.4 | Chart doesn't flicker on refresh | Deterministic bins, no Math.random | PASS |
| 5.5 | Cache eviction is TTL-based | Expired entries cleaned before oldest eviction | PASS |
| 5.6 | Alert dedup prevents spam | Same alert won't re-trigger within 5 min cooldown | PASS |

---

## Gate 6: Backend (Express + Vercel)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 6.1 | `node server/index.js` starts | Prints "Running on http://0.0.0.0:8080" | |
| 6.2 | Health endpoint returns 200 | `curl localhost:8080/api/health` returns JSON | |
| 6.3 | DLMM proxy returns data | `curl localhost:8080/api/proxy/dlmm` returns JSON array | |
| 6.4 | Helius RPC proxy works | POST with `getBalance` returns result | |
| 6.5 | Forbidden RPC methods blocked | POST with `getProgramAccounts` returns 403 | PASS |
| 6.6 | WebSocket connects | `wscat -c ws://localhost:8080/ws` receives "connected" | |
| 6.7 | Graceful shutdown | SIGTERM closes WS and exits cleanly | |
| 6.8 | .env loads from project root | Server reads `../.env` via dotenv path config | PASS |

---

## Gate 7: Deployment (Production)

| # | Check | Pass Criteria | Status |
|---|-------|---------------|--------|
| 7.1 | Vercel env vars set | `HELIUS_KEY` and `JUP_API_KEY` configured in Vercel dashboard | |
| 7.2 | Fly.io env vars set | `HELIUS_KEY` and `JUP_API_KEY` configured via `fly secrets` | |
| 7.3 | CORS_ORIGINS set for production | Only your domain(s) allowed | |
| 7.4 | Old Helius key rotated | Previous key `66097387-...` revoked in Helius dashboard | |
| 7.5 | HTTPS enforced | All traffic redirected to HTTPS | |
| 7.6 | Build output deployed | `vite build` output served from correct path | |

---

## Regression Prevention Rules

1. **No direct `innerHTML` assignments** — Use `textContent`, `createElement`, or React JSX
2. **No `Math.random()` in render paths** — Use deterministic seeds for stable UI
3. **No hardcoded API keys** — All secrets via `process.env` only
4. **No `window.innerWidth` in `useMemo`** — Use `useColumnCount` hook
5. **No unlimited retries** — All fetch loops must have max retry + backoff
6. **No `useCallback` for time-dependent values** — Use `useEffect` + interval
7. **All new Zustand state must be used** — Remove unused state properties
8. **Proxy endpoints must have direct fallbacks** — App works without backend
9. **Alert triggers must be deduplicated** — Cooldown period per alert ID
10. **All wallet providers must be supported** — autoConnect reads localStorage

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-29 | Initial audit fixes (18 issues) |
| 1.1 | 2026-01-30 | Direct API fallback, Helius graceful degradation, env setup, JUP API key |
