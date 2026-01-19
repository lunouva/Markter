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

if (hasTokenParams(hashParams) || hasTokenParams(searchParams)) {
  const combinedParams = new URLSearchParams(hashParams.toString());
  if (hasTokenParams(searchParams)) {
    searchParams.forEach((value, key) => {
      combinedParams.append(key, value);
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
