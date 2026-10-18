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

// Lab 4: both local JSON files and public APIs use the same loading function.
// Let the calling page decide which error message belongs in its container.
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load data (${response.status} ${response.statusText}).`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching or parsing JSON:', error);
    throw error;
  }
}

function escapeHTML(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (character) => replacements[character]);
}

function projectURL(path) {
  // JSON stores site-relative paths so Home and Projects share the same data.
  const url = new URL(path, BASE_URL);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Project links and images must use HTTP or HTTPS.');
  }
  return url.href;
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!(containerElement instanceof Element)) {
    throw new TypeError('A projects container is required.');
  }
  if (!Array.isArray(projects)) {
    throw new TypeError('Project data must be an array.');
  }
  if (!/^h[1-6]$/.test(headingLevel)) {
    throw new TypeError('Use a heading level from h1 to h6.');
  }

  // Clearing first means a second render replaces cards instead of duplicating them.
  containerElement.innerHTML = '';
  if (projects.length === 0) {
    containerElement.innerHTML = '<p class="data-status">No projects to show yet.</p>';
    return;
  }

  for (const project of projects) {
    const article = document.createElement('article');
    if (project.id) article.id = project.id;
    const title = escapeHTML(project.title || 'Untitled project');
    const image = escapeHTML(projectURL(project.image || 'images/data-illustration.svg'));
    const year = Number.isInteger(project.year) ? project.year : 'Year not listed';
    const kind = project.kind || 'Project';
    const yearLabel = kind === 'Fictional concept' ? `Sample year: ${year}` : year;
    const link = project.link
      ? ` <a href="${escapeHTML(projectURL(project.link.url))}">${escapeHTML(project.link.label)}</a>`
      : '';

    article.innerHTML = `
      <${headingLevel}>${title}</${headingLevel}>
      <img src="${image}" alt="" width="600" height="400" loading="lazy">
      <div class="project-details">
        <p>${escapeHTML(project.description || 'Description coming soon.')}${link}</p>
        <p class="project-meta">${escapeHTML(kind)} · ${escapeHTML(yearLabel)}</p>
      </div>
    `;
    containerElement.appendChild(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}

