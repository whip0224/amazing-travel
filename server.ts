import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleGeminiRequest, type GeminiRequestPayload } from './server/geminiHandler.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Allow up to 4MB JSON payloads for compressed receipt/menu photos
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/gemini', async (_req, res) => {
    const result = await handleGeminiRequest({ action: 'status' });
    res.status(result.status).json(result.body);
  });

  app.post('/api/gemini', async (req, res) => {
    const payload = (req.body || {}) as GeminiRequestPayload;
    const result = await handleGeminiRequest(payload);
    res.status(result.status).json(result.body);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
