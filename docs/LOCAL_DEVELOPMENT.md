# Local development environment

## Ports (default stack)

| Service | Port | Config |
|---------|------|--------|
| Dashboard (CRA) | 3000 | `dashboard/.env` `FRONTEND_URL` in backend |
| Node backend | **5004** | `backend/.env` `PORT` |
| Python core API | 8080 | `backend/.env` `CORE_API_URL` |

All of these must agree:

- `backend/.env` → `PORT`, `BACKEND_PUBLIC_URL`, `BACKEND_API_URL`
- `dashboard/.env` → `REACT_APP_API_URL`
- `dashboard/package.json` → `"proxy"`

## Setup

```powershell
copy backend\.env.example backend\.env
copy dashboard\.env.example dashboard\.env
```

Edit `backend/.env`:

1. Appwrite endpoint, project id, database id, and backend API key
2. `GITHUB_TOKEN` for VelAI (GitHub Models)
3. Optional OAuth client IDs for **live** integrations (leave empty for **demo** mode)

## Run

```powershell
# Terminal 1 — API
cd backend
npm run dev

# Terminal 2 — UI
cd dashboard
npm start
```

Open http://localhost:3000

## Integrations

- **Demo mode**: no Slack/Google/GitHub OAuth env vars — connect buttons complete with simulated tokens.
- **Live mode**: set `SLACK_CLIENT_ID` / `SECRET`, `GOOGLE_WORKSPACE_*`, `GITHUB_*`, and `BACKEND_PUBLIC_URL=http://localhost:5004`.

## Feature flags

- `REACT_APP_INTEGRATIONS_COMING_SOON=true` — hides company integration UI in the dashboard.
