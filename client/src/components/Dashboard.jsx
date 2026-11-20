export default function Dashboard({ stats, insights, onRefresh, onOpen }) {
  if (!stats) return <div className="card muted">Loading dashboard…</div>;
  const max = Math.max(1, ...stats.completedWeek.map((d) => d.count));
  const kpis = [
    ['Total', stats.total], ['In progress', stats.status.in_progress],
    ['Overdue', stats.overdue, stats.overdue ? 'danger' : ''], ['Due in 3 days', stats.dueSoon], ['Done', `${stats.completionRate}%`],
  ];
  return (
    <section className="dash">
      <div className="kpis">{kpis.map(([l, v, c]) => <div key={l} className={`kpi ${c || ''}`}><div className="kpi-v">{v}</div><div className="muted">{l}</div></div>)}</div>
      <div className="dash-grid">
        <div className="card">
          <div className="card-h"><h3>🤖 AI Focus</h3><button className="link" onClick={onRefresh}>Refresh</button></div>
          {!insights ? <p className="muted">Analysing your workload…</p> : (
            <>
              <p>{insights.summary}</p>
              <ol className="focus">{insights.focus.map((f) => (
                <li key={f.id}><button className="link" onClick={() => onOpen(f.id)}>{f.title}</button><span className="muted"> — {f.reason}</span></li>
              ))}</ol>
            </>
          )}
        </div>
        <div className="card">
          <h3>Completed (7 days)</h3>
          <div className="bars">{stats.completedWeek.map((d) => (
            <div key={d.date} className="bar-col" title={`${d.date}: ${d.count}`}>
              <div className="bar" style={{ height: `${(d.count / max) * 100}%` }} />
              <span>{new Date(d.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            </div>))}</div>
        </div>
        <div className="card">
          <h3>Recent activity</h3>
          {stats.activity.length === 0 ? <p className="muted">Nothing yet.</p> : (
            <ul className="activity">{stats.activity.map((a, i) => <li key={i}><b>{a.action}</b> {a.task_title}</li>)}</ul>)}
        </div>
      </div>
    </section>
  );
}
