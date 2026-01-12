create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  business_type text,
  service_area text,
  goal text,
  platforms text[],
  locations_count integer,
  weekly_volume integer,
  urgency text,
  callback_window text,
  consent_flag boolean,
  consent_at timestamptz,
  source_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  stage text not null default 'New',
  tags text[] default '{}',
  transcript jsonb,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on leads(stage);
create index if not exists leads_created_idx on leads(created_at desc);

create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  name text not null,
  channel text not null,
  subject text,
  body text not null,
  version integer not null,
  active boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists message_templates_key_idx on message_templates(template_key, channel, version desc);
alter table message_templates
  add constraint message_templates_unique unique (template_key, channel, version);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  channel text not null,
  recipient text,
  template_id uuid references message_templates(id),
  template_name text,
  rendered_content text,
  status text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists messages_lead_idx on messages(lead_id, created_at desc);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id text,
  actor_email text,
  action text not null,
  lead_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);

insert into message_templates (template_key, name, channel, subject, body, version, active)
values
  ('new_lead', 'New lead confirmation', 'sms', null, 'Markter here — thanks {{name}}. We will start with the 10-Day Results Assurance and confirm your call window. Do mornings or afternoons work better?', 1, true),
  ('new_lead', 'New lead confirmation', 'email', 'Your Markter growth call', 'Hi {{name}},\\n\\nThanks for reaching out. We will start with the 10-Day Results Assurance and map your first 60 days. Do mornings or afternoons work better for a 20-minute call?\\n\\n— Markter', 1, true),
  ('follow_up', 'Follow-up reminder', 'sms', null, 'Quick check-in {{name}} — want to lock your growth call? We can do Tuesday 11:30 or Thursday 2:00.', 1, true),
  ('follow_up', 'Follow-up reminder', 'email', 'Quick follow-up from Markter', 'Hi {{name}},\\n\\nJust checking in to lock your growth call. Tuesday 11:30 or Thursday 2:00 works on our end.\\n\\n— Markter', 1, true),
  ('booking', 'Booking confirmation', 'sms', null, 'You are booked, {{name}}. We will confirm access details to keep the 10-Day Results Assurance on track.', 1, true),
  ('booking', 'Booking confirmation', 'email', 'Your Markter booking is confirmed', 'Hi {{name}},\\n\\nYou are booked. We will confirm access details right after the call to keep the 10-Day Results Assurance on track.\\n\\n— Markter', 1, true)
on conflict do nothing;
