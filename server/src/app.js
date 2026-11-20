import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import auth from './auth.js';
import tasks, { aiRouter, statsRouter } from './tasks.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }), auth);
  app.use('/api/tasks', tasks);
  app.use('/api/stats', statsRouter);
  app.use('/api/ai', rateLimit({ windowMs: 60 * 1000, limit: 30 }), aiRouter);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });
  return app;
}
