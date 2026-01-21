import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// import { paymentMiddleware } from '@x402/express';
// import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
// import { registerExactEvmScheme } from '@x402/evm/exact/server';

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "meteora-analytics-backend",
    uptime: process.uptime()
  });
});


const PRICING = {
  PREMIUM_POOLS: '0.001',
  OPPORTUNITIES: '0.002'
};


// x402 disabled for preview deployment


// FREE
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

// PAID
// app.get('/api/premium', (req, res) => {
  res.json({
    success: true,
    payment: req.x402Payment,
    data: 'Premium analytics payload here'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});



// PAID: Meteora analytics (x402 protected)
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const pools = await fetchMeteoraPools();
    const scored = pools.map(scorePool);

    res.json({
      success: true,
      preview: true,
      count: scored.length,
      data: scored
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



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
