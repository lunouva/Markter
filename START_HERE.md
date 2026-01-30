# Start Here — Markter

## Purpose
Markter is a marketing website with a Netlify Functions backend and a lightweight /admin CRM.

## Key Paths
- `site/` — public marketing site (static HTML/CSS/JS)
- `site/admin/` — admin CRM SPA
- `netlify/functions/` — Netlify Functions (API)
- `db/migrations/` — Postgres schema + migrations
- `netlify.toml` — Netlify build + redirects

## Local Dev
- Preferred: `netlify dev`
- Alternative: `npx netlify dev`

## Key URLs / Routes
- `/admin` (and `/admin/*`) — admin CRM
- `/api/*` — function proxy routes
- `/.netlify/functions/*` — direct function endpoints

## Required Env Vars
From `README.md`:
- `DATABASE_URL`
- `DATABASE_SSL`
- `IP_HASH_SALT`
- `RATE_LIMIT_WINDOW_MIN`
- `RATE_LIMIT_MAX`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM`
- `POSTMARK_SERVER_TOKEN`
- `EMAIL_FROM`
- `FOLLOWUP_HOURS`

## Database Init
- `psql "$DATABASE_URL" -f db/migrations/001_init.sql`

## Quick Smoke Test
- Load the marketing site home page and core pages in `site/`
- Submit the lead form; confirm `/.netlify/functions/lead` succeeds
- Open `/admin` and confirm the admin SPA loads
- Hit one function via `/api/*` or `/.netlify/functions/*` and confirm response
