# LiquidityPro v7 - Jupiter Integration & x402 API

## Overview

LiquidityPro v7 includes two major monetization features:

1. **Jupiter Ultra API Integration** - In-app token swaps and LP deposits
2. **x402 Paid API Layer** - Micropayment-gated API for trading bots

---

## 🚀 Jupiter Ultra API Integration

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Wallet   │────▶│  LiquidityPro   │────▶│  Jupiter Ultra  │
│  (Phantom, etc) │◀────│   Frontend      │◀────│     API         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  1. Click Deposit     │                       │
        │──────────────────────▶│                       │
        │                       │  2. GET /order        │
        │                       │──────────────────────▶│
        │                       │◀──────────────────────│
        │                       │  3. Transaction       │
        │  4. Sign Transaction  │                       │
        │◀──────────────────────│                       │
        │──────────────────────▶│                       │
        │                       │  5. POST /execute     │
        │                       │──────────────────────▶│
        │                       │◀──────────────────────│
        │  6. Swap Complete     │                       │
        │◀──────────────────────│                       │
```

### Key Features

- **Jupiter Ultra API** - Latest swap infrastructure with MEV protection
- **RPC-less** - No need to manage Solana RPC endpoints
- **Sub-second landing** - Jupiter Beam transaction engine
- **Gasless support** - Some swaps are gasless via Jupiter Z
- **Real-time slippage** - Automatic slippage estimation

### Code Location

The Jupiter integration is in `liquidity-pro-v7.html` in the `ExecutionLayer` module:

```javascript
const ExecutionLayer = {
  // Jupiter Ultra API endpoint
  JUPITER_API: 'https://lite-api.jup.ag/ultra/v1',
  
  // Common token mints
  MINTS: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    // ...
  },
  
  // Get quote from Jupiter
  async getJupiterQuote(inputMint, outputMint, amountLamports, takerAddress) {
    const url = `${this.JUPITER_API}/order?` + new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountLamports.toString(),
      taker: takerAddress,
      slippageBps: '50',
    });
    
    const response = await fetch(url);
    return response.json();
  },
  
  // Execute signed transaction
  async executeJupiterSwap(signedTransaction, requestId) {
    const response = await fetch(`${this.JUPITER_API}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedTransaction, requestId }),
    });
    return response.json();
  }
};
```

### Flow for LP Deposits

1. User enters deposit amount (SOL)
2. System gets Jupiter quote to swap half to TokenX
3. System gets Jupiter quote to swap half to TokenY
4. User signs both transactions
5. Jupiter executes swaps
6. Tokens are sent to Meteora for LP deposit

### Production Setup

For full wallet integration, add a wallet adapter:

```javascript
// With Phantom wallet
const signedTx = await window.phantom.solana.signTransaction(transaction);
const signedTxBase64 = btoa(String.fromCharCode(...new Uint8Array(signedTx.serialize())));
const result = await ExecutionLayer.executeJupiterSwap(signedTxBase64, requestId);
```

---

## 💰 x402 Paid API Layer

### What is x402?

x402 is Coinbase's HTTP 402 Payment Required protocol that enables micropayments for API access. Trading bots and AI agents can pay per-request using stablecoins.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Trading Bot   │────▶│  x402 Server    │────▶│   Facilitator   │
│   / AI Agent    │◀────│  (Express.js)   │◀────│   (Coinbase)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Pricing Tiers

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/api/v1/pools` | FREE | Basic pool list (rate limited) |
| `/api/v1/pools/premium` | $0.001 | Full pool data with analytics |
| `/api/v1/opportunities` | $0.002 | Curated LP opportunities |
| `/api/v1/pool/:address/analytics` | $0.005 | Deep pool analytics |
| `/api/v1/export` | $0.05 | Full data export |

### Quick Start

1. **Install Dependencies**
```bash
npm install express @x402/express @x402/core dotenv cors
```

2. **Set Environment Variables**
```bash
export PORT=4021
export PAY_TO_ADDRESS=your-solana-wallet-address
export FACILITATOR_URL=https://x402.org/facilitator
export PAYMENT_NETWORK=eip155:84532  # Base Sepolia testnet
```

3. **Start Server**
```bash
node liquidity-pro-api-server.js
```

### API Response Flow

**Free Endpoint:**
```
GET /api/v1/pools
→ 200 OK + limited data
```

**Paid Endpoint (First Request):**
```
GET /api/v1/pools/premium
→ 402 Payment Required
→ Response includes payment requirements (price, network, payTo)
```

**Paid Endpoint (With Payment):**
```
GET /api/v1/pools/premium
Headers: X-PAYMENT: <signed-payment-payload>
→ 200 OK + full data
```

### Client Integration

Using `@x402/fetch` for automatic payment handling:

```javascript
import { withPaymentInterceptor } from '@x402/fetch';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const x402Fetch = withPaymentInterceptor(fetch, account);

// This automatically handles 402 responses and payment
const response = await x402Fetch('http://localhost:4021/api/v1/pools/premium');
const data = await response.json();
```

### Example Response

```json
{
  "success": true,
  "count": 100,
  "timestamp": "2025-01-20T12:00:00.000Z",
  "payment": {
    "verified": true,
    "txHash": "0x..."
  },
  "data": [
    {
      "id": "abc123...",
      "name": "SOL-USDC",
      "protocol": "Meteora DLMM",
      "tvl": 5000000,
      "volume": 12000000,
      "fees": 45000,
      "apr": 120.5,
      "score": 95,
      "analytics": {
        "volumeToTvl": 2.4,
        "feeTvlRatio": 0.009,
        "binStep": 10,
        "mintX": "So11...",
        "mintY": "EPjFWdd5..."
      }
    }
  ]
}
```

---

## 🔧 Production Deployment

### Jupiter Integration

1. **Migrate API URL** (before Jan 31, 2026):
```javascript
// Change from:
JUPITER_API: 'https://lite-api.jup.ag/ultra/v1'
// To:
JUPITER_API: 'https://api.jup.ag/ultra/v1'
```

2. **Add API Key** (recommended for higher rate limits):
```javascript
const headers = {
  'x-api-key': process.env.JUPITER_API_KEY
};
```

### x402 API Server

1. **Switch to Mainnet**:
```bash
export PAYMENT_NETWORK=eip155:8453  # Base Mainnet
export FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
```

2. **Register with x402 Bazaar** for discovery by AI agents

3. **Set up monitoring** for payment verification

---

## 📊 Revenue Projections

Based on x402 pricing:

| Usage Level | Monthly Requests | Revenue |
|-------------|------------------|---------|
| Light | 10,000 | $10-20 |
| Medium | 100,000 | $100-200 |
| Heavy | 1,000,000 | $1,000-2,000 |
| Enterprise | 10,000,000+ | $10,000+ |

Plus Jupiter execution fees (0.1% platform fee on deposits).

---

## 🗂 File Structure

```
liquidity-pro-v7.html          # Main frontend with Jupiter integration
liquidity-pro-api-server.js    # x402 paid API server
liquidity-pro-api-package.json # API server dependencies
liquidity-pro-api-test-client.js # Client demo for testing
```

---

## 📚 Resources

- [Jupiter Ultra API Docs](https://dev.jup.ag/docs/ultra)
- [x402 Protocol](https://www.x402.org)
- [Coinbase x402 Docs](https://docs.cdp.coinbase.com/x402)
- [Meteora DLMM SDK](https://www.npmjs.com/package/@meteora-ag/dlmm)
