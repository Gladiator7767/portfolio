import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

const REPOSITORY = 'https://github.com/Gladiator7767/portfolio';
const integer = d3.format(',d');
const percentage = d3.format('.1~%');
const tooltip = document.querySelector('#commit-tooltip');
const tooltipLink = document.querySelector('#commit-link');
let hideTimer;
let activeMark;
let data = [];
let commits = [];
let brushGroup;
let brush;
let xScale;
let yScale;
let selectedIds = new Set();
let brushBounds = null;
let filteredCommits = [];
let timeScale;
let commitMaxTime;
let scroller;
let currentCutoff = null;
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function convertRow(row) {
  // The zero hash describes uncommitted lines, not a real GitHub commit.
  if (!/^[a-f0-9]{7,40}$/i.test(row.commit) || /^0+$/.test(row.commit)) return null;
  const originalDate = row.date;
  const wallTime = new Date(`${originalDate}T${row.time}Z`);
  const datetime = new Date(row.datetime);
  if (!Number.isFinite(+wallTime) || !Number.isFinite(+datetime)) return null;
  return {
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    originalDate,
    date: new Date(`${originalDate}T00:00:00${row.timezone}`),
    datetime,
    // A UTC scale reads the recorded wall-clock fields without converting them
    // to the viewer's time zone. Both axes and the tooltip use these same fields.
    wallTime,
  };
}

function processCommits(rows) {
  return d3.groups(rows, (d) => d.commit).map(([id, lines]) => {
    const first = lines[0];
    const [hours, minutes, seconds = 0] = first.time.split(':').map(Number);
    const commit = {
      id,
      url: `${REPOSITORY}/commit/${id}`,
      author: first.author,
      date: first.date,
      originalDate: first.originalDate,
      time: first.time,
      timezone: first.timezone,
      datetime: first.datetime,
      wallTime: first.wallTime,
      hourFrac: hours + minutes / 60 + seconds / 3600,
      totalLines: lines.length,
    };
    Object.defineProperty(commit, 'lines', { value: lines, enumerable: false });
    return commit;
  }).sort((a, b) => a.datetime - b.datetime || d3.ascending(a.id, b.id));
}

function renderCommitInfo() {
  const visibleLines = filteredCommits.flatMap((d) => d.lines);
  const stats = [
    ['Retained lines', integer(visibleLines.length)],
    ['Commits represented', integer(filteredCommits.length)],
    ['Files', integer(d3.group(visibleLines, (d) => d.file).size)],
    ['Languages', integer(d3.group(visibleLines, (d) => d.type).size)],
    ['Avg. line length', `${d3.format('.1f')(d3.mean(visibleLines, (d) => d.length) || 0)} chars`],
    ['Max. indent depth', integer(d3.max(visibleLines, (d) => d.depth) || 0)],
  ];
  const dl = d3.select('#stats').selectAll('dl').data([null]).join('dl').attr('class', 'stats');
  const groups = dl.selectAll('div').data(stats, (d) => d[0]).join((enter) => {
    const group = enter.append('div');
    group.append('dt');
    group.append('dd');
    return group;
  });
  groups.select('dt').text((d) => d[0]);
  groups.select('dd').text((d) => d[1]);
}

function renderTooltipContent(commit) {
  tooltipLink.href = commit.url;
  tooltipLink.textContent = commit.id.slice(0, 8);
  document.querySelector('#commit-date').textContent = d3.utcFormat('%b %d, %Y')(commit.wallTime);
  document.querySelector('#commit-time').textContent = `${commit.time} (UTC${commit.timezone})`;
  document.querySelector('#commit-author').textContent = commit.author;
  document.querySelector('#commit-lines').textContent = integer(commit.totalLines);
}

