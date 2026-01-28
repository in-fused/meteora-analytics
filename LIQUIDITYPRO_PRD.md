# LiquidityPro - Product Requirements Document

## Overview
LiquidityPro is an institutional-grade DeFi analytics platform for Solana liquidity pools. It aggregates real-time data from Meteora (DLMM, DAMM v2) and Raydium (CLMM) concentrated liquidity pools, providing scoring, opportunity detection, and live transaction monitoring.

## Core Data Sources
| Source | Type | Data | Refresh |
|--------|------|------|---------|
| Meteora DLMM | Primary | Pool pairs, TVL, volume, APR, fees, bins | 60s |
| Meteora DAMM v2 | Primary | Pool pairs, TVL, volume, farm status | 60s |
| Raydium CLMM | Primary | Concentrated pools, TVL, volume, fees | 60s |
| Jupiter | Token Safety | Verified token list (JupShield) | 5 min |
| Helius RPC | On-demand | Pool transactions, balances | On expand |
| DexScreener | Fallback | Pool data if primaries fail | Emergency |

## Scoring Algorithm (10-99)
- Base: 50
- TVL: +20 (>$500K), +15 (>$100K), +10 (>$10K)
- Volume: +15 (>$100K), +10 (>$10K), +5 (>$1K)
- APR: +10 (>100%), +7 (>50%), +4 (>20%)
- Safety: +5 (safe), -15 (danger)
- Farm: +3 (has farm), +5 (active farm)
- Locked liquidity: +3

## Opportunity Detection (7 types)
1. **Hot Pool** - Fee velocity spike (1h fees * 24 > 24h fees * 1.5)
2. **High Fee Velocity** - Fee/TVL ratio > 0.1%
3. **High Volume/TVL** - Ratio > 30%
4. **High APR + Safe** - APR > 30% with verified tokens and score >= 65
5. **Elite Score** - Score >= 80 with safe tokens
6. **Active Farms** - Active farming rewards with TVL > $10K
7. **Outstanding Fee/TVL** - Fee/TVL ratio > 1%

## Safety Classification (JupShield)
- **Safe** (green): Both tokens Jupiter-verified
- **Warning** (amber): Partial verification or high TVL
- **Danger** (red): Unverified tokens with low TVL, or blacklisted

## Features
- Real-time pool scorecards with expand/collapse
- AI opportunity detection and ranking
- Pool search by name, ticker, or address
- Configurable pool filters (TVL, type, safety, farm)
- Price alerts on APR, TVL, volume, score, fees
- Live transaction feed via Helius WebSocket (on-demand)
- Liquidity distribution chart (21-bin visualization)
- Wallet integration (Phantom, Solflare, Backpack)
- Quick Deposit via Jupiter Ultra API
- Responsive design (desktop 3-col, tablet 2-col, mobile 1-col)

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **State**: Zustand (global store with typed actions)
- **Backend**: Express.js proxy server (API key protection, caching, rate limiting)
- **Deployment**: Vercel (serverless functions) or self-hosted
- **WebSocket**: Lazy on-demand Helius connection (connects only when pool expanded)

## Performance Targets
- Initial load: < 3s
- Background refresh: 60s interval, skipped when user interacting
- Helius WS: on-demand only (not always-on)
- Mobile: reduced pool count (200 vs 500), polling instead of WS
