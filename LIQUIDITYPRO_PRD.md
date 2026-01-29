# LiquidityPro - Product Requirements Document

## 📋 Executive Summary

**LiquidityPro** is an institutional-grade liquidity pool analytics platform for Solana, aggregating real-time data from Meteora DLMM and DAMM v2 pools. The platform provides AI-powered opportunity detection, JupShield safety verification, and live transaction monitoring to help liquidity providers maximize returns while minimizing risk.

---

## 🎯 Product Vision

### Mission Statement
Empower liquidity providers with real-time, actionable intelligence to identify high-probability profitable LP opportunities across the Solana DeFi ecosystem.

### Target Audience
- **Primary**: Institutional liquidity providers and market makers
- **Secondary**: Sophisticated retail traders and DeFi power users
- **Tertiary**: New entrants seeking guided LP opportunities

### Monetization Strategy
| Revenue Stream | Description | Timeline |
|----------------|-------------|----------|
| Platform Fees | 0.1% fee on in-app deposits/swaps via Jup Ultra | Phase 2 |
| Premium Subscriptions | Advanced analytics, API access, custom alerts | Phase 3 |
| x402 Bot Payments | Automated LP management bot access | Phase 3 |
| Data API | B2B data feed subscriptions | Phase 4 |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LIQUIDITYPRO ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   REACT UI   │◄──►│  APP STATE   │◄──►│   SERVICES   │                  │
│  │  (Frontend)  │    │   (Context)  │    │  (Business)  │                  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘                  │
│         │                                        │                          │
│         │                              ┌────────┴────────┐                 │
│         │                              │                 │                 │
│         ▼                              ▼                 ▼                 │
│  ┌──────────────┐              ┌──────────────┐  ┌──────────────┐         │
│  │  COMPONENTS  │              │  DATA SERVICE│  │  WS SERVICE  │         │
│  │  - Header    │              │  - Meteora   │  │  - Helius    │         │
│  │  - PoolCard  │              │  - Jupiter   │  │  - Real-time │         │
│  │  - Charts    │              │  - Raydium   │  │  - Tx Feed   │         │
│  └──────────────┘              └──────┬───────┘  └──────┬───────┘         │
│                                       │                 │                  │
│                              ┌────────┴─────────────────┴────────┐        │
│                              │         EXTERNAL APIs              │        │
│                              │  ┌─────────┐ ┌─────────┐ ┌──────┐ │        │
│                              │  │ Meteora │ │ Jupiter │ │Helius│ │        │
│                              │  │  DLMM   │ │ Verified│ │  WS  │ │        │
│                              │  │  DAMM   │ │  Tokens │ │ RPC  │ │        │
│                              │  └─────────┘ └─────────┘ └──────┘ │        │
│                              └────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Folder Structure

```
/mnt/okcomputer/output/app/
├── index.html                    # Entry HTML with meta tags, fonts
├── package.json                  # Dependencies & scripts
├── tailwind.config.ts            # Tailwind CSS configuration
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration
├── src/
│   ├── main.tsx                  # React application entry
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                 # Global styles, CSS variables, animations
│   │
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   │                               - Pool: Core pool data structure
│   │                               - Bin: Liquidity bin structure
│   │                               - PoolTransaction: Transaction data
│   │                               - Alert: User alert configuration
│   │                               - WalletState: Connected wallet state
│   │
│   ├── config/
│   │   └── index.ts              # API endpoints, constants, wallet configs
│   │                               - METEORA_DAMM_V2, METEORA_DLMM
│   │                               - JUPITER_PRICE, JUPITER_TOKENS
│   │                               - HELIUS_RPC, HELIUS_WS
│   │                               - REFRESH_INTERVAL: 30s
│   │
│   ├── lib/
│   │   └── utils.ts              # Utility functions
│   │                               - formatNumber(): $1.2K, $1.5M formatting
│   │                               - formatPrice(): Price precision
│   │                               - calculateScore(): Pool scoring algorithm
│   │                               - generateBins(): 21-bin generation
│   │                               - determineSafety(): JupShield logic
│   │
│   ├── services/
│   │   ├── dataService.ts        # Data fetching & processing
│   │   │                         - fetchJupiterTokens(): Verified tokens
│   │   │                         - fetchPools(): Main pool aggregation
│   │   │                         - processDLMM(): DLMM pool transformer
│   │   │                         - processDAMMv2(): DAMM v2 transformer
│   │   │
│   │   ├── wsService.ts          # WebSocket real-time data
│   │   │                         - connectHelius(): WS connection
│   │   │                         - subscribeToPool(): Pool-specific sub
│   │   │                         - fetchPoolTransactions(): Historical txs
│   │   │
│   │   └── walletService.ts      # Solana wallet integration
│   │                             - connect(): Wallet connection
│   │                             - fetchBalance(): SOL balance
│   │                             - autoConnect(): Reconnect on load
│   │
│   ├── hooks/
│   │   └── useAppState.tsx       # Global state management (React Context)
│   │                               - pools: All loaded pools
│   │                               - opportunities: AI-filtered opportunities
│   │                               - alerts: User alert configurations
│   │                               - wallet: Connected wallet state
│   │                               - filters: Active filter settings
│   │                               - initialize(): App bootstrap
│   │                               - refresh(): Manual data refresh
│   │
│   └── components/
│       ├── Header.tsx            # Top navigation bar
│       ├── HeroSection.tsx       # Stats banner with pool counts
│       ├── OpportunitiesSection.tsx  # AI opportunities grid
│       ├── SearchAlertsSection.tsx   # Search, filters, alerts UI
│       ├── GuideSection.tsx      # Documentation accordion
│       ├── PoolCard.tsx          # Pool scorecard with bin chart
│       └── Particles.tsx         # Background particle animation
│
└── dist/                         # Production build output
    ├── index.html
    ├── assets/
    │   ├── index-[hash].js
    │   └── index-[hash].css
```

