import { fetchJSON, renderProjects } from '../global.js?v=5';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const projectsStatus = document.querySelector('#projects-status');
const explorer = document.querySelector('.project-explorer');
const searchInput = document.querySelector('#project-search');
const clearButton = document.querySelector('#clear-project-filters');
const filterSummary = document.querySelector('#project-filter-summary');
const chartEmpty = document.querySelector('#chart-empty');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

let projects = [];
let query = '';
let selectedYear = null;
let yearColors;

const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value).sort(null);

// Keep a year as the selected identity. Search can change the slice indices.
function selectYear(year) {
  selectedYear = selectedYear === year ? null : year;
  updateView();
}

function searchableText(project) {
  return Object.values(project)
    .map((value) => (value && typeof value === 'object'
      ? Object.values(value).join('\n')
      : String(value ?? '')))
    .join('\n')
    .toLowerCase();
}

function updateSelection() {
  svg.selectAll('.pie-slice')
    .classed('selected', (d) => d.data.label === selectedYear)
    .attr('aria-pressed', (d) => String(d.data.label === selectedYear));
  legend.selectAll('li')
    .classed('selected', (d) => d.label === selectedYear);
  legend.selectAll('button')
    .attr('aria-pressed', (d) => String(d.label === selectedYear));
  legend.selectAll('.selection-label')
    .text((d) => (d.label === selectedYear ? 'Selected' : ''));
}

function renderPieChart(projectsGiven) {
  const data = d3.rollups(projectsGiven, (group) => group.length, (project) => String(project.year))
    .map(([year, count]) => ({ label: year, value: count }))
    .sort((a, b) => d3.descending(a.label, b.label));

  // A keyed join updates the existing chart and removes obsolete years.
  // It never appends a second copy when the query changes.
  svg.selectAll('.pie-slice')
    .data(sliceGenerator(data), (d) => d.data.label)
    .join('path')
    .attr('class', 'pie-slice')
    .attr('d', arcGenerator)
    .attr('fill', (d) => yearColors(d.data.label))
    .attr('data-year', (d) => d.data.label)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.data.label}: ${d.data.value} projects. Toggle year filter.`)
    .on('click', (event, d) => selectYear(d.data.label))
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectYear(d.data.label);
      }
    })
    .selectAll('title')
    .data((d) => [d])
    .join('title')
    .text((d) => `${d.data.label}: ${d.data.value} projects`);

  const items = legend.selectAll('li')
    .data(data, (d) => d.label)
    .join('li')
    .attr('style', (d) => `--color: ${yearColors(d.label)}`);
  const buttons = items.selectAll('button')
    .data((d) => [d])
    .join('button')
    .attr('type', 'button')
    .attr('data-year', (d) => d.label)
    .attr('aria-label', (d) => `${d.label}: ${d.value} projects. Toggle year filter.`)
    .on('click', (event, d) => selectYear(d.label));
  buttons.selectAll('.swatch').data((d) => [d]).join('span')
    .attr('class', 'swatch').attr('aria-hidden', 'true');
  buttons.selectAll('.year-label').data((d) => [d]).join('span')
    .attr('class', 'year-label').text((d) => d.label);
  buttons.selectAll('.year-count').data((d) => [d]).join('span')
    .attr('class', 'year-count').text((d) => `(${d.value})`);
  buttons.selectAll('.selection-label').data((d) => [d]).join('span')
    .attr('class', 'selection-label');

  const noMatches = data.length === 0;
  svg.attr('hidden', noMatches ? true : null);
  chartEmpty.hidden = !noMatches;
  updateSelection();
}

// Lab 5 extra credit: both controls share this single rendering path.
// The tutorial's independent search and click render calls overwrite each
// other's filter. Apply the query first, then intersect it with the year.
function updateView() {
  const searchResults = projects.filter((project) => searchableText(project).includes(query));
  const filteredProjects = searchResults.filter((project) =>
    selectedYear === null || String(project.year) === selectedYear);

  renderProjects(filteredProjects, projectsContainer, 'h2');
  // Keep other matching years available so readers can change the year filter.
  // Counts describe search results; the status below describes visible cards.
  renderPieChart(searchResults);
  projectsTitle.textContent = `${filteredProjects.length} Projects`;
  const yearMessage = selectedYear === null ? '' : ` in ${selectedYear}`;
  filterSummary.textContent = `Showing ${filteredProjects.length} of ${searchResults.length} search matches${yearMessage}. ${projects.length} projects in total.`;
  clearButton.disabled = query === '' && selectedYear === null;
  if (filteredProjects.length === 0) {
    projectsContainer.querySelector('.data-status').textContent = 'No projects match these filters. Try another search or clear the filters.';
  }
}

// Input and year-selection handlers both call updateView, preserving both filters.
searchInput.addEventListener('input', (event) => {
  query = event.target.value.trim().toLowerCase();
  updateView();
});
clearButton.addEventListener('click', () => {
  query = '';
  selectedYear = null;
  searchInput.value = '';
  updateView();
  searchInput.focus();
});

try {
  if (!projectsContainer || !projectsTitle) {
    throw new Error('The Projects page is missing its container or title.');
  }

  projects = await fetchJSON(new URL('../lib/projects.json', import.meta.url));
  if (!Array.isArray(projects) || projects.some((project) => !Number.isInteger(project.year))) {
    throw new Error('Project data must be an array with a year for every project.');
  }
  const years = [...new Set(projects.map((project) => String(project.year)))].sort(d3.descending);
  // Fix the color domain once: a year keeps its color after filtering.
  yearColors = d3.scaleOrdinal(years, d3.schemeTableau10);
  updateView();
  explorer.hidden = false;
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
  projectsContainer?.setAttribute('aria-busy', 'false');
}
