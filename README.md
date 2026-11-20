# ⚡ FlowDesk AI — Smart Task Workflow (Mini SaaS)

A full-stack, multi-user task & workflow app with AI-assisted planning.
**React (Vite) + Node.js/Express + SQLite**, JWT auth, Kanban board, analytics dashboard and an AI layer powered by Claude (with an offline heuristic fallback so it always works).

## Features
- **Auth** – register / login, bcrypt-hashed passwords, JWT sessions, per-user data isolation
- **Kanban workflow** – To do → In progress → Done, drag & drop, optimistic UI with rollback
- **Smart Add (AI)** – type *"Fix login bug urgent tomorrow #auth"* → title, priority, due date, tags extracted automatically
- **AI subtasks** – auto-generated, ordered subtasks with progress bars
- **AI Focus** – workload summary + top-3 "what to do next" with reasons
- **Dashboard** – KPIs, overdue / due-soon, 7-day completion chart, activity feed
- Search & priority filters, task editing modal, responsive + dark-mode UI

## Architecture
```
client (React/Vite)  ──/api──▶  server (Express)
  App state + api.js            routes: auth · tasks · stats · ai
                                 ├─ zod validation, JWT middleware, rate limiting
                                 ├─ ai.js  → Claude API  (fallback: heuristics)
                                 └─ db.js  → SQLite (better-sqlite3, WAL, FKs, indexes)
```
| Layer | Choices |
|---|---|
| Frontend | React 18, component-per-concern, optimistic updates, no heavy deps |
| Backend | Layered modules (auth / tasks / ai / db), input validation, transactions, rate limits, centralized error handling |
| Database | Normalised: `users`, `tasks`, `subtasks`, `activity`; indexes on `(user_id,status,position)` and `(user_id,due_date)` |
| AI | Provider abstraction: Claude when `ANTHROPIC_API_KEY` is set, otherwise deterministic NLP heuristics |

## Run locally
```bash
npm run install:all
cp server/.env.example server/.env      # optional: add ANTHROPIC_API_KEY for Claude-powered AI
npm run dev:server                      # http://localhost:4000
npm run dev:client                      # http://localhost:5173
npm test                                # API integration tests
```

## API (all `/api`, JWT required except auth)
| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Create account / sign in |
| GET/POST | `/tasks` | List (filters `status,priority,q,limit,offset`) / create |
| PATCH/DELETE | `/tasks/:id` | Update (incl. drag-drop status/position) / delete |
| POST/PATCH/DELETE | `/tasks/:id/subtasks[/:sid]` | Manage subtasks |
| GET | `/stats` | Dashboard aggregates |
| POST | `/ai/parse` · `/ai/breakdown` · GET `/ai/insights` | AI features |

## Scalability thinking
- **Stateless API** (JWT) → horizontally scalable behind a load balancer
- **DB**: SQL is standard; swap SQLite → PostgreSQL by replacing `db.js` (queries are portable); indexes already target hot paths
- **Fractional `position`** values make drag-reorder O(1) writes instead of renumbering columns
- **AI isolated** behind `ai.js` with timeouts-by-design, graceful fallback and rate limiting → move to a queue/worker for heavy usage
- Next steps: Redis cache for `/stats`, WebSocket live sync, teams/workspaces + RBAC, Docker + CI/CD, cursor pagination

## Deploy (optional live demo)
Backend → Render/Railway (`npm start` in `server/`, set `JWT_SECRET`, `CLIENT_ORIGIN`); Frontend → Vercel/Netlify (`VITE_API_URL=https://<backend>/api`).
    

## how to start the project is 
    firstly install all dependency by cmd = npm run install:all  
    if it is already install al dependency then just use this both cmd 
    first terminal = npm run dev:client
    second terminal = npm run dev:server