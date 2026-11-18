import { handleGeminiRequest, type GeminiRequestPayload } from '../server/geminiHandler.ts';

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const result = await handleGeminiRequest({ action: 'status' });
    return res.status(result.status).json(result.body);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method Not Allowed' });
  }

  const payload: GeminiRequestPayload =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const result = await handleGeminiRequest(payload);
  return res.status(result.status).json(result.body);
}
