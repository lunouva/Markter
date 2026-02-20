const tokenKeys = [
  'recovery_token',
  'invite_token',
  'confirmation_token',
  'access_token',
  'token_type',
  'expires_in'
];

const hasTokenParams = (params) => tokenKeys.some((key) => params.has(key));

const hashParams = new URLSearchParams(window.location.hash.slice(1));
const searchParams = new URLSearchParams(window.location.search);

const hashHasTokens = hasTokenParams(hashParams);
const searchHasTokens = hasTokenParams(searchParams);

if (hashHasTokens || searchHasTokens) {
  const combinedParams = new URLSearchParams();
  if (hashHasTokens) {
    hashParams.forEach((value, key) => {
      combinedParams.append(key, value);
    });
  }
  if (searchHasTokens) {
    tokenKeys.forEach((key) => {
      searchParams.getAll(key).forEach((value) => {
        combinedParams.append(key, value);
      });
    });
  }
  const redirectHash = combinedParams.toString() ? `#${combinedParams.toString()}` : '';
  window.location.replace(`/admin${redirectHash}`);
}

const navToggle = document.querySelector('[data-nav-toggle]');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('is-open');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
    });
  });
}

const revealItems = document.querySelectorAll('.reveal');
if (revealItems.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function track(eventType, payload) {
  try {
    const body = JSON.stringify({
      event_type: eventType,
      path: window.location.pathname,
      source_page: window.location.href,
      intent: new URLSearchParams(window.location.search).get('intent') || null,
      payload
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/track', blob);
      return;
    }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch (e) {
    // ignore
  }
}

// Minimal, conversion-focused analytics (stored in Postgres via /api/track)
track('page_view', { title: document.title });

// Track CTA clicks (opt-in via data attributes)
// Usage: <a data-track="cta_click" data-track-label="nav_start_free" ...>
;(() => {
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
      if (!el) return;

      const eventType = String(el.getAttribute('data-track') || '').trim();
      if (!eventType) return;

      const label = el.getAttribute('data-track-label');
      const href = el.getAttribute('href');
      track(eventType, {
        label: label || null,
        href: href || null,
        text: (el.textContent || '').trim().slice(0, 120) || null
      });
    },
    { capture: true }
  );
})();

function parseTags(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function defaultGoalFromIntent(intent) {
  if (intent === 'hobby') return 'start free';
  if (intent === 'pro') return 'pro access';
  return 'growth call';
}

function maybePersonalizeContactPage({ form, intent }) {
  // Personalize the contact page based on intent query param.
  // Examples:
  //  - /contact?intent=service (default)
  //  - /contact?intent=hobby
  //  - /contact?intent=pro
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const isContactish = window.location.pathname === '/contact' || window.location.pathname.endsWith('/contact/') || window.location.pathname.endsWith('contact.html');
  if (!isContactish) return;

  const kickerEl = hero?.querySelector('.kicker');
  const h1El = hero?.querySelector('h1');
  const pEl = hero?.querySelector('p');
  const submitBtn = form.querySelector('button[type="submit"]');
  const assuranceCard = hero?.querySelector('.assurance-card');

  // Default form select value to avoid friction when the user just wants "Start free".
  const serviceSelect = form.querySelector('select[name="service"]');

  // Allow landing pages to pre-select the service via query param.
  // Example: /contact?intent=service&service=Paid%20Search
  const serviceParam = String(searchParams.get('service') || '').trim();
  if (serviceParam && serviceSelect && !serviceSelect.value) {
    const match = Array.from(serviceSelect.options).find((opt) =>
      String(opt.value).trim().toLowerCase() === serviceParam.toLowerCase()
    );
    if (match) serviceSelect.value = match.value;
  }

  if ((intent === 'hobby' || intent === 'pro') && serviceSelect && !serviceSelect.value) {
    // Pick a reasonable default so the required field doesn't block the wedge CTA.
    // (User can still change it.)
    const fallback = Array.from(serviceSelect.options).find((opt) =>
      String(opt.value).toLowerCase().includes('not sure')
    );
    if (fallback) serviceSelect.value = fallback.value;
  }

  if (intent === 'hobby') {
    if (kickerEl) kickerEl.textContent = 'Start free (Hobby)';
    if (h1El) h1El.textContent = 'Get your lead inbox set up in a day.';
    if (pEl) pEl.textContent = 'Answer a few questions and we’ll provision your invite-only access, connect your form, and confirm leads land in your inbox.';
    if (submitBtn) submitBtn.textContent = 'Request Hobby access';
    if (assuranceCard) assuranceCard.style.display = 'none';
  } else if (intent === 'pro') {
    if (kickerEl) kickerEl.textContent = 'Request Pro access';
    if (h1El) h1El.textContent = 'Turn leads into booked jobs faster with SMS follow-up.';
    if (pEl) pEl.textContent = 'Tell us what you sell and where you operate. We’ll confirm fit and provision Pro (invite-only) with consent-friendly texting.';
    if (submitBtn) submitBtn.textContent = 'Request Pro access';
    if (assuranceCard) assuranceCard.style.display = 'none';
  }
}

const leadForms = document.querySelectorAll('[data-lead-form]');
leadForms.forEach((form) => {
  const urlIntent = String(searchParams.get('intent') || '').trim().toLowerCase();
  const intent = String(form.dataset.intent || urlIntent || '').trim().toLowerCase();

  maybePersonalizeContactPage({ form, intent });

  let statusEl = form.querySelector('.form-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'notice form-status';
    statusEl.setAttribute('role', 'status');
    form.appendChild(statusEl);
  }

  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';

    const formData = new FormData(form);

    const websiteUrl = String(formData.get('website_url') || '').trim();
    const companyName = String(formData.get('company') || '').trim();
    const serviceName = String(formData.get('service') || form.dataset.service || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const hpValue = String(formData.get('hp') || '').trim();

    const businessType = String(formData.get('business_type') || '').trim();
    const serviceArea = String(formData.get('service_area') || '').trim();
    const weeklyVolume = String(formData.get('weekly_volume') || '').trim();
    const locationsCount = String(formData.get('locations_count') || '').trim();
    const urgency = String(formData.get('urgency') || '').trim();
    const callbackWindow = String(formData.get('callback_window') || '').trim();

    const formGoal = String(formData.get('goal') || form.dataset.goal || '').trim();
    const goal = formGoal || defaultGoalFromIntent(intent);

    // Compliance: default to NO SMS consent unless user explicitly opts in.
    // (Forms should include a checkbox named `consent_flag` when texting is desired.)
    const consentFlagRaw = formData.get('consent_flag');
    const consentFlag = consentFlagRaw === null ? false : Boolean(consentFlagRaw);

    const tags = ['lead_form'];
    const formKey = String(form.dataset.formKey || '').trim();
    if (formKey) tags.push(`form:${formKey}`);
    if (intent) tags.push(`intent:${intent}`);

    parseTags(form.dataset.tags).forEach((t) => tags.push(t));

    if (websiteUrl) tags.push(`website:${websiteUrl}`);
    if (companyName) tags.push(`company:${companyName}`);
    if (serviceName) tags.push(`service:${serviceName}`);

    const transcript = [];
    if (websiteUrl) transcript.push({ role: 'form', text: `Website URL: ${websiteUrl}` });
    if (companyName) transcript.push({ role: 'form', text: `Company / Business: ${companyName}` });
    if (serviceName) transcript.push({ role: 'form', text: `Service interest: ${serviceName}` });
    if (businessType) transcript.push({ role: 'form', text: `Business type: ${businessType}` });
    if (serviceArea) transcript.push({ role: 'form', text: `Service area: ${serviceArea}` });
    if (weeklyVolume) transcript.push({ role: 'form', text: `Weekly volume: ${weeklyVolume}` });
    if (locationsCount) transcript.push({ role: 'form', text: `Locations: ${locationsCount}` });
    if (urgency) transcript.push({ role: 'form', text: `Urgency: ${urgency}` });
    if (callbackWindow) transcript.push({ role: 'form', text: `Callback window: ${callbackWindow}` });
    if (notes) transcript.push({ role: 'form', text: `Notes: ${notes}` });
    transcript.push({ role: 'form', text: `SMS consent: ${consentFlag ? 'yes' : 'no'}` });

    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      company: companyName,
      website_url: websiteUrl,
      service: serviceName,
      notes,
      business_type: businessType,
      service_area: serviceArea,
      goal,
      platforms: formData.getAll('platforms').length ? formData.getAll('platforms') : String(formData.get('platforms') || ''),
      locations_count: locationsCount ? Number(locationsCount) : null,
      weekly_volume: weeklyVolume ? Number(weeklyVolume) : null,
      urgency,
      callback_window: callbackWindow,
      consent_flag: consentFlag,
      source_page: window.location.href,
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_term: searchParams.get('utm_term'),
      utm_content: searchParams.get('utm_content'),
      gclid: searchParams.get('gclid'),
      transcript,
      tags,
      hp: hpValue
    };

    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        statusEl.textContent = 'Something went wrong. Please call or try again.';
        return;
      }

      let leadId = null;
      try {
        const data = await response.json();
        leadId = data && data.lead_id ? String(data.lead_id) : null;
      } catch (e) {
        // ignore
      }

      track('lead_submit_success', { lead_id: leadId || null, intent, form_key: formKey || null, goal });

      form.reset();

      // Conversion assist: immediately offer the fastest next step.
      statusEl.innerHTML = '';
      const wrapper = document.createElement('div');
      const msg = document.createElement('div');
      msg.textContent = 'Thanks — received. Fastest next step: call now to lock a time.';
      wrapper.appendChild(msg);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '12px';
      actions.style.flexWrap = 'wrap';
      actions.style.marginTop = '12px';

      const callLink = document.createElement('a');
      callLink.className = 'btn btn-primary';
      callLink.href = 'tel:+13125550186';
      callLink.textContent = 'Call now';
      callLink.setAttribute('data-track', 'cta_click');
      callLink.setAttribute('data-track-label', 'lead_thankyou_call_now');

      const emailLink = document.createElement('a');
      emailLink.className = 'btn btn-outline';
      emailLink.href = 'mailto:hello@markter.co?subject=' + encodeURIComponent('Markter follow-up') + (leadId ? '&body=' + encodeURIComponent('Lead ID: ' + leadId) : '');
      emailLink.textContent = 'Or email us';
      emailLink.setAttribute('data-track', 'cta_click');
      emailLink.setAttribute('data-track-label', 'lead_thankyou_email');

      actions.appendChild(callLink);
      actions.appendChild(emailLink);
      wrapper.appendChild(actions);

      if (leadId) {
        const meta = document.createElement('div');
        meta.style.marginTop = '10px';
        meta.style.opacity = '0.8';
        meta.textContent = `Reference: ${leadId}`;
        wrapper.appendChild(meta);
      }

      statusEl.appendChild(wrapper);
    } catch (error) {
      statusEl.textContent = 'Something went wrong. Please call or try again.';
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
});
