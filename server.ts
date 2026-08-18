import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './server/routes/api';
import { pollerManager } from './server/poller/pollerManager';
import { createServer as createViteServer } from 'vite';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON & URL-encoded parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes first
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Start background Poller Engine
  pollerManager.startAll();

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NetOps SuperTools] Server operational and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ NetOps] Fatal startup error:', err);
  process.exit(1);
});
