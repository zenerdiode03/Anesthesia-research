import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { fetchLatestResearch, fetchGuidelines, generateDeepSummary } from './services/geminiService';
import { JournalName } from './types';

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

  // Simple in-memory cache for PubMed and Gemini requests
  // Key: Cache Key, Value: { data: any, timestamp: number }
  const serverCache: Record<string, { data: any, timestamp: number }> = {};
  const PUBMED_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for raw PubMed
  const ENRICHED_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for enriched data
  const GUIDELINE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week for guidelines

  // Research API (Enriched)
  app.get('/api/research', async (req, res) => {
    const journal = req.query.journal as JournalName;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    
    const customRange = (startStr && endStr) 
      ? { start: new Date(startStr), end: new Date(endStr) }
      : undefined;

    const rangeSuffix = customRange 
      ? `${customRange.start.toISOString().split('T')[0]}_${customRange.end.toISOString().split('T')[0]}`
      : 'default';
    const cacheKey = `enriched_research_${journal || 'all'}_${rangeSuffix}`;

    // Check Cache
    const cached = serverCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < ENRICHED_CACHE_DURATION)) {
      console.log(`Serving ENRICHED RESEARCH from SERVER CACHE: ${cacheKey}`);
      return res.json(cached.data);
    }

    try {
      console.log(`Fetching and Enriching Research for ${journal || 'all'}...`);
      const data = await fetchLatestResearch(journal, customRange);
      
      serverCache[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      
      res.json(data);
    } catch (error: any) {
      console.error('Research API error:', error);
      res.status(500).send(error.message || 'Failed to fetch research');
    }
  });

  // Guidelines API
  app.get('/api/guidelines', async (req, res) => {
    const cacheKey = 'enriched_guidelines_v2';

    // Check Cache
    const cached = serverCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < GUIDELINE_CACHE_DURATION)) {
      console.log('Serving GUIDELINES from SERVER CACHE');
      return res.json(cached.data);
    }

    try {
      console.log('Fetching Guidelines...');
      const data = await fetchGuidelines();
      
      serverCache[cacheKey] = {
        data,
        timestamp: Date.now()
      };
      
      res.json(data);
    } catch (error: any) {
      console.error('Guidelines API error:', error);
      res.status(500).send(error.message || 'Failed to fetch guidelines');
    }
  });

  // Deep Summary API
  app.post('/api/deep-summary', async (req, res) => {
    const { paper } = req.body;
    if (!paper || !paper.id) return res.status(400).send('Missing paper data');

    const cacheKey = `deep_summary_${paper.id}`;

    // Check Cache
    const cached = serverCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp < ENRICHED_CACHE_DURATION)) {
      console.log(`Serving DEEP SUMMARY from SERVER CACHE: ${paper.id}`);
      return res.json({ summary: cached.data });
    }

    try {
      console.log(`Generating Deep Summary for ${paper.id}...`);
      const summary = await generateDeepSummary(paper);
      
      serverCache[cacheKey] = {
        data: summary,
        timestamp: Date.now()
      };
      
      res.json({ summary });
    } catch (error: any) {
      console.error('Deep Summary API error:', error);
      res.status(500).send(error.message || 'Failed to generate summary');
    }
  });

  // PubMed Proxy Route (Legacy/Raw)
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
    if (cached && (Date.now() - cached.timestamp < PUBMED_CACHE_DURATION)) {
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
        // @ts-ignore
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
