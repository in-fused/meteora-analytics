// Vercel Serverless Function - DLMM Proxy
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    if (!response.ok) {
      throw new Error(`DLMM API returned ${response.status}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[Proxy] DLMM error:', err.message);
    res.status(502).json({ error: 'Failed to fetch DLMM data' });
  }
}
