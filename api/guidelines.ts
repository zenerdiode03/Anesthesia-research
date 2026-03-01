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
    res.status(500).send(error.message || 'Failed to fetch guidelines');
  }
}
