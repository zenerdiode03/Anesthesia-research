import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { fetchAndProcessResearch } from './server-research';

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

  // Ensure directories exist
  const ROOT_DIR = process.cwd();

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Simple in-memory cache for PubMed requests
  // Key: URL, Value: { data: string, timestamp: number }
  const serverCache: Record<string, { data: string, timestamp: number }> = {};
  const SERVER_CACHE_DURATION = 60 * 60 * 1000; // 1 hour server-side cache

  // Daily Research Cache
  let dailyResearchCache: any[] | null = null;
  let lastCacheDate: string | null = null;
  let isFetching = false;

  // Daily Visitor Tracking
  const visitorCounts: Record<string, number> = {};

  // PubMed Proxy Route
  app.get('/api/pubmed', async (req, res) => {
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

  // Visitor API
  app.post('/api/stats/visit', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    visitorCounts[today] = (visitorCounts[today] || 0) + 1;
    res.json({ count: visitorCounts[today] });
  });

  app.get('/api/stats/visitors', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    res.json({ count: visitorCounts[today] || 0 });
  });

  // Daily Research API
  app.get('/api/research/latest', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // If we have a cache for today, return it
    if (dailyResearchCache && lastCacheDate === today) {
      console.log(`[${new Date().toISOString()}] Serving DAILY CACHE for ${today}`);
      return res.json(dailyResearchCache);
    }

    // If already fetching, wait or return error (to prevent multiple simultaneous Gemini calls)
    if (isFetching) {
      return res.status(503).json({ error: "Data is being extracted by another user. Please try again in a moment." });
    }

    try {
      isFetching = true;
      console.log(`[${new Date().toISOString()}] Cache expired or missing for ${today}. Starting extraction...`);
      
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
      }

      const data = await fetchAndProcessResearch(apiKey);
      
      dailyResearchCache = data;
      lastCacheDate = today;
      
      console.log(`[${new Date().toISOString()}] Extraction complete and cached for ${today}`);
      res.json(data);
    } catch (error: any) {
      console.error('Daily extraction error:', error);
      res.status(500).json({ error: error.message || "Failed to extract daily research" });
    } finally {
      isFetching = false;
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
