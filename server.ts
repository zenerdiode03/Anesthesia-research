import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Ensure directories exist
  const UPLOADS_DIR = path.join(__dirname, 'uploads');
  const PODCASTS_DIR = path.join(UPLOADS_DIR, 'podcasts');
  const PODCASTS_JSON = path.join(UPLOADS_DIR, 'podcasts.json');

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
  if (!fs.existsSync(PODCASTS_DIR)) fs.mkdirSync(PODCASTS_DIR);
  if (!fs.existsSync(PODCASTS_JSON)) fs.writeFileSync(PODCASTS_JSON, JSON.stringify([]));

  // Multer setup
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, PODCASTS_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ 
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Podcast APIs
  app.get('/api/podcasts', (req, res) => {
    try {
      const data = fs.readFileSync(PODCASTS_JSON, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      res.status(500).send('Error reading podcasts data');
    }
  });

  app.post('/api/podcasts/upload', upload.single('audio'), (req, res) => {
    const { password, title, description } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'hunter123'; // Default password if not set

    if (password !== adminPassword) {
      // Delete uploaded file if password fails
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(401).send('Invalid password');
    }

    if (!req.file) {
      return res.status(400).send('No audio file uploaded');
    }

    try {
      const podcasts = JSON.parse(fs.readFileSync(PODCASTS_JSON, 'utf8'));
      const newPodcast = {
        id: Date.now().toString(),
        title: title || 'New Podcast',
        description: description || '',
        audioUrl: `/uploads/podcasts/${req.file.filename}`,
        date: new Date().toISOString(),
      };
      podcasts.unshift(newPodcast);
      fs.writeFileSync(PODCASTS_JSON, JSON.stringify(podcasts, null, 2));
      res.json(newPodcast);
    } catch (err) {
      res.status(500).send('Error saving podcast data');
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(UPLOADS_DIR));

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
