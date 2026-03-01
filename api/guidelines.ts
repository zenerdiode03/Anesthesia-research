import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchGuidelines } from '../services/geminiService';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('Fetching Guidelines...');
    const data = await fetchGuidelines();
    res.json(data);
  } catch (error: any) {
    console.error('Guidelines API error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch guidelines',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
