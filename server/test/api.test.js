import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DB_FILE = ':memory:';
const { createApp } = await import('../src/app.js');
const { heuristicParse } = await import('../src/ai.js');

const server = createApp().listen(0);
const base = `http://localhost:${server.address().port}/api`;
const call = (p, o = {}, t) => fetch(base + p, { ...o, headers: { 'content-type': 'application/json', ...(t && { authorization: `Bearer ${t}` }) }, body: o.body && JSON.stringify(o.body) }).then(async (r) => ({ s: r.status, j: r.status === 204 ? null : await r.json() }));

test('full workflow', async () => {
  const reg = await call('/auth/register', { method: 'POST', body: { name: 'Ansh', email: 'a@b.co', password: 'secret1' } });
  assert.equal(reg.s, 201);
  const t = reg.j.token;
  assert.equal((await call('/tasks')).s, 401);
  const parsed = await call('/ai/parse', { method: 'POST', body: { text: 'Fix login bug urgent tomorrow #auth' } }, t);
  assert.equal(parsed.j.priority, 'high'); assert.ok(parsed.j.tags.includes('auth'));
  const c = await call('/tasks', { method: 'POST', body: { ...parsed.j, subtasks: ['a', 'b'] } }, t);
  assert.equal(c.s, 201); assert.equal(c.j.task.subtasks.length, 2);
  const u = await call(`/tasks/${c.j.task.id}`, { method: 'PATCH', body: { status: 'done' } }, t);
  assert.equal(u.j.task.status, 'done');
  const st = await call('/stats', {}, t);
  assert.equal(st.j.status.done, 1); assert.equal(st.j.completionRate, 100);
  const other = await call('/auth/register', { method: 'POST', body: { name: 'X', email: 'x@y.co', password: 'secret1' } });
  assert.equal((await call(`/tasks/${c.j.task.id}`, { method: 'DELETE' }, other.j.token)).s, 404);
  server.close();
});
test('heuristic parse', () => assert.equal(heuristicParse('someday read docs').priority, 'low'));
