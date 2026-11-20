// AI service layer. Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back to
// deterministic heuristics so the app is fully usable offline / without a key.
const MODEL = process.env.AI_MODEL || 'claude-sonnet-4-6';
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

async function claudeJSON(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: system + '\nRespond with ONLY valid JSON, no prose or markdown fences.',
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`AI provider error ${r.status}`);
  const data = await r.json();
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

const iso = (d) => d.toISOString().slice(0, 10);
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function heuristicDate(text, today = new Date()) {
  const t = text.toLowerCase();
  const d = new Date(today);
  if (/\b(today|tonight|eod)\b/.test(t)) return iso(d);
  if (/\btomorrow\b/.test(t)) { d.setDate(d.getDate() + 1); return iso(d); }
  if (/\bnext week\b/.test(t)) { d.setDate(d.getDate() + 7); return iso(d); }
  const inN = t.match(/\bin (\d+) days?\b/);
  if (inN) { d.setDate(d.getDate() + +inN[1]); return iso(d); }
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${DAYS[i]}\\b`).test(t)) {
      const diff = ((i - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return iso(d);
    }
  }
  return null;
}

const TAG_HINTS = {
  bug: /\b(bug|fix|error|crash)\b/, design: /\b(design|ui|ux|mockup|figma)\b/,
  backend: /\b(api|server|database|db|backend)\b/, frontend: /\b(react|frontend|page|component|css)\b/,
  docs: /\b(doc|readme|write|report)\b/, meeting: /\b(meeting|call|sync|demo)\b/,
  research: /\b(research|investigate|explore|compare)\b/,
};

export function heuristicParse(text) {
  const t = text.trim();
  const low = t.toLowerCase();
  let priority = 'medium';
  if (/\b(urgent|asap|critical|important|immediately|blocker|!!)\b/.test(low)) priority = 'high';
  else if (/\b(someday|whenever|low priority|nice to have|maybe)\b/.test(low)) priority = 'low';
  const tags = new Set((t.match(/#(\w+)/g) || []).map((x) => x.slice(1).toLowerCase()));
  for (const [tag, re] of Object.entries(TAG_HINTS)) if (re.test(low)) tags.add(tag);
  const title = t
    .replace(/#\w+/g, '')
    .replace(/\b(urgent|asap|critical|!!|by|due|on)?\s*\b(today|tonight|tomorrow|next week|in \d+ days?)\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim().replace(/^[-–\s]+|[-–\s,]+$/g, '');
  return { title: (title || t).slice(0, 120), description: '', priority, due_date: heuristicDate(t), tags: [...tags].slice(0, 4) };
}

const BREAKDOWN_TEMPLATES = [
  [/(build|create|develop|implement|add)/, ['Clarify requirements and acceptance criteria', 'Design approach / data model', 'Implement core functionality', 'Write tests and handle edge cases', 'Review, polish and ship']],
  [/(fix|bug|debug|issue)/, ['Reproduce the issue', 'Identify root cause', 'Implement the fix', 'Add a regression test', 'Verify in staging']],
  [/(write|document|report|blog|readme)/, ['Outline key points', 'Draft first version', 'Review and edit', 'Get feedback and finalize']],
  [/(research|investigate|compare|evaluate)/, ['Define questions to answer', 'Gather sources / options', 'Compare against criteria', 'Summarize findings and recommend']],
];
export function heuristicBreakdown(title) {
  const low = title.toLowerCase();
  const hit = BREAKDOWN_TEMPLATES.find(([re]) => re.test(low));
  return hit ? hit[1] : ['Define the goal', 'Break into first actions', 'Do the main work', 'Review and wrap up'];
}

const PRIORITY_W = { high: 3, medium: 2, low: 1 };
export function heuristicInsights(tasks) {
  const today = iso(new Date());
  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const score = (t) => PRIORITY_W[t.priority] * 10 + (t.due_date ? Math.max(0, 14 - Math.ceil((new Date(t.due_date) - new Date(today)) / 864e5)) : 0) + (t.status === 'in_progress' ? 3 : 0);
  const focus = [...open].sort((a, b) => score(b) - score(a)).slice(0, 3);
  const done = tasks.length - open.length;
  const summary = !tasks.length ? 'No tasks yet — add one with Smart Add to get started.'
    : `${done}/${tasks.length} tasks complete. ${overdue.length ? `${overdue.length} overdue — tackle those first.` : 'Nothing overdue, nice.'} ${focus[0] ? `Start with "${focus[0].title}".` : 'All clear!'}`;
  return { summary, focus: focus.map((t) => ({ id: t.id, title: t.title, reason: t.due_date && t.due_date < today ? 'Overdue' : t.priority === 'high' ? 'High priority' : t.status === 'in_progress' ? 'Already in progress' : 'Next best by priority/due date' })) };
}

export async function parseTask(text) {
  if (aiEnabled()) {
    try {
      const j = await claudeJSON(
        `Convert a natural-language task into JSON: {"title": string (<=100 chars, imperative), "description": string, "priority": "low"|"medium"|"high", "due_date": "YYYY-MM-DD"|null, "tags": string[] (max 4, lowercase)}. Today is ${iso(new Date())}.`, text);
      return { ...heuristicParse(text), ...j, source: 'claude' };
    } catch (e) { console.warn('AI fallback:', e.message); }
  }
  return { ...heuristicParse(text), source: 'heuristic' };
}

export async function breakdown(title, description = '') {
  if (aiEnabled()) {
    try {
      const j = await claudeJSON('Break the task into 3-6 concrete, ordered subtasks. JSON: {"subtasks": string[]}', `${title}\n${description}`);
      if (Array.isArray(j.subtasks)) return { subtasks: j.subtasks.slice(0, 8).map(String), source: 'claude' };
    } catch (e) { console.warn('AI fallback:', e.message); }
  }
  return { subtasks: heuristicBreakdown(title), source: 'heuristic' };
}

export async function insights(tasks) {
  const base = heuristicInsights(tasks);
  if (aiEnabled() && tasks.length) {
    try {
      const slim = tasks.slice(0, 40).map(({ id, title, status, priority, due_date }) => ({ id, title, status, priority, due_date }));
      const j = await claudeJSON(
        `You are a productivity coach. Given tasks, return JSON: {"summary": string (<=2 sentences, encouraging, specific), "focus": [{"id": number, "title": string, "reason": string}] (top 3 to do next)}. Today is ${iso(new Date())}.`, JSON.stringify(slim));
      if (j.summary && Array.isArray(j.focus)) return { ...j, source: 'claude' };
    } catch (e) { console.warn('AI fallback:', e.message); }
  }
  return { ...base, source: 'heuristic' };
}