function updateTooltipPosition(clientX, clientY) {
  const bounds = tooltip.getBoundingClientRect();
  const margin = 12;
  let left = clientX + 14;
  let top = clientY + 14;
  if (left + bounds.width > innerWidth - margin) left = clientX - bounds.width - 14;
  if (top + bounds.height > innerHeight - margin) top = clientY - bounds.height - 14;
  tooltip.style.left = `${Math.max(margin, left)}px`;
  tooltip.style.top = `${Math.max(margin, top)}px`;
}

function showTooltip(event, commit) {
  clearTimeout(hideTimer);
  activeMark = event.currentTarget;
  renderTooltipContent(commit);
  tooltip.hidden = false;
  const box = activeMark.getBoundingClientRect();
  updateTooltipPosition(event.clientX ?? box.right, event.clientY ?? box.top);
}

function scheduleTooltipHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!tooltip.matches(':hover, :focus-within') && activeMark !== document.activeElement) {
      tooltip.hidden = true;
    }
  }, 250);
}

tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
tooltip.addEventListener('mouseleave', scheduleTooltipHide);
tooltip.addEventListener('focusin', () => clearTimeout(hideTimer));
tooltip.addEventListener('focusout', scheduleTooltipHide);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (tooltip.contains(document.activeElement) && activeMark) activeMark.focus();
    tooltip.hidden = true;
    clearTimeout(hideTimer);
  }
});
window.addEventListener('scroll', () => {
  if (!tooltip.contains(document.activeElement)) tooltip.hidden = true;
}, { passive: true });

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.wallTime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function languageName(type) {
  return ({ js: 'JavaScript', ts: 'TypeScript', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown', svg: 'SVG' })[type] || type;
}

function renderSelection() {
  const selected = filteredCommits.filter((d) => selectedIds.has(d.id));
  document.querySelector('#selection-count').textContent = selected.length
    ? `${integer(selected.length)} ${selected.length === 1 ? 'commit' : 'commits'} selected`
    : 'No commits selected';
  document.querySelector('#clear-selection').disabled = !brushBounds && !selected.length;
  document.querySelector('#selection-help').hidden = selected.length > 0;
  document.querySelector('#selection-help').textContent = brushBounds
    ? 'No dots inside this rectangle. Drag it over a commit or clear it.'
    : 'Select dots to see their line counts by language.';
  d3.select('#chart').selectAll('.commit-dot')
    .classed('selected', (d) => selectedIds.has(d.id))
    .classed('muted', (d) => Boolean(brushBounds) && !selectedIds.has(d.id));
  const lines = selected.flatMap((d) => d.lines);
  const breakdown = d3.rollups(lines, (rows) => rows.length, (d) => d.type)
    .sort((a, b) => d3.descending(a[1], b[1]));
  const groups = d3.select('#language-breakdown').selectAll('div.language-item')
    .data(breakdown, (d) => d[0]).join((enter) => {
      const group = enter.append('div').attr('class', 'language-item');
      group.append('dt');
      const value = group.append('dd');
      value.append('span');
      value.append('div').attr('class', 'language-track').attr('aria-hidden', 'true')
        .append('div').attr('class', 'language-fill');
      return group;
    });
  groups.select('dt').text((d) => languageName(d[0]));
  groups.select('dd span').text((d) => `${integer(d[1])} lines (${percentage(d[1] / lines.length)})`);
  groups.select('.language-fill').style('width', (d) => `${100 * d[1] / lines.length}%`);
}

function brushed(event) {
  brushBounds = event.selection;
  selectedIds = new Set(filteredCommits.filter((d) => isCommitSelected(brushBounds, d)).map((d) => d.id));
  tooltip.hidden = true;
  renderSelection();
}

function renderSizeLegend(rScale, maxLines) {
  const examples = [...new Set([Math.max(1, Math.round(maxLines / 4)), Math.max(1, Math.round(maxLines / 2)), maxLines])];
  const legend = d3.select('#size-legend').selectAll('svg').data([null]).join('svg')
    .attr('viewBox', '0 0 270 70').attr('role', 'img').attr('aria-label', 'Circle area represents retained line count');
  legend.selectAll('*').remove();
  legend.append('text').attr('x', 0).attr('y', 30).text('Retained lines');
  const symbols = legend.selectAll('g').data(examples).join('g').attr('transform', (_, i) => `translate(${108 + i * 64}, 30)`);
  symbols.append('circle').attr('r', (d) => rScale(d));
  symbols.append('text').attr('y', 36).attr('text-anchor', 'middle').text(integer);
}

function renderScatterPlot() {
  const container = document.querySelector('#chart');
  const width = Math.max(280, container.clientWidth);
  const height = innerWidth < 700 ? 220 : 340;
  const margin = { top: 24, right: 22, bottom: 44, left: 46 };
  const bounds = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const oldDataBounds = brushBounds && xScale && yScale ? [
    [xScale.invert(brushBounds[0][0]), yScale.invert(brushBounds[0][1])],
    [xScale.invert(brushBounds[1][0]), yScale.invert(brushBounds[1][1])],
  ] : null;
  const extent = d3.extent(filteredCommits.length ? filteredCommits : commits, (d) => d.wallTime);
  const day = 86400000;
  const span = Math.max(day, extent[1] - extent[0]);
  xScale = d3.scaleUtc().domain([new Date(+extent[0] - span * 0.04), new Date(+extent[1] + span * 0.04)])
    .range([bounds.left, bounds.right]).nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([bounds.bottom, bounds.top]);
  const maxLines = d3.max(commits, (d) => d.totalLines);
  // Zero-to-zero keeps area exactly proportional to count (area = pi * r^2).
  const rScale = d3.scaleSqrt().domain([0, maxLines]).range([0, 24]);
  const svg = d3.select(container).selectAll('svg').data([null]).join('svg')
    .attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'group')
    .attr('aria-labelledby', 'chart-title').attr('aria-describedby', 'chart-help');
  // Initialize groups once. Reusing them keeps each commit's keyed mark stable.
  const layer = (name) => svg.selectAll(`g.${name}`).data([null]).join('g').attr('class', name);
  const hours = d3.range(0, 25, 4);
  layer('gridlines').attr('transform', `translate(${bounds.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(hours).tickFormat('').tickSize(-(bounds.right - bounds.left)));
  const days = d3.utcDay.range(d3.utcDay.ceil(xScale.domain()[0]), xScale.domain()[1]);
  const tickStep = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((width - 68) / 95))));
  layer('x-axis').classed('axis', true).attr('transform', `translate(0,${bounds.bottom})`)
    .call(d3.axisBottom(xScale).tickValues(days.filter((d, i) => i % tickStep === 0)).tickFormat(d3.utcFormat('%b %d')));
  layer('y-axis').classed('axis', true).attr('transform', `translate(${bounds.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(hours).tickFormat((d) => `${String(d).padStart(2, '0')}:00`));
  svg.selectAll('text.y-label').data([null]).join('text').attr('class', 'axis-label y-label').attr('x', bounds.left).attr('y', 13).text('Time of day');
  svg.selectAll('text.x-label').data([null]).join('text').attr('class', 'axis-label x-label').attr('x', (bounds.left + bounds.right) / 2)
    .attr('y', height - 7).attr('text-anchor', 'middle').text(`Commit date · ${d3.utcFormat('%Y')(extent[0])}`);
  // The brush is painted first; dots remain on top and can still receive hover.
  brushGroup = layer('brush');
  brush ??= d3.brush().on('start brush end', brushed);
  brush.extent([[bounds.left, bounds.top], [bounds.right, bounds.bottom]]);
  brushGroup.call(brush);
  const marks = layer('dots').selectAll('g.commit-mark')
    .data(d3.sort(filteredCommits, (d) => -d.totalLines), (d) => d.id).join((enter) => {
      const mark = enter.append('g');
      mark.append('circle').attr('class', 'hit-target').attr('fill', 'transparent').attr('aria-hidden', 'true');
      mark.append('circle').attr('class', 'commit-dot').attr('aria-hidden', 'true');
      return mark;
    })
    .attr('class', 'commit-mark').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `Commit ${d.id.slice(0, 8)}, ${d.originalDate} at ${d.time}, ${integer(d.totalLines)} retained lines. Enter for the commit link.`)
    .style('transform', (d) => `translate(${xScale(d.wallTime)}px,${yScale(d.hourFrac)}px)`)
    .on('mouseenter', showTooltip)
    .on('mousemove', (event) => {
      if (!tooltip.hidden) updateTooltipPosition(event.clientX, event.clientY);
    })
    .on('mouseleave', scheduleTooltipHide)
    .on('focus', showTooltip)
    .on('blur', scheduleTooltipHide)
    .on('click', showTooltip)
    .on('keydown', (event, commit) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showTooltip(event, commit);
        tooltipLink.focus();
      }
    });
  // Invisible hit targets make small circles easier to reach without changing
  // their visible area or their quantitative encoding.
  marks.select('.hit-target').attr('r', (d) => Math.max(6, rScale(d.totalLines)));
  marks.select('.commit-dot').attr('r', (d) => rScale(d.totalLines));
  renderSizeLegend(rScale, maxLines);
  if (oldDataBounds) {
    brushGroup.call(brush.move, oldDataBounds.map(([date, hour]) => [xScale(date), yScale(hour)]));
  } else {
    renderSelection();
  }
}

