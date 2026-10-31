import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  // Dev server must run on port 3000 per AI Studio runtime constraints
  const port = isProd ? parseInt(process.env.PORT || '3000', 10) : 3000;

  // Middleware for body parsing and request safety
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API router mounted under /api
  app.use('/api', apiRouter);

  if (!isProd) {
    // Development mode: mount Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve static build assets
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Server] dist directory not found. Please run npm run build.');
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[PayPilot] Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[PayPilot] Failed to start server:', err);
  process.exit(1);
});
