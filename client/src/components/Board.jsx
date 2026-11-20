import { useState } from 'react';

const COLS = [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']];
const today = () => new Date().toISOString().slice(0, 10);

export default function Board({ tasks, onMove, onOpen, onToggleSub }) {
  const [over, setOver] = useState(null);

  const drop = (e, status) => {
    e.preventDefault(); setOver(null);
    const id = +e.dataTransfer.getData('text/plain');
    const col = tasks.filter((t) => t.status === status && t.id !== id);
    // Place at end of column; fractional positions allow cheap reordering without renumbering.
    const position = (col.at(-1)?.position ?? 0) + 1000;
    onMove(id, { status, position });
  };

  return (
    <div className="board">
      {COLS.map(([key, label]) => {
        const items = tasks.filter((t) => t.status === key);
        return (
          <div key={key} className={`col ${over === key ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver(null)} onDrop={(e) => drop(e, key)}>
            <div className="col-h"><b>{label}</b><span className="count">{items.length}</span></div>
            {items.length === 0 && <div className="empty">Drop tasks here</div>}
            {items.map((t) => {
              const done = t.subtasks.filter((s) => s.done).length;
              const overdue = t.due_date && t.due_date < today() && t.status !== 'done';
              return (
                <div key={t.id} className={`task p-${t.priority}`} draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => onOpen(t)}>
                  <div className="task-title">{t.ai_generated && <span title="AI-created">✨ </span>}{t.title}</div>
                  <div className="meta">
                    <span className={`prio ${t.priority}`}>{t.priority}</span>
                    {t.due_date && <span className={overdue ? 'due overdue' : 'due'}>📅 {t.due_date}</span>}
                    {t.tags.map((g) => <span key={g} className="tag">#{g}</span>)}
                  </div>
                  {t.subtasks.length > 0 && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <div className="progress"><div style={{ width: `${(done / t.subtasks.length) * 100}%` }} /></div>
                      <div className="subs">{t.subtasks.map((s) => (
                        <label key={s.id} className={s.done ? 'sub done' : 'sub'}><input type="checkbox" checked={s.done} onChange={() => onToggleSub(t, s)} /> {s.title}</label>))}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