document.querySelector('#clear-selection').addEventListener('click', () => {
  brushGroup.call(brush.move, null);
});

function updateFileDisplay() {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3.groups(lines, (d) => d.file)
    .map(([name, rows]) => ({ name, lines: rows.sort((a, b) => a.line - b.line) }))
    .sort((a, b) => b.lines.length - a.lines.length || d3.ascending(a.name, b.name));
  const groups = d3.select('#files').selectAll('div.file-entry')
    .data(files, (d) => d.name).join((enter) => {
      const group = enter.append('div').attr('class', 'file-entry');
      const label = group.append('dt');
      label.append('code');
      label.append('small');
      group.append('dd');
      return group;
    });
  groups.select('dt code').text((d) => d.name);
  groups.select('dt small').text((d) => `${integer(d.lines.length)} retained lines`);
  groups.select('dd').attr('aria-label', (d) => `${integer(d.lines.length)} retained lines in ${d.name}`)
    .selectAll('.loc').data((d) => d.lines, (d) => d.line).join('div')
    .attr('class', 'loc').attr('aria-hidden', 'true')
    .style('--color', (d) => colors(d.type))
    .attr('title', (d) => `${languageName(d.type)} · line ${d.line} · commit ${d.commit}`);
  document.querySelector('#file-summary').textContent = `${integer(lines.length)} retained lines in ${integer(files.length)} files, from commits up to ${d3.utcFormat('%b %d, %Y %H:%M UTC')(commitMaxTime)}.`;
}

