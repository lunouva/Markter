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
    const websiteUrl = String(formData.get('website_url') || '').trim();
    const companyName = String(formData.get('company') || '').trim();
    const serviceName = String(formData.get('service') || '').trim();
    const notes = String(formData.get('notes') || '').trim();
    const hpValue = String(formData.get('hp') || '').trim();

    const intent = String(searchParams.get('intent') || '').trim().toLowerCase();

    const tags = ['contact_form'];
    if (intent) {
      tags.push(`intent:${intent}`);
    }
    if (websiteUrl) {
      tags.push(`website:${websiteUrl}`);
    }
    if (companyName) {
      tags.push(`company:${companyName}`);
    }
    if (serviceName) {
      tags.push(`service:${serviceName}`);
    }

    const transcript = [];
    if (websiteUrl) {
      transcript.push({ role: 'form', text: `Website URL: ${websiteUrl}` });
    }
    if (companyName) {
      transcript.push({ role: 'form', text: `Company / Business: ${companyName}` });
    }
    if (serviceName) {
      transcript.push({ role: 'form', text: `Service interest: ${serviceName}` });
    }
    if (notes) {
      transcript.push({ role: 'form', text: `Notes: ${notes}` });
    }

    const goal = intent === 'hobby' ? 'start free' : intent === 'pro' ? 'pro access' : 'growth call';

    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      company: companyName,
      website_url: websiteUrl,
      service: serviceName,
      notes,
      business_type: '',
      service_area: '',
      goal,
      platforms: [],
      locations_count: null,
      weekly_volume: null,
      urgency: '',
      callback_window: '',
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
      hp: hpValue
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
