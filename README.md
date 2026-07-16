# Notebook Calendar

A calendar app with Organizations, Users, and cross-org Teams, styled like a
paper notebook (light "day page" / dark "night page" theme). FastAPI backend,
vanilla HTML/CSS/JS frontend — no build step required.

## Structure

```
calendar-app/
  backend/     FastAPI + SQLAlchemy + SQLite
  frontend/    Static HTML/CSS/JS (no framework, no build step)
```

## Data model

- **Organization** — name, description, color
- **User** — belongs to exactly one Organization
- **Team** — a named group whose members are Users pulled from *any*
  Organization (many-to-many), so a team can span multiple orgs
- **Event** — has start/end time, optional link to an Organization and/or
  Team, and a list of attendee Users

## 1. Run the backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # optional but recommended
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at
`http://localhost:8000/docs`). It uses a local SQLite file (`calendar.db`,
created automatically). The first time the frontend loads against an empty
database, it will call `POST /seed` automatically to add two demo
organizations, four users, one cross-org team, and two events, so you have
something to look at immediately. Delete `calendar.db` any time to reset.

## 1b. Run the backend with Docker (alternative to the venv steps above)

```bash
cd backend
docker build -t notebook-calendar-api .
docker run -d --name notebook-calendar-api \
  -p 8000:8000 \
  -v calendar-data:/data \
  notebook-calendar-api
```

This uses a persistent named volume (`calendar-data`) mounted at `/data` so
the SQLite file survives container restarts/rebuilds. Check it's healthy:

```bash
curl http://localhost:8000/
docker logs -f notebook-calendar-api
```

Environment variables you can override with `-e`:

| Variable          | Default                          | Purpose                                                             |
|-------------------|-----------------------------------|----------------------------------------------------------------------|
| `PORT`            | `8000`                            | Port uvicorn binds to inside the container                          |
| `DATABASE_URL`    | `sqlite:////data/calendar.db`     | SQLAlchemy URL — point this at Postgres etc. for real deployments   |
| `ALLOWED_ORIGINS` | `*`                                | Comma-separated list of allowed frontend origins in production      |

Example for production, once your frontend is deployed:

```bash
docker run -d --name notebook-calendar-api \
  -p 8000:8000 \
  -v calendar-data:/data \
  -e ALLOWED_ORIGINS=https://your-site.netlify.app \
  notebook-calendar-api
```

### Or run everything with docker-compose

From the project root (`calendar-app/`), this builds the backend image and
also serves the static frontend on port 5500:

```bash
docker compose up --build
```

Backend: `http://localhost:8000` · Frontend: `http://localhost:5500`

## 2. Run the frontend

The frontend is static — any file server works. From the `frontend/` folder:

```bash
cd frontend
python3 -m http.server 5500
```

Then open `http://localhost:5500` in your browser. The backend already has
CORS wide open for local development, so no proxy config is needed.

If you serve the backend from somewhere other than `http://localhost:8000`,
set `window.API_BASE` before `app.js` loads, e.g. add this to `index.html`
right before `<script src="app.js">`:

```html
<script>window.API_BASE = "https://your-api-host.example.com";</script>
```

## Notes

- Theme (light/dark) is remembered via `localStorage`.
- Click any calendar day to create an event; click an existing event chip to
  edit or delete it.
- Manage team membership (including adding a user from a different
  organization) via the pencil icon on a team card.
- Full REST API: `/organizations`, `/users`, `/teams`
  (+ `/teams/{id}/members/{user_id}`), `/events` — all standard CRUD, plus
  filtering on `GET /events` by `start`, `end`, `organization_id`, `team_id`,
  `user_id`.
