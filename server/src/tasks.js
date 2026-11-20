import { Router } from 'express';
import { z } from 'zod';
import { db, logActivity } from './db.js';
import { requireAuth } from './auth.js';
import { parseTask, breakdown, insights, aiEnabled } from './ai.js';

const router = Router();
router.use(requireAuth);

const hydrate = (t) => t && { ...t, tags: JSON.parse(t.tags), ai_generated: !!t.ai_generated,
  subtasks: db.prepare('SELECT id,title,done FROM subtasks WHERE task_id=? ORDER BY id').all(t.id).map((s) => ({ ...s, done: !!s.done })) };
const owned = (uid, id) => db.prepare('SELECT * FROM tasks WHERE id=? AND user_id=?').get(id, uid);

const base = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).default(''),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(6).default([]),
  ai_generated: z.boolean().default(false),
  subtasks: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
});

function nextPosition(uid, status) {
  return (db.prepare('SELECT MAX(position) m FROM tasks WHERE user_id=? AND status=?').get(uid, status).m ?? 0) + 1000;
}

// List with filtering + pagination
router.get('/', (req, res) => {
  const { status, priority, q, limit = 200, offset = 0 } = req.query;
  const where = ['user_id = ?']; const args = [req.user.id];
  if (status) { where.push('status = ?'); args.push(status); }
  if (priority) { where.push('priority = ?'); args.push(priority); }
  if (q) { where.push('(title LIKE ? OR description LIKE ? OR tags LIKE ?)'); args.push(...Array(3).fill(`%${q}%`)); }
  const rows = db.prepare(`SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY position ASC LIMIT ? OFFSET ?`)
    .all(...args, Math.min(+limit || 200, 500), +offset || 0);
  res.json({ tasks: rows.map(hydrate) });
});

router.post('/', (req, res) => {
  const p = base.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid task', details: p.error.flatten().fieldErrors });
  const d = p.data;
  const create = db.transaction(() => {
    const id = db.prepare(`INSERT INTO tasks (user_id,title,description,status,priority,due_date,tags,position,ai_generated,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, d.title, d.description, d.status, d.priority, d.due_date ?? null,
      JSON.stringify(d.tags), nextPosition(req.user.id, d.status), d.ai_generated ? 1 : 0, d.status === 'done' ? new Date().toISOString() : null).lastInsertRowid;
    const ins = db.prepare('INSERT INTO subtasks (task_id,title) VALUES (?,?)');
    (d.subtasks || []).forEach((s) => ins.run(id, s));
    logActivity(req.user.id, 'created', d.title);
    return id;
  });
  res.status(201).json({ task: hydrate(owned(req.user.id, create())) });
});

router.patch('/:id', (req, res) => {
  const t = owned(req.user.id, req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  const p = base.partial().extend({ position: z.number().optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid update' });
  const d = p.data;
  const status = d.status ?? t.status;
  const sets = { ...d, tags: d.tags ? JSON.stringify(d.tags) : undefined, ai_generated: undefined, subtasks: undefined };
  if (d.status && d.status !== t.status) {
    sets.completed_at = d.status === 'done' ? new Date().toISOString() : null;
    if (d.position === undefined) sets.position = nextPosition(req.user.id, status);
    logActivity(req.user.id, d.status === 'done' ? 'completed' : `moved to ${d.status.replace('_', ' ')}`, t.title);
  }
  const cols = Object.keys(sets).filter((k) => sets[k] !== undefined);
  if (cols.length) {
    db.prepare(`UPDATE tasks SET ${cols.map((c) => `${c}=?`).join(',')}, updated_at=datetime('now') WHERE id=?`)
      .run(...cols.map((c) => sets[c]), t.id);
  }
  res.json({ task: hydrate(owned(req.user.id, t.id)) });
});

router.delete('/:id', (req, res) => {
  const t = owned(req.user.id, req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id=?').run(t.id);
  logActivity(req.user.id, 'deleted', t.title);
  res.status(204).end();
});

// Subtasks
router.post('/:id/subtasks', (req, res) => {
  const t = owned(req.user.id, req.params.id);
  const p = z.object({ title: z.string().trim().min(1).max(160) }).safeParse(req.body);
  if (!t || !p.success) return res.status(t ? 400 : 404).json({ error: 'Invalid request' });
  db.prepare('INSERT INTO subtasks (task_id,title) VALUES (?,?)').run(t.id, p.data.title);
  res.status(201).json({ task: hydrate(t) });
});
router.patch('/:id/subtasks/:sid', (req, res) => {
  const t = owned(req.user.id, req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  db.prepare('UPDATE subtasks SET done=? WHERE id=? AND task_id=?').run(req.body.done ? 1 : 0, req.params.sid, t.id);
  res.json({ task: hydrate(t) });
});
router.delete('/:id/subtasks/:sid', (req, res) => {
  const t = owned(req.user.id, req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM subtasks WHERE id=? AND task_id=?').run(req.params.sid, t.id);
  res.json({ task: hydrate(t) });
});

export const aiRouter = Router();
aiRouter.use(requireAuth);
aiRouter.get('/status', (_req, res) => res.json({ provider: aiEnabled() ? 'claude' : 'heuristic' }));
aiRouter.post('/parse', async (req, res) => {
  const p = z.object({ text: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Text required' });
  res.json(await parseTask(p.data.text));
});
aiRouter.post('/breakdown', async (req, res) => {
  const p = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(2000).optional() }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Title required' });
  res.json(await breakdown(p.data.title, p.data.description));
});
aiRouter.get('/insights', async (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks WHERE user_id=?').all(req.user.id);
  res.json(await insights(rows));
});

export const statsRouter = Router();
statsRouter.use(requireAuth);
statsRouter.get('/', (req, res) => {
  const uid = req.user.id;
  const today = new Date().toISOString().slice(0, 10);
  const by = (col) => Object.fromEntries(db.prepare(`SELECT ${col} k, COUNT(*) c FROM tasks WHERE user_id=? GROUP BY ${col}`).all(uid).map((r) => [r.k, r.c]));
  const status = by('status'), priority = by('priority');
  const overdue = db.prepare("SELECT COUNT(*) c FROM tasks WHERE user_id=? AND status!='done' AND due_date < ?").get(uid, today).c;
  const dueSoon = db.prepare("SELECT COUNT(*) c FROM tasks WHERE user_id=? AND status!='done' AND due_date BETWEEN ? AND date(?, '+3 days')").get(uid, today, today).c;
  const perDay = Object.fromEntries(db.prepare("SELECT date(completed_at) d, COUNT(*) c FROM tasks WHERE user_id=? AND completed_at >= date('now','-6 days') GROUP BY d").all(uid).map((r) => [r.d, r.c]));
  const completedWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10);
    return { date: d, count: perDay[d] || 0 };
  });
  const total = Object.values(status).reduce((a, b) => a + b, 0);
  res.json({
    total, status: { todo: 0, in_progress: 0, done: 0, ...status }, priority: { low: 0, medium: 0, high: 0, ...priority },
    overdue, dueSoon, completionRate: total ? Math.round(((status.done || 0) / total) * 100) : 0, completedWeek,
    activity: db.prepare('SELECT action, task_title, created_at FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 8').all(uid),
  });
});

export default router;
