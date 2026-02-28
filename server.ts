import express from 'express';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // PubMed Proxy Route
  app.get('/api/pubmed', async (req, res) => {
    if (typeof fetch === 'undefined') {
      return res.status(500).send('Server environment error: fetch is not defined. Please ensure Node.js 18+ is used.');
    }
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
      }

      console.log(`Proxying request to: ${targetUrl}`);
      
      const url = new URL(targetUrl);
      if (process.env.NCBI_API_KEY) {
        url.searchParams.set('api_key', process.env.NCBI_API_KEY);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AnesthesiaResearchHub/1.0.0'
        }
      });
      
      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).send('Error proxying request to PubMed');
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
