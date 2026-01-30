// Vercel Serverless Function - Jupiter Tokens Proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const headers = {};
    if (process.env.JUP_API_KEY) {
      headers['x-api-key'] = process.env.JUP_API_KEY;
    }
    const response = await fetch('https://api.jup.ag/tokens/v2/tag?query=verified', { headers });
    if (!response.ok) {
      throw new Error(`Jupiter API returned ${response.status}`);
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[Proxy] Jupiter error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Jupiter tokens' });
  }
}
