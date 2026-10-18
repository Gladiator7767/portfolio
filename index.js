import { fetchJSON, renderProjects, fetchGitHubData } from './global.js?v=4';

async function loadLatestProjects() {
  const container = document.querySelector('.projects');
  if (!container) return;
  try {
    const projects = await fetchJSON(new URL('./lib/projects.json', import.meta.url));
    if (!Array.isArray(projects)) throw new TypeError('Project data must be an array.');
    // The JSON file is kept in display order, with current coursework first.
    renderProjects(projects.slice(0, 3), container, 'h3');
  } catch (error) {
    container.textContent = 'Projects could not be loaded. Please refresh the page to try again.';
  }
}

async function loadGitHubStats() {
  const container = document.querySelector('#profile-stats');
  const refreshButton = document.querySelector('#refresh-stats');
  if (!container) return;
  if (refreshButton) refreshButton.disabled = true;
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<p class="data-status">Loading GitHub stats…</p>';

  try {
    const data = await fetchGitHubData('Gladiator7767');
    const fields = [
      ['Public repos', 'public_repos'],
      ['Public gists', 'public_gists'],
      ['Followers', 'followers'],
      ['Following', 'following'],
    ];
    // Missing API data is not the same as a real count of zero.
    if (!fields.every(([, key]) => Number.isInteger(data?.[key]) && data[key] >= 0)) {
      throw new Error('GitHub returned incomplete profile stats.');
    }
    container.innerHTML = `<dl class="profile-stats-grid">${fields.map(([label, key]) => `
      <div><dt>${label}</dt><dd>${data[key].toLocaleString('en-US')}</dd></div>
    `).join('')}</dl>`;
  } catch (error) {
    container.textContent = 'GitHub stats are unavailable right now. Try Refresh stats again later, or open the profile link above.';
  } finally {
    container.setAttribute('aria-busy', 'false');
    if (refreshButton) refreshButton.disabled = false;
  }
}

document.querySelector('#refresh-stats')?.addEventListener('click', loadGitHubStats);
// A slow or unavailable API must not prevent local projects from appearing.
loadLatestProjects();
loadGitHubStats();
