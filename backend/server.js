const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://alve.petter.ai';

// --- CORS ---

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin === CORS_ORIGIN) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json());

// --- Database setup ---

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'alve.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO visitors (id, count) VALUES (1, 0);

  CREATE TABLE IF NOT EXISTS guestbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// --- Rate limiting (in-memory) ---

const rateLimitMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of rateLimitMap) {
    if (now - timestamp > 60_000) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// --- Helpers ---

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

// --- Routes ---

// GET /api/visit — increment and return visitor count
app.get('/api/visit', (_req, res) => {
  db.prepare('UPDATE visitors SET count = count + 1 WHERE id = 1').run();
  const row = db.prepare('SELECT count FROM visitors WHERE id = 1').get();
  res.json({ count: row.count });
});

// GET /api/guestbook — return last 50 entries, newest first
app.get('/api/guestbook', (_req, res) => {
  const entries = db.prepare(
    'SELECT id, name, message, created_at FROM guestbook ORDER BY id DESC LIMIT 50'
  ).all();
  res.json({ entries });
});

// POST /api/guestbook — add a new entry
app.post('/api/guestbook', (req, res) => {
  const ip = req.ip;

  // Rate limit: 1 post per IP per 60 seconds
  const lastPost = rateLimitMap.get(ip);
  if (lastPost && Date.now() - lastPost < 60_000) {
    return res.status(429).json({ error: 'Too many posts. Wait 60 seconds.' });
  }

  let { name, message } = req.body || {};

  if (typeof name !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Name and message are required.' });
  }

  // Strip HTML tags (basic XSS sanitization)
  name = stripHtml(name).trim();
  message = stripHtml(message).trim();

  if (name.length < 1 || name.length > 30) {
    return res.status(400).json({ error: 'Name must be 1-30 characters.' });
  }
  if (message.length < 1 || message.length > 200) {
    return res.status(400).json({ error: 'Message must be 1-200 characters.' });
  }

  const result = db.prepare(
    'INSERT INTO guestbook (name, message) VALUES (?, ?)'
  ).run(name, message);

  const entry = db.prepare(
    'SELECT id, name, message, created_at FROM guestbook WHERE id = ?'
  ).get(result.lastInsertRowid);

  rateLimitMap.set(ip, Date.now());

  res.json({ success: true, entry });
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`Alve's World API running on port ${PORT}`);
});
