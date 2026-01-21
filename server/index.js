import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { paymentMiddleware } from '@x402/express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CONFIG = {
  PORT: process.env.PORT || 4021,
  PAY_TO: process.env.PAY_TO_ADDRESS,
  NETWORK: process.env.PAYMENT_NETWORK || 'eip155:84532',
  FACILITATOR: process.env.FACILITATOR_URL || 'https://x402.org/facilitator'
};

const PRICING = {
  PREMIUM_POOLS: '0.001',
  OPPORTUNITIES: '0.002'
};

// x402 setup
const facilitator = new HTTPFacilitatorClient({
  url: CONFIG.FACILITATOR
});

const x402 = new x402ResourceServer(facilitator);
registerExactEvmScheme(x402);

app.use(
  paymentMiddleware({
    server: x402,
    resources: {
      'GET /api/premium': {
        accepts: [{
          scheme: 'exact',
          price: PRICING.PREMIUM_POOLS,
          network: CONFIG.NETWORK,
          payTo: CONFIG.PAY_TO
        }]
      },

      'GET /api/v1/meteora/analytics': {
        accepts: [{
          scheme: 'exact',
          price: '0.002',
          network: CONFIG.NETWORK,
          payTo: CONFIG.PAY_TO
        }],
        description: 'Meteora DLMM analytics with scoring'
      }
    }
  })
);



// FREE
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

// PAID
app.get('/api/premium', (req, res) => {
  res.json({
    success: true,
    payment: req.x402Payment,
    data: 'Premium analytics payload here'
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`API running on port ${CONFIG.PORT}`);
});


// PAID: Meteora analytics (x402 protected)
app.get('/api/v1/meteora/analytics', async (req, res) => {
  // If this exists, payment was verified
  if (!req.x402Payment) {
    return res.status(402).json({ error: 'Payment required' });
  }

  try {
    const pools = await fetchMeteoraPools();
    const scored = pools.map(scorePool);

    res.json({
      success: true,
      payment: {
        txHash: req.x402Payment.transactionHash
      },
      count: scored.length,
      data: scored
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
