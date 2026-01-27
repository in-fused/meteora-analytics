// Vercel Serverless Function - DAMM v2 Proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://dammv2-api.meteora.ag/pools?limit=200&order_by=tvl&order=desc');
    if (!response.ok) {
      throw new Error(`DAMM API returned ${response.status}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[Proxy] DAMM error:', err.message);
    res.status(502).json({ error: 'Failed to fetch DAMM data' });
  }
}
