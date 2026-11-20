import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { z } from 'zod';
import { db } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const sign = (u) => jwt.sign({ sub: u.id, name: u.name }, SECRET, { expiresIn: '7d' });

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = { id: jwt.verify(token, SECRET).sub };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const router = Router();
const creds = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(100),
});

router.post('/register', (req, res) => {
  const p = creds.extend({ name: z.string().trim().min(1).max(60) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Name, valid email and 6+ char password required' });
  const { name, email, password } = p.data;
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'Email already registered' });
  const id = db.prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)')
    .run(name, email, bcrypt.hashSync(password, 10)).lastInsertRowid;
  const user = { id, name, email };
  res.status(201).json({ token: sign(user), user });
});

router.post('/login', (req, res) => {
  const p = creds.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid credentials' });
  const row = db.prepare('SELECT * FROM users WHERE email=?').get(p.data.email);
  if (!row || !bcrypt.compareSync(p.data.password, row.password_hash))
    return res.status(401).json({ error: 'Wrong email or password' });
  const user = { id: row.id, name: row.name, email: row.email };
  res.json({ token: sign(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.user.id);
  u ? res.json({ user: u }) : res.status(404).json({ error: 'Not found' });
});

export default router;
