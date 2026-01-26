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

const leadForm = document.querySelector('[data-lead-form]');
if (leadForm) {
  let statusEl = leadForm.querySelector('.form-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.className = 'notice form-status';
    statusEl.setAttribute('role', 'status');
    leadForm.appendChild(statusEl);
  }

  const submitButton = leadForm.querySelector('button[type="submit"]');

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';

    const formData = new FormData(leadForm);
    const businessName = String(formData.get('business') || '').trim();
    const adSpend = String(formData.get('ad_spend') || '').trim();
    const locationsValue = Number.parseInt(formData.get('locations'), 10);

    const tags = ['contact_form'];
    if (businessName) {
      tags.push(`business:${businessName}`);
    }
    if (adSpend) {
      tags.push(`ad_spend:${adSpend}`);
    }

    const transcript = [];
    if (businessName) {
      transcript.push({ role: 'form', text: `Business name: ${businessName}` });
    }
    if (adSpend) {
      transcript.push({ role: 'form', text: `Current ad spend: ${adSpend}` });
    }

    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      business_type: String(formData.get('business_type') || '').trim(),
      service_area: String(formData.get('service_area') || '').trim(),
      goal: 'growth call',
      platforms: [],
      locations_count: Number.isNaN(locationsValue) ? null : locationsValue,
      weekly_volume: null,
      urgency: String(formData.get('urgency') || '').trim(),
      callback_window: String(formData.get('time_window') || '').trim(),
      consent_flag: true,
      source_page: window.location.pathname,
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_term: searchParams.get('utm_term'),
      utm_content: searchParams.get('utm_content'),
      gclid: searchParams.get('gclid'),
      transcript,
      tags,
      hp: ''
    };

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        statusEl.textContent = 'Something went wrong. Please call or try again.';
        return;
      }

      leadForm.reset();
      statusEl.textContent = 'Thanks. We will confirm within one business hour.';
    } catch (error) {
      statusEl.textContent = 'Something went wrong. Please call or try again.';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}
