import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchKeywordAnalysis } from '../../server-research';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY missing" });
    }
    
    const data = await fetchKeywordAnalysis(apiKey);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error: any) {
    console.error('Keyword analysis extraction error:', error);
    res.status(500).json({ error: "Failed to fetch keyword analysis" });
  }
}
