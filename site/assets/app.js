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
  const successMessage = leadForm.querySelector('.form-success');
  const errorMessage = leadForm.querySelector('.form-error');
  const submitButton = leadForm.querySelector('button[type=\"submit\"]');
  const originalButtonText = submitButton ? submitButton.textContent : '';

  leadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    leadForm.classList.remove('is-success', 'is-error');
    if (errorMessage) {
      errorMessage.textContent = '';
    }

    if (!leadForm.checkValidity()) {
      leadForm.reportValidity();
      return;
    }

    const formData = new FormData(leadForm);
    const payload = Object.fromEntries(formData.entries());

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    try {
      const response = await fetch(leadForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      leadForm.reset();
      leadForm.classList.add('is-success');
      if (successMessage) {
        successMessage.textContent = 'Thanks! Your plan is on the way. We will reach out shortly.';
      }
    } catch (error) {
      leadForm.classList.add('is-error');
      if (errorMessage) {
        errorMessage.textContent = 'Something went wrong. Please try again or email hello@markter.co.';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}
