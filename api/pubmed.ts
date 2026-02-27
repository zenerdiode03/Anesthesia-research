import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    console.log(`Proxying request to PubMed: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'AnesthesiaResearchHub/1.0.0'
      }
    });
    
    if (!response.ok) {
        console.error(`PubMed API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Error proxying request to PubMed');
  }
}
