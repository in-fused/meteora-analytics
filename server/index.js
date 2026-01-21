import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { paymentMiddleware } from '@x402/express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';

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

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

app.get('/api/meteora/premium', (req, res) => {
  const data = req.x402Payment;
  if (!data) {
    return res.status(402).json({ error: 'Payment required' });
  }

  fetchMeteoraPools()
    .then(pools => pools.map(scorePool))
    .then(scored => {
      res.json({
        success: true,
        payment: data,
        pools: scored.slice(0, 50)
      });
    })
    .catch(err => {
      res.status(500).json({ error: err.message });
    });
});
