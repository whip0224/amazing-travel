import { handleGeminiRequest, type GeminiRequestPayload } from '../server/geminiHandler.ts';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const result = await handleGeminiRequest({ action: 'status' });
      return res.status(result.status).json(result.body);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: true, message: 'Method Not Allowed' });
    }

    let payload: GeminiRequestPayload = { action: 'status' };
    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body || '{}');
      } catch {
        payload = { action: 'status' };
      }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body;
    }

    const result = await handleGeminiRequest(payload);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    const msg = String(err?.message || err || '伺服器執行錯誤');
    return res.status(500).json({
      error: true,
      errorCode: 'SERVER_ERROR',
      message: `伺服器執行 AI 請求時發生錯誤：${msg}`,
    });
  }
}

