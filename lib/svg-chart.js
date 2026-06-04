/**
 * lib/svg-chart.js — Pure SVG area chart (no external dependencies, no build step).
 * Phase 19: FR-10 Live SVG Dashboard Charts.
 */

const W = 320, H = 120;
const PAD = { top: 14, right: 10, bottom: 24, left: 6 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

/**
 * Draws a responsive SVG area chart into container.
 * @param {HTMLElement} container - cleared and filled with <svg>
 * @param {Array<{label: string, value: number, isToday?: boolean}>} data - 7 items
 * @param {{ currencyFormatter?: (v: number) => string }} options
 */
export function drawAreaChart(container, data, options = {}) {
  if (!container || !Array.isArray(data) || data.length === 0) return;

  const fmt = options.currencyFormatter || (v => String(v));

  // Prevent divide-by-zero when all values are 0
  const maxVal = Math.max(...data.map(d => d.value), 1);

  // XSS guard for tooltip text (defense in depth)
  const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Compute point coordinates
  const xStep = data.length > 1 ? CHART_W / (data.length - 1) : CHART_W;
  const xOf = i => PAD.left + i * xStep;
  const yOf = v => PAD.top + CHART_H - (v / maxVal) * CHART_H;
  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));

  // Build SVG path strings
  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = linePath
    + ` L${pts[pts.length - 1].x},${PAD.top + CHART_H}`
    + ` L${pts[0].x},${PAD.top + CHART_H} Z`;

  // Grid lines at 25%, 50%, 75% chart height
  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = PAD.top + CHART_H * (1 - f);
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${W - PAD.right}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  // Dots (today dot: r=4.5, stroke=2; normal dot: r=3)
  const dots = pts.map((p, i) => {
    const d = data[i];
    const r = d.isToday ? 4.5 : 3;
    const cls = d.isToday ? 'svg-chart-dot svg-chart-dot--today' : 'svg-chart-dot';
    const tooltip = `${esc(d.label)}: ${esc(fmt(d.value))}`;
    return `<circle class="${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"><title>${tooltip}</title></circle>`;
  }).join('');

  // X-axis labels
  const labels = data.map((d, i) => {
    const x = xOf(i).toFixed(1);
    const cls = d.isToday
      ? 'svg-chart-axis-label svg-chart-axis-label--today'
      : 'svg-chart-axis-label';
    return `<text class="${cls}" x="${x}" y="${H - 5}" text-anchor="middle">${esc(d.label)}</text>`;
  }).join('');

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      aria-label="7-day revenue chart" role="img">
    <defs>
      <linearGradient id="svg-chart-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.02"/>
      </linearGradient>
    </defs>
    <g class="svg-chart-grid">${gridLines}</g>
    <path class="svg-chart-area" d="${areaPath}"/>
    <path class="svg-chart-line" d="${linePath}"/>
    <g class="svg-chart-dots">${dots}</g>
    <g class="svg-chart-axis">${labels}</g>
  </svg>`;
}
