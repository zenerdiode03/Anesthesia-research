import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateDeepSummary } from '../services/geminiService';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { paper } = req.body;
  if (!paper || !paper.id) return res.status(400).send('Missing paper data');

  try {
    console.log(`Generating Deep Summary for ${paper.id}...`);
    const summary = await generateDeepSummary(paper);
    res.json({ summary });
  } catch (error: any) {
    console.error('Deep Summary API error:', error);
    res.status(500).send(error.message || 'Failed to generate summary');
  }
}
