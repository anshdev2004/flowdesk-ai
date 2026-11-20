const BASE = import.meta.env.VITE_API_URL || '/api';
let token = localStorage.getItem('fd_token');
export const setToken = (t) => { token = t; t ? localStorage.setItem('fd_token', t) : localStorage.removeItem('fd_token'); };
export const hasToken = () => !!token;

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) { setToken(null); window.dispatchEvent(new Event('fd-logout')); }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (b) => req('/auth/login', { method: 'POST', body: b }),
  register: (b) => req('/auth/register', { method: 'POST', body: b }),
  me: () => req('/auth/me'),
  tasks: (q = '') => req(`/tasks${q}`),
  createTask: (b) => req('/tasks', { method: 'POST', body: b }),
  updateTask: (id, b) => req(`/tasks/${id}`, { method: 'PATCH', body: b }),
  deleteTask: (id) => req(`/tasks/${id}`, { method: 'DELETE' }),
  toggleSub: (id, sid, done) => req(`/tasks/${id}/subtasks/${sid}`, { method: 'PATCH', body: { done } }),
  addSub: (id, title) => req(`/tasks/${id}/subtasks`, { method: 'POST', body: { title } }),
  stats: () => req('/stats'),
  aiParse: (text) => req('/ai/parse', { method: 'POST', body: { text } }),
  aiBreakdown: (title, description) => req('/ai/breakdown', { method: 'POST', body: { title, description } }),
  aiInsights: () => req('/ai/insights'),
  aiStatus: () => req('/ai/status'),
};
