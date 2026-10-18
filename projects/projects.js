import { fetchJSON, renderProjects } from '../global.js?v=4';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const projectsStatus = document.querySelector('#projects-status');

try {
  if (!projectsContainer || !projectsTitle) {
    throw new Error('The Projects page is missing its container or title.');
  }

  const projects = await fetchJSON(new URL('../lib/projects.json', import.meta.url));
  if (!Array.isArray(projects)) {
    throw new Error('Project data must be an array.');
  }

  renderProjects(projects, projectsContainer, 'h2');
  projectsTitle.textContent = `${projects.length} Projects`;
  if (projectsStatus) {
    projectsStatus.textContent = '';
    projectsStatus.hidden = true;
  }
} catch (error) {
  if (projectsStatus) {
    projectsStatus.textContent = 'Projects could not be loaded. Please refresh the page and try again.';
    projectsStatus.hidden = false;
  }
  console.error('Unable to display projects:', error);
} finally {
  if (projectsContainer) {
    projectsContainer.setAttribute('aria-busy', 'false');
  }
}
