import { useEffect, useState, useCallback } from 'react';
import { api, setToken, hasToken } from './api.js';
import Auth from './components/Auth.jsx';
import Dashboard from './components/Dashboard.jsx';
import Board from './components/Board.jsx';
import SmartAdd from './components/SmartAdd.jsx';
import TaskModal from './components/TaskModal.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(hasToken());
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [provider, setProvider] = useState('heuristic');
  const [filter, setFilter] = useState({ q: '', priority: '' });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const loadStats = useCallback(() => api.stats().then(setStats).catch(() => {}), []);
  const loadInsights = useCallback(() => { setInsights(null); api.aiInsights().then(setInsights).catch(() => {}); }, []);
  const loadTasks = useCallback(() => api.tasks().then((d) => setTasks(d.tasks)).catch((e) => notify(e.message)), []);

  useEffect(() => {
    const out = () => setUser(null);
    window.addEventListener('fd-logout', out);
    if (hasToken()) api.me().then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setBooting(false));
    return () => window.removeEventListener('fd-logout', out);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadTasks(); loadStats(); loadInsights();
    api.aiStatus().then((d) => setProvider(d.provider)).catch(() => {});
  }, [user, loadTasks, loadStats, loadInsights]);

  // Optimistic update helpers keep the board snappy; server stays the source of truth.
  const upsert = (task) => setTasks((ts) => (ts.some((t) => t.id === task.id) ? ts.map((t) => (t.id === task.id ? task : t)) : [...ts, task]));

  const createTask = async (payload) => { const { task } = await api.createTask(payload); upsert(task); loadStats(); return task; };
  const updateTask = async (id, patch, optimistic = true) => {
    const prev = tasks;
    if (optimistic) setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try { const { task } = await api.updateTask(id, patch); upsert(task); loadStats(); }
    catch (e) { setTasks(prev); notify(e.message); }
  };
  const deleteTask = async (id) => { await api.deleteTask(id); setTasks((ts) => ts.filter((t) => t.id !== id)); loadStats(); };
  const toggleSub = async (t, s) => { const { task } = await api.toggleSub(t.id, s.id, !s.done); upsert(task); };

  if (booting) return <div className="center muted">Loading…</div>;
  if (!user) return <Auth onAuth={(d) => { setToken(d.token); setUser(d.user); }} />;

  const q = filter.q.toLowerCase();
  const visible = tasks.filter((t) => (!filter.priority || t.priority === filter.priority) &&
    (!q || t.title.toLowerCase().includes(q) || t.tags.some((x) => x.includes(q))));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">⚡</span> FlowDesk <span className="pill">AI</span></div>
        <div className="topbar-right">
          <span className={`badge ${provider}`} title="Active AI provider">{provider === 'claude' ? '● Claude AI' : '● Smart heuristics'}</span>
          <span className="muted">Hi, {user.name.split(' ')[0]}</span>
          <button className="btn ghost" onClick={() => { setToken(null); setUser(null); setTasks([]); }}>Log out</button>
        </div>
      </header>
      <main>
        <SmartAdd onCreate={createTask} notify={notify} />
        <Dashboard stats={stats} insights={insights} onRefresh={loadInsights} onOpen={(id) => setEditing(tasks.find((t) => t.id === id))} />
        <div className="filters">
          <input placeholder="Search tasks or #tags…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
          <select value={filter.priority} onChange={(e) => setFilter({ ...filter, priority: e.target.value })}>
            <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>
        <Board tasks={visible} onMove={updateTask} onOpen={setEditing} onToggleSub={toggleSub} />
      </main>
      {editing && (
        <TaskModal task={tasks.find((t) => t.id === editing.id) || editing} onClose={() => setEditing(null)}
          onSave={async (patch) => { await updateTask(editing.id, patch, false); setEditing(null); }}
          onDelete={async () => { await deleteTask(editing.id); setEditing(null); }}
          onAddSubtasks={async (titles) => { for (const t of titles) await api.addSub(editing.id, t); const d = await api.tasks(); setTasks(d.tasks); }} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
