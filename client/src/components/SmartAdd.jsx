import { useState } from 'react';
import { api } from '../api.js';

const EXAMPLES = ['Fix login bug urgent tomorrow #auth', 'Write project README by friday', 'Research payment gateways next week'];

export default function SmartAdd({ onCreate, notify }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [breakIt, setBreakIt] = useState(true);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const parsed = await api.aiParse(text);
      const { source, ...fields } = parsed;
      let subtasks;
      if (breakIt) subtasks = (await api.aiBreakdown(fields.title, fields.description)).subtasks;
      await onCreate({ ...fields, subtasks, ai_generated: true });
      notify(`✨ Task created via ${source === 'claude' ? 'Claude' : 'smart parsing'}`);
      setText('');
    } catch (err) { notify(err.message); } finally { setBusy(false); }
  };

  return (
    <form className="card smart" onSubmit={submit}>
      <div className="smart-row">
        <span className="spark">✨</span>
        <input placeholder='Smart Add — try "Fix login bug urgent tomorrow #auth"' value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
        <button className="btn primary" disabled={busy || !text.trim()}>{busy ? 'Thinking…' : 'Add'}</button>
      </div>
      <div className="smart-opts">
        <label><input type="checkbox" checked={breakIt} onChange={(e) => setBreakIt(e.target.checked)} /> Auto-generate subtasks</label>
        <span className="muted">Try:</span>
        {EXAMPLES.map((x) => <button type="button" key={x} className="chip" onClick={() => setText(x)}>{x}</button>)}
      </div>
    </form>
  );
}
