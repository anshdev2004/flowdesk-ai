import { useState } from 'react';
import { api } from '../api.js';

export default function TaskModal({ task, onClose, onSave, onDelete, onAddSubtasks }) {
  const [f, setF] = useState({ title: task.title, description: task.description, priority: task.priority, status: task.status, due_date: task.due_date || '', tags: task.tags.join(', ') });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = () => onSave({ title: f.title, description: f.description, priority: f.priority, status: f.status,
    due_date: f.due_date || null, tags: f.tags.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) });

  const suggest = async () => {
    setBusy(true);
    try { const { subtasks } = await api.aiBreakdown(f.title, f.description); await onAddSubtasks(subtasks); } finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit task</h3>
        <input value={f.title} onChange={set('title')} placeholder="Title" />
        <textarea rows={3} value={f.description} onChange={set('description')} placeholder="Description" />
        <div className="grid2">
          <label>Status<select value={f.status} onChange={set('status')}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
          <label>Priority<select value={f.priority} onChange={set('priority')}><option>low</option><option>medium</option><option>high</option></select></label>
          <label>Due date<input type="date" value={f.due_date} onChange={set('due_date')} /></label>
          <label>Tags (comma separated)<input value={f.tags} onChange={set('tags')} /></label>
        </div>
        <div className="modal-actions">
          <button className="btn danger" onClick={onDelete}>Delete</button>
          <button className="btn ghost" onClick={suggest} disabled={busy}>{busy ? 'Thinking…' : '✨ Suggest subtasks'}</button>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!f.title.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