---

## 🔌 Data Flow Architecture

### 1. Initial Load Sequence
```
User Opens App
    │
    ▼
App.tsx → initialize()
    │
    ├──► fetchJupiterTokens() ──► Jupiter API
    │
    ├──► fetchPools() ──────────┤
    │                           ├──► Meteora DLMM API (all pools)
    │                           ├──► Meteora DAMM v2 API (top 200 by TVL)
    │                           └──► DexScreener (fallback)
    │
    ├──► processDLMM() ─────────► Pool[] with scores, bins
    ├──► processDAMMv2() ───────► Pool[] with scores, bins
    │
    ├──► detectOpportunities() ─► Filter & categorize opportunities
    │
    └──► wsService.connect() ───► Helius WebSocket (real-time txs)
```

### 2. Real-Time Update Flow
```
Helius WebSocket
    │
    ├──► logsSubscribe(Meteora Program)
    │
    └──► On Transaction
            │
            ├──► Parse transaction type (add/remove/swap)
            ├──► Calculate USD value
            └──► Broadcast to subscribed pool cards
```

### 3. Background Refresh
```
setInterval(30 seconds)
    │
    └──► fetchPools() ──► Update all pool data
            │
            ├──► Skip if user interacting (expanded card)
            ├──► Skip if tab hidden
            └──► Update opportunities & alerts
```

---

## ⚡ Performance Optimizations

| Technique | Implementation | Impact |
|-----------|----------------|--------|
| **Virtual Scrolling** | Content-visibility for off-screen cards | 60fps on mobile |
| **Debounced Search** | 300ms delay on search input | Reduces API calls |
| **Memoized Components** | React.memo on PoolCard | Prevents re-renders |
| **Lazy Loading** | Dynamic imports for heavy components | Faster initial load |
| **Background Refresh** | 30s interval with skip logic | Fresh data, no jank |
| **WebSocket Pooling** | Single WS connection, multiple subscribers | Efficient real-time |

---

## 📱 Mobile Responsiveness

### Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column, stacked cards |
| Tablet | 640-1024px | 2-column grid |
| Desktop | 1024-1536px | 3-column masonry |
| Large | > 1536px | 3-column + enhanced spacing |

### Touch Optimizations
- Minimum touch target: 44px
- Swipe gestures for card expansion
- Bottom sheet for mobile filters
- Haptic feedback on actions

---

## 🔒 Security Considerations

| Layer | Implementation |
|-------|----------------|
| **API Keys** | Environment variables, never client-exposed |
| **Wallet** | WalletAdapter standard, no private key storage |
| **XSS Prevention** | React escaping, no innerHTML |
| **CSP Headers** | Strict content security policy |
| **Rate Limiting** | Client-side request throttling |

---

## 🚀 Roadmap

### Phase 1: Core Platform (Complete)
- ✅ Pool aggregation (Meteora DLMM + DAMM v2)
- ✅ AI opportunity detection
- ✅ JupShield safety indicators
- ✅ Real-time transaction feed
- ✅ Wallet connection
- ✅ Custom alerts

### Phase 2: Monetization (Q2 2025)
- 🔄 Jup Ultra integration for in-app swaps
- 🔄 Platform fee collection (0.1%)
- 🔄 Quick deposit functionality
- 🔄 Premium tier launch

### Phase 3: Automation (Q3 2025)
- 🔄 x402 bot payments
- 🔄 Automated LP management
- 🔄 API access for enterprises
- 🔄 Advanced analytics dashboard

### Phase 4: Expansion (Q4 2025)
- 🔄 Raydium Concentrated pools
- 🔄 Orca Whirlpools
- 🔄 Cross-chain aggregation
- 🔄 Mobile app (React Native)

---

## 📊 Key Metrics

| Metric | Target |
|--------|--------|
| Time to Interactive | < 2s |
| First Contentful Paint | < 1s |
| API Response Time | < 500ms |
| WebSocket Latency | < 100ms |
| Mobile Lighthouse Score | > 90 |
| Desktop Lighthouse Score | > 95 |

---

## 🎨 Design System

### Color Palette
```css
/* Backgrounds */
--bg-void: #020204;        /* Deepest background */
--bg-card: #0c0d12;        /* Card surfaces */
--bg-glass: rgba(12,13,18,0.92); /* Glass morphism */

/* Accents */
--accent-primary: #6366f1;   /* Indigo */
--accent-cyan: #06b6d4;      /* Cyan */
--accent-emerald: #059669;   /* Green (safe) */
--accent-amber: #d97706;     /* Orange (warning) */
--accent-rose: #e11d48;      /* Red (danger) */
```

### Typography
- **Primary**: Inter (400, 500, 600, 700)
- **Monospace**: JetBrains Mono (numbers, addresses)
- **Base Size**: 14px (scales to 16px on large screens)

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

---

*Document Version: 2.0*
*Last Updated: 2026-01-28*
*Author: LiquidityPro Team*
