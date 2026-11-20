import { useState } from 'react';
import { api } from '../api.js';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onAuth(await (mode === 'login' ? api.login(f) : api.register(f))); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="center">
      <form className="card auth" onSubmit={submit}>
        <div className="brand big"><span className="logo">⚡</span> FlowDesk <span className="pill">AI</span></div>
        <p className="muted">Plan smarter. Type a task in plain English and let AI organise it.</p>
        {mode === 'register' && <input placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input type="password" placeholder="Password (6+ chars)" minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
          {mode === 'login' ? "New here? Create an account" : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
