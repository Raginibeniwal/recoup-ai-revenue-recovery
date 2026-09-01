// ── Recoup API Server ────────────────────────────────────────────────────────

import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { getDb, initDb } from './db.js';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount API routes
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Initialize DB on startup, then start server
initDb().then(() => {
  console.log('Database initialized');
  app.listen(PORT, () => {
    console.log(`Recoup API server running on http://localhost:${PORT}`);
    console.log(`LLM mode: ${process.env.ANTHROPIC_API_KEY ? 'enabled' : 'disabled (using rule-based fallback)'}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
