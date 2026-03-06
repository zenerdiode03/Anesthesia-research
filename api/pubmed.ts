import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (typeof fetch === 'undefined') {
    return res.status(500).send('Server environment error: fetch is not defined. Please ensure Node.js 18+ is used.');
  }
  try {
    const { url: targetUrl } = req.query;
    
    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).send('Missing or invalid url parameter');
    }

    console.log(`Proxying request to PubMed: ${targetUrl}`);

    let urlObj: URL;
    try {
      urlObj = new URL(targetUrl);
    } catch (e) {
      return res.status(400).send('Invalid target URL');
    }

    if (process.env.NCBI_API_KEY) {
      urlObj.searchParams.set('api_key', process.env.NCBI_API_KEY);
    }

    const response = await fetch(urlObj.toString(), {
      headers: {
        'User-Agent': 'AnesthesiaResearchHub/1.0.0',
        'Accept': 'application/xml, application/json, text/plain, */*'
      }
    });
    
    if (!response.ok) {
        console.error(`PubMed API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    if (response.ok) {
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    }
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Error proxying request to PubMed');
  }
}
