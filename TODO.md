# Markter — Ready-to-Use TODO

## A) Launch basics (public site)
- [ ] Confirm all pages render: `site/index.html`, `services.html`, `results.html`, `about.html`, `contact.html`, `chatbot.html`, `privacy.html`, `terms.html`
- [ ] Verify nav links + CTAs ("Book a growth call", "Call now") are correct everywhere
- [ ] Add/verify analytics (GA4) + conversion events (form submit / call click) if desired
- [ ] SEO pass: titles/meta, og:image, sitemap, robots.txt

## B) Lead capture (critical path)
- [ ] Confirm the lead submission endpoint works: `/.netlify/functions/lead`
- [ ] Confirm the frontend (form/chatbot) posts to it (`site/assets/chatbot.js` / `site/assets/app.js`)
- [ ] Confirm spam controls: honeypot (`hp`) + rate limit are behaving

## C) Database (Postgres)
- [ ] Provision Postgres and run `db/migrations/001_init.sql`
- [ ] Set env: `DATABASE_URL` (+ `DATABASE_SSL=true` in prod if needed)
- [ ] Ensure `pgcrypto` extension is available (migration requires it)

## D) Admin CRM
- [ ] Verify `/admin/*` routes to `site/admin/index.html` (Netlify redirect already set)
- [ ] Configure Netlify Identity (JWT verification uses Netlify Identity JWKS)
- [ ] Ensure at least one admin user exists with role `admin`

## E) Messaging (optional but usually part of "ready")
- [ ] Decide SMS + email providers
- [ ] Set env vars:
  - SMS (Twilio): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
  - Email (Postmark): `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`
- [ ] Test: new lead sends + follow-up cron (`functions.followup` hourly)

## F) Deployment
- [ ] Deploy on Netlify (configured: `publish = "site"`, `functions = "netlify/functions"`)
- [ ] Verify redirects: `/api/*` -> functions, `/admin/*` -> SPA admin
- [ ] Production smoke test: public pages + lead submit + admin login
