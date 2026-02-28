import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Simple in-memory cache for PubMed requests
  // Key: URL, Value: { data: string, timestamp: number }
  const serverCache: Record<string, { data: string, timestamp: number }> = {};
  const SERVER_CACHE_DURATION = 60 * 60 * 1000; // 1 hour server-side cache

  // PubMed Proxy Route
  app.get('/api/pubmed', async (req, res) => {
    if (typeof fetch === 'undefined') {
      return res.status(500).send('Server environment error: fetch is not defined. Please ensure Node.js 18+ is used.');
    }

    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    // 1. Check Server-Side Cache
    const cached = serverCache[targetUrl];
    if (cached && (Date.now() - cached.timestamp < SERVER_CACHE_DURATION)) {
      console.log(`Serving from SERVER CACHE: ${targetUrl}`);
      return res.send(cached.data);
    }

    try {
      console.log(`Proxying request to PubMed: ${targetUrl}`);
      
      const url = new URL(targetUrl);
      if (process.env.NCBI_API_KEY) {
        url.searchParams.set('api_key', process.env.NCBI_API_KEY);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AnesthesiaResearchHub/1.0.0'
        },
        signal: AbortSignal.timeout(15000) // 15 second timeout for PubMed
      });
      
      const data = await response.text();

      // 2. Save to Server-Side Cache if successful
      if (response.ok) {
        serverCache[targetUrl] = {
          data,
          timestamp: Date.now()
        };
      }

      res.status(response.status).send(data);
    } catch (error: any) {
      console.error('Proxy error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(`Error proxying request to PubMed: ${message}`);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
