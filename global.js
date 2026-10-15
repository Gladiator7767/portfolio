console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Resolve links from this shared module's directory. This also works when
// WebStorm or GitHub Pages serves the whole site inside /portfolio/.
const BASE_URL = new URL('./', import.meta.url);
const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/Gladiator7767', title: 'GitHub ↗' },
];

// A directory URL and its explicit index.html represent the same page.
function pagePath(pathname) {
  return pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
}

const nav = document.createElement('nav');
nav.setAttribute('aria-label', 'Main navigation');
for (const page of pages) {
  const link = document.createElement('a');
  link.href = new URL(page.url, BASE_URL).href;
  link.textContent = page.title;

  if (link.host === location.host && pagePath(link.pathname) === pagePath(location.pathname)) {
    link.classList.add('current');
    link.setAttribute('aria-current', 'page');
  }
  if (link.host !== location.host) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  nav.append(link);
}
document.querySelector('.site-header').after(nav);

const themeContainer = document.querySelector('#theme-control');
if (themeContainer) {
  const label = document.createElement('label');
  label.className = 'theme-label';
  label.append('Theme ');
  const select = document.createElement('select');
  select.id = 'color-scheme';
  const themes = [
    { value: 'light dark', label: 'Automatic' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];
  for (const theme of themes) {
    const option = document.createElement('option');
    option.value = theme.value;
    option.textContent = theme.label;
    select.append(option);
  }
  label.append(select);
  themeContainer.append(label);

  function applyTheme(value) {
    const validValue = themes.some((theme) => theme.value === value) ? value : 'light dark';
    document.documentElement.style.setProperty('color-scheme', validValue);
    select.value = validValue;
  }

  // Storage may be unavailable in a restricted browser; the switch still works.
  try {
    applyTheme(localStorage.getItem('colorScheme'));
  } catch {
    applyTheme('light dark');
  }
  select.addEventListener('input', () => {
    applyTheme(select.value);
    try {
      localStorage.setItem('colorScheme', select.value);
    } catch {
      // Keep the current page usable even without persistent browser storage.
    }
  });
}

// Lab 3's optional contact improvement: encode each field separately so
// spaces, plus signs, ampersands, and non-English text survive in the draft.
export function createMailtoURL(action, data) {
  const parameters = [];
  for (const [name, value] of data) {
    const text = name === 'body' ? value.replace(/\r?\n/g, '\r\n') : value;
    parameters.push(`${encodeURIComponent(name)}=${encodeURIComponent(text)}`);
  }
  return `${action}?${parameters.join('&')}`;
}

const contactForm = $$('form[action^="mailto:"]')[0];
contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(contactForm);
  location.href = createMailtoURL(contactForm.action, data);
});

