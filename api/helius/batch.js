// Vercel Serverless Function - Helius Batch RPC Proxy
const HELIUS_KEY = process.env.HELIUS_KEY || '66097387-f0e6-4f93-a800-dbaac4a4c113';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Invalid batch request' });
    }

    // Limit batch size to prevent abuse
    const limitedRequests = requests.slice(0, 20);

    const response = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limitedRequests.map((r, i) => ({
        jsonrpc: '2.0',
        id: i,
        method: r.method,
        params: r.params || []
      })))
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Helius batch error' });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[Helius] Batch error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
