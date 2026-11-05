import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
  });
}

function renderCommitInfo() {
  const stats = [
    ['Retained lines', integer(data.length)],
    ['Commits represented', integer(commits.length)],
    ['Files', integer(d3.group(data, (d) => d.file).size)],
    ['Languages', integer(d3.group(data, (d) => d.type).size)],
    ['Avg. line length', `${d3.format('.1f')(d3.mean(data, (d) => d.length))} chars`],
    ['Max. indent depth', integer(d3.max(data, (d) => d.depth))],
  ];
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  const groups = dl.selectAll('div').data(stats).join('div');
  groups.append('dt').text((d) => d[0]);
  groups.append('dd').text((d) => d[1]);
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
  const selected = commits.filter((d) => selectedIds.has(d.id));
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
  selectedIds = new Set(commits.filter((d) => isCommitSelected(brushBounds, d)).map((d) => d.id));
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
  const width = Math.max(560, container.clientWidth);
  const height = 370;
  const margin = { top: 26, right: 30, bottom: 48, left: 59 };
  const bounds = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  const oldDataBounds = brushBounds && xScale && yScale ? [
    [xScale.invert(brushBounds[0][0]), yScale.invert(brushBounds[0][1])],
    [xScale.invert(brushBounds[1][0]), yScale.invert(brushBounds[1][1])],
  ] : null;
  const extent = d3.extent(commits, (d) => d.wallTime);
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
  svg.selectAll('*').remove();
  const hours = d3.range(0, 25, 4);
  svg.append('g').attr('class', 'gridlines').attr('transform', `translate(${bounds.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(hours).tickFormat('').tickSize(-(bounds.right - bounds.left)));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${bounds.bottom})`)
    .call(d3.axisBottom(xScale).ticks(Math.max(3, Math.floor(width / 120))).tickFormat(d3.utcFormat('%b %d')));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${bounds.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(hours).tickFormat((d) => `${String(d).padStart(2, '0')}:00`));
  svg.append('text').attr('class', 'axis-label').attr('x', bounds.left).attr('y', 13).text('Time of day');
  svg.append('text').attr('class', 'axis-label').attr('x', (bounds.left + bounds.right) / 2)
    .attr('y', height - 7).attr('text-anchor', 'middle').text(`Commit date · ${d3.utcFormat('%Y')(extent[0])}`);
  // The brush is painted first; dots remain on top and can still receive hover.
  brushGroup = svg.append('g').attr('class', 'brush');
  brush = d3.brush().extent([[bounds.left, bounds.top], [bounds.right, bounds.bottom]])
    .on('start brush end', brushed);
  brushGroup.call(brush);
  const marks = svg.append('g').attr('class', 'dots').selectAll('g.commit-mark')
    .data(d3.sort(commits, (d) => -d.totalLines), (d) => d.id).join('g')
    .attr('class', 'commit-mark').attr('tabindex', 0).attr('role', 'button')
    .attr('aria-label', (d) => `Commit ${d.id.slice(0, 8)}, ${d.originalDate} at ${d.time}, ${integer(d.totalLines)} retained lines. Enter for the commit link.`)
    .attr('transform', (d) => `translate(${xScale(d.wallTime)},${yScale(d.hourFrac)})`)
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
  marks.append('circle').attr('class', 'hit-target').attr('r', (d) => Math.max(6, rScale(d.totalLines)))
    .attr('fill', 'transparent').attr('aria-hidden', 'true');
  marks.append('circle').attr('class', 'commit-dot').attr('r', (d) => rScale(d.totalLines)).attr('aria-hidden', 'true');
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

try {
  data = await d3.csv('loc.csv', convertRow);
  commits = processCommits(data);
  if (!commits.length) throw new Error('No committed lines were found in this snapshot.');
  renderCommitInfo();
  document.querySelector('#summary-section').hidden = false;
  document.querySelector('#commit-explorer').hidden = false;
  const dateRange = d3.extent(commits, (d) => d.wallTime).map(d3.utcFormat('%b %d, %Y'));
  document.querySelector('#data-status').textContent = `Commits represented: ${dateRange[0]} – ${dateRange[1]}. Based on the saved code snapshot.`;
  renderScatterPlot();
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
