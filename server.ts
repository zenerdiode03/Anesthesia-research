import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Simple in-memory cache for PubMed requests
  const serverCache: Record<string, { data: string, timestamp: number }> = {};
  const SERVER_CACHE_DURATION = 60 * 60 * 1000; // 1 hour server-side cache

  // PubMed Proxy Route
  app.get('/proxy/pubmed', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    const cached = serverCache[targetUrl];
    if (cached && (Date.now() - cached.timestamp < SERVER_CACHE_DURATION)) {
      return res.send(cached.data);
    }

    try {
      const url = new URL(targetUrl);
      if (process.env.NCBI_API_KEY) {
        url.searchParams.set('api_key', process.env.NCBI_API_KEY);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'AnesthesiaResearchHub/1.0.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await response.text();

      if (response.ok) {
        serverCache[targetUrl] = {
          data,
          timestamp: Date.now()
        };
      }

      res.status(response.status).send(data);
    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).send(`Error proxying request: ${error.message}`);
    }
  });

  // Visitor API
  const visitorCounts: Record<string, number> = {};
  app.post('/api/stats/visit', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    visitorCounts[today] = (visitorCounts[today] || 0) + 1;
    res.json({ count: visitorCounts[today] });
  });

  app.get('/api/stats/visitors', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json({ count: visitorCounts[today] || 0 });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
