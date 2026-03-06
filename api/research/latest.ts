import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchAndProcessResearch } from '../../server-research';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    }

    const data = await fetchAndProcessResearch(apiKey);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error: any) {
    console.error('Daily extraction error:', error);
    res.status(500).json({ error: error.message || "Failed to extract daily research" });
  }
}
