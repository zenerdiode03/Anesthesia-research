import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchLatestResearch } from '../services/geminiService';
import { JournalName } from '../types';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const journal = req.query.journal as JournalName;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    
    const customRange = (startStr && endStr) 
      ? { start: new Date(startStr), end: new Date(endStr) }
      : undefined;

    console.log(`Fetching and Enriching Research for ${journal || 'all'}...`);
    const data = await fetchLatestResearch(journal, customRange);
    res.json(data);
  } catch (error: any) {
    console.error('Research API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch research',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