function applyCutoff(date) {
  commitMaxTime = date;
  const value = +date;
  document.querySelector('#time-slider').value = timeScale(date);
  const label = `${d3.utcFormat('%b %d, %Y %H:%M')(date)} UTC`;
  document.querySelector('#time-cutoff').textContent = label;
  document.querySelector('#time-cutoff').setAttribute('datetime', date.toISOString());
  document.querySelector('#time-slider').setAttribute('aria-valuetext', label);
  if (currentCutoff === value) return;
  currentCutoff = value;
  filteredCommits = commits.filter((d) => +d.datetime <= value);
  tooltip.hidden = true;
  clearTimeout(hideTimer);
  // A new time window invalidates a screen-space brush; never keep hidden selections.
  if (brushGroup) brushGroup.call(brush.move, null);
  brushBounds = null;
  selectedIds.clear();
  renderCommitInfo();
  renderScatterPlot();
  updateFileDisplay();
  document.querySelector('#time-progress').textContent = `${filteredCommits.length} of ${commits.length} commits · ${integer(d3.sum(filteredCommits, (d) => d.totalLines))} retained lines`;
  const latest = filteredCommits.at(-1)?.id;
  d3.selectAll('#scatter-story .step').classed('is-active', (d) => d.id === latest)
    .attr('aria-current', (d) => d.id === latest ? 'step' : null);
}

