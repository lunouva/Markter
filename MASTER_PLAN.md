# Markter — Master Plan (from current app → bigger picture)

**Status of the codebase today (what we have):**
- **Marketing site**: static HTML under `site/` (Home, Services, Results, About, Contact, Chatbot, Privacy, Terms, etc.).
- **Admin/CRM**: a simple SPA under `site/admin/` served at `/admin/*` (via Netlify redirect).
- **API**: Netlify Functions under `netlify/functions/` exposed as `/api/*` and `/.netlify/functions/*`.
- **Database**: Postgres (`db/migrations/001_init.sql`).
- **Messaging**:
  - Email via **Postmark** (default) using `POSTMARK_SERVER_TOKEN`, `EMAIL_FROM`.
  - SMS via **Twilio** (default) using `TWILIO_*` env vars.
  - A scheduled follow-up job: `functions.followup` runs hourly (`0 * * * *`).
- **Core promise** (from README brand system): "More calls, more orders, less chaos." and lead visibility.

This plan is designed to (1) launch quickly using the current structure, (2) evolve into a productized lead system with tiered plans (Hobby email-only, Pro SMS credits), and (3) support your high-margin offer: **personally managed Google Ads** now, with automation later.

---

## North Star
**A single, measurable outcome:** generate and convert leads.

**Product loop:**
1) capture lead → 2) auto-follow-up → 3) route/track outcome → 4) report ROI → 5) upsell Ads management / higher tier.

---

## Phase 0 — Baseline launch (1–3 days)
**Goal:** turn the current repo into a functioning lead machine + internal CRM.

### 0.1 Deploy + smoke test
- Deploy on Netlify with current `netlify.toml`.
- Verify:
  - All pages render under `site/`.
  - `/admin` loads.
  - `/.netlify/functions/lead` accepts submissions.
  - Admin can log in (Netlify Identity JWT verification).

### 0.2 Database ready
- Provision Postgres.
- Run `db/migrations/001_init.sql`.
- Confirm `pgcrypto` extension availability.

### 0.3 Deliverability + phone
- Configure Postmark + Twilio env vars.
- Test:
  - New lead → email confirmation + internal notification.
  - Follow-up cron runs without errors.

**Exit criteria:** You can drive traffic and reliably capture/track leads end-to-end.

---

## Phase 1 — Turn it into the "free wedge" (Hobby) (3–10 days)
**Goal:** Hobby = email-only lead capture + lead inbox. No SMS, no complex onboarding.

### 1.1 Public-facing product positioning
Right now the marketing site reads like a service business (Google Ads + ops). Keep that—but add a clear split:
- Primary CTA for cold traffic: **Book a growth call** (service)
- Secondary/parallel CTA: **Start free** (product wedge)

### 1.2 Product wedge scope (Hobby)
**Hobby includes:**
- One form (hosted or embeddable)
- Lead inbox/pipeline
- Email notifications + basic auto-reply
- UTM/source capture
- Basic reporting (lead counts, source)

**Hobby limits (suggested):**
- 1 user
- 1 form
- 100–250 leads/month
- 30 days history
- “Powered by Markter” badge

Implementation notes:
- Keep it simple: the “free” wedge can still be **request-access / invite-only** initially (manual provisioning) while you validate.

### 1.3 Add “lead outcome” tracking
You already have a lead system; add an explicit field + UI affordance to mark:
- Contacted / Qualified / Booked / Closed / Lost
This powers ROI reporting and makes Ads management easier to sell.

**Exit criteria:** You can offer a credible free tier that works, and it creates a natural upsell path.

---

## Phase 2 — Pro plan (SMS + credits) (2–4 weeks)
**Goal:** Pro = faster conversion via SMS, with an understandable credit model.

### 2.1 SMS credit system
**Definition:** 1 credit = 1 outbound SMS segment.
- Don’t charge inbound.
- Add opt-out handling and frequency limits.

**Pro includes:**
- Two-way SMS
- Sequences (email + SMS)
- Routing/assignment
- Included SMS credits/month
- Top-up packs (add-on)

### 2.2 Pro onboarding additions
- Phone number provisioning (Twilio) OR bring-your-own number later.
- Consent language + audit trail per contact.

### 2.3 Reporting that sells Pro
- Response time vs conversion
- Conversion by source
- Lead quality score (manual first)

**Exit criteria:** clear paid tier value: “texting + automation converts more leads.”

---

## Phase 3 — Service engine (Google Ads Managed) (start immediately; refine over time)
**Goal:** Use Markter as the operating system for your managed service.

### 3.1 Service page + intake workflow
- Dedicated page: Google Ads for Calls (already spec’d in README)
- Intake captures:
  - industry, service area, budget range, offer, website, tracking access
- Create lead in CRM with a service tag and SLA.

### 3.2 Ops playbook inside the CRM
Add lightweight internal features that reduce your workload:
- Tasks/reminders per lead
- “Next action” required (no lead without next step)
- Weekly report generator (email summary)

**Exit criteria:** every managed client can be run through one repeatable workflow.

---

## Phase 4 — Architecture evolution (subdomains + separation) (when traction demands it)
**Current structure:** everything in one Netlify site with paths:
- marketing: `/` (static)
- admin: `/admin`
- api: `/api/*` → functions

**Bigger-picture target:**
- `www.markter.com` = marketing
- `app.markter.com` = customer/product app (and/or internal ops)
- optional `forms.markter.com` = hosted forms/landing pages

### 4.1 When to move to `app.`
Move when one of these is true:
- You have real users logging in daily (not just internal)
- You need stricter security headers / isolation
- You want separate deploy cadence for app vs marketing

### 4.2 Migration approach (Netlify-friendly)
- Create a second Netlify site for the app.
- Point `app.` DNS to the app site.
- Keep API on the app site to avoid CORS complexity.
- Keep marketing on `www`.

**Note on auth:** avoid cross-subdomain cookie sharing unless absolutely necessary.

---

## Phase 5 — Automation roadmap (assist-first, then autopilot)
**Goal:** you manage Ads first; product gradually reduces labor.

### 5.1 Assist (safe automation)
- Budget pacing + anomaly alerts
- “Suggested negatives” queue
- Weekly recommendations generated from lead outcomes
- Landing page template tests

### 5.2 Guardrailed automation
- Auto-pause bad queries/keywords under constraints
- Bid/budget adjustments within a capped range
- Require human approval early; later allow “auto within rules.”

---

## Metrics to track from day 1
- Visitor → lead conversion rate
- Lead response time
- Lead-to-booked rate
- Cost per lead (for ads clients)
- % leads with a next action (ops hygiene)

---

## Immediate next actions (if you want a crisp checklist)
1) Confirm DB + env vars in a Netlify deploy.
2) Smoke test: submit lead → see it in admin → confirm email/SMS.
3) Decide: do we ship Hobby as self-serve or invite-only for first 10 users?
4) Add a simple pricing page copy stub (Hobby/Pro/Business) even if Pro isn’t live yet.
5) Create the “Google Ads Managed” intake form path and route those leads with SLA.
