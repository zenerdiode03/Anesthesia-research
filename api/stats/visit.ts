import type { VercelRequest, VercelResponse } from '@vercel/node';

// Note: In-memory state is not persistent across serverless function calls
let count = 0;

export default function handler(req: VercelRequest, res: VercelResponse) {
  count++;
  res.json({ count });
}