function renderStory() {
  const steps = d3.select('#scatter-story').selectAll('.step').data(commits, (d) => d.id)
    .join('article').attr('class', 'step').attr('data-commit', (d) => d.id);
  steps.append('p').attr('class', 'step-number').text((d, i) => `Commit ${i + 1} of ${commits.length}`);
  steps.append('h3').text((d) => d3.utcFormat('%B %d, %Y')(d.wallTime));
  steps.append('p').attr('class', 'step-time').text((d) => `${d.time} (UTC${d.timezone})`);
  steps.append('p').text((d) => {
    const count = d3.group(d.lines, (row) => row.file).size;
    return `The saved snapshot contains ${integer(d.totalLines)} ${d.totalLines === 1 ? 'line' : 'lines'} of code from the commit, spread over ${count} ${count === 1 ? 'file' : 'files'}.`;
  });
  steps.append('a').attr('href', (d) => d.url).attr('target', '_blank').attr('rel', 'noopener noreferrer')
    .text((d) => `View commit ${d.id.slice(0, 8)}`);
  scroller = scrollama();
  scroller.setup({ step: '#scatter-story .step', offset: innerWidth < 832 ? 0.8 : 0.55 })
    .onStepEnter(({ element }) => applyCutoff(element.__data__.datetime));
  // Scrollama observes each actual commit step; moving up reverses the same filter.
  window.addEventListener('resize', () => {
    scroller.offset(innerWidth < 832 ? 0.8 : 0.55);
    scroller.resize();
  });
}

try {
  data = await d3.csv('loc.csv', convertRow);
  commits = processCommits(data);
  if (!commits.length) throw new Error('No committed lines were found in this snapshot.');
  colors.domain([...new Set(data.map((d) => d.type))].sort());
  timeScale = d3.scaleTime().domain(d3.extent(commits, (d) => d.datetime)).range([0, 100]).clamp(true);
  const legend = d3.select('#file-legend').selectAll('li').data(colors.domain()).join('li');
  legend.append('span').attr('class', 'swatch').style('--color', (d) => colors(d)).attr('aria-hidden', 'true');
  legend.append('span').text(languageName);
  document.querySelector('#summary-section').hidden = false;
  document.querySelector('#commit-explorer').hidden = false;
  document.querySelector('#file-explorer').hidden = false;
  const dateRange = d3.extent(commits, (d) => d.wallTime).map(d3.utcFormat('%b %d, %Y'));
  document.querySelector('#data-status').textContent = `Commits represented: ${dateRange[0]} – ${dateRange[1]}. Based on the saved code snapshot.`;
  applyCutoff(commits.at(-1).datetime);
  document.querySelector('#time-slider').addEventListener('input', (event) => applyCutoff(timeScale.invert(Number(event.target.value))));
  document.querySelector('#show-all').addEventListener('click', () => applyCutoff(commits.at(-1).datetime));
  document.querySelector('#file-reset').addEventListener('click', () => applyCutoff(commits.at(-1).datetime));
  renderStory();
  let oldWidth = document.querySelector('#chart').clientWidth;
  let resizeFrame;
  new ResizeObserver(() => {
    const nextWidth = document.querySelector('#chart').clientWidth;
    if (Math.abs(nextWidth - oldWidth) < 1) return;
    oldWidth = nextWidth;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { tooltip.hidden = true; renderScatterPlot(); });
  }).observe(document.querySelector('#chart'));
} catch (error) {
  document.querySelector('#data-status').textContent = 'The code data could not be loaded. Please refresh the page or try again later.';
  console.error('Meta data:', error);
}
