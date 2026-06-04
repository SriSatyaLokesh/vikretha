/**
 * lib/svg-chart.js -- Pure SVG area chart with interactive hover tooltip.
 * No external dependencies, no build step.
 * Phase 19: FR-10 Live SVG Dashboard Charts.
 */

const W = 320, H = 120;
const PAD = { top: 14, right: 10, bottom: 24, left: 6 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Draws a responsive SVG area chart with hover tooltips into container.
 * @param {HTMLElement} container
 * @param {Array<{label: string, value: number, count?: number, isToday?: boolean}>} data
 * @param {{ currencyFormatter?: (v: number) => string }} options
 */
export function drawAreaChart(container, data, options = {}) {
  if (!container || !Array.isArray(data) || data.length === 0) return;

  const fmt = options.currencyFormatter || (v => String(v));
  const maxVal = Math.max(...data.map(d => d.value), 1);

  const xStep = data.length > 1 ? CHART_W / (data.length - 1) : CHART_W;
  const xOf = i => PAD.left + i * xStep;
  const yOf = v => PAD.top + CHART_H - (v / maxVal) * CHART_H;
  const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(d.value) }));

  const linePath = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = linePath
    + ` L${pts[pts.length - 1].x},${PAD.top + CHART_H}`
    + ` L${pts[0].x},${PAD.top + CHART_H} Z`;

  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = PAD.top + CHART_H * (1 - f);
    return `<line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${W - PAD.right}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  const dots = pts.map((p, i) => {
    const d = data[i];
    const r = d.isToday ? 4.5 : 3.5;
    const cls = d.isToday ? 'svg-chart-dot svg-chart-dot--today' : 'svg-chart-dot';
    return `<circle class="${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" data-idx="${i}"/>`;
  }).join('');

  // Large invisible hit targets (~44pt equivalent in SVG units) for hover/touch
  const hits = pts.map((p, i) => {
    const d = data[i];
    const ariaLabel = `${esc(d.label)}${d.isToday ? ' (Today)' : ''}: ${esc(fmt(d.value))}`;
    return `<circle class="svg-chart-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="16"` +
      ` fill="transparent" tabindex="0" role="img" aria-label="${ariaLabel}" data-idx="${i}"/>`;
  }).join('');

  const labels = data.map((d, i) => {
    const x = xOf(i).toFixed(1);
    const cls = d.isToday
      ? 'svg-chart-axis-label svg-chart-axis-label--today'
      : 'svg-chart-axis-label';
    return `<text class="${cls}" x="${x}" y="${H - 5}" text-anchor="middle">${esc(d.label)}</text>`;
  }).join('');

  // Crosshair vertical line (hidden initially via CSS)
  const crosshair = `<line class="svg-chart-crosshair"` +
    ` x1="0" y1="${PAD.top}" x2="0" y2="${(PAD.top + CHART_H).toFixed(1)}"/>`;

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-label="7-day revenue chart" role="img">
    <defs>
      <linearGradient id="svg-chart-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="var(--primary)" stop-opacity="0.03"/>
      </linearGradient>
    </defs>
    <g class="svg-chart-grid">${gridLines}</g>
    ${crosshair}
    <path class="svg-chart-area" d="${areaPath}"/>
    <path class="svg-chart-line" d="${linePath}"/>
    <g class="svg-chart-dots">${dots}</g>
    <g class="svg-chart-hits">${hits}</g>
    <g class="svg-chart-axis">${labels}</g>
  </svg>`;

  container.style.position = 'relative';

  const svg = container.querySelector('svg');
  const crosshairEl = svg.querySelector('.svg-chart-crosshair');

  // Create fresh tooltip div (container.innerHTML clears any previous one)
  const tooltip = document.createElement('div');
  tooltip.className = 'svg-chart-tooltip';
  tooltip.setAttribute('aria-hidden', 'true');
  container.appendChild(tooltip);

  function positionTooltip(p) {
    const svgRect = svg.getBoundingClientRect();
    const cRect   = container.getBoundingClientRect();
    const scale   = svgRect.width / W;

    const dotX = (svgRect.left - cRect.left) + p.x * scale;
    const dotY = (svgRect.top  - cRect.top)  + p.y * scale;

    const tipW = tooltip.offsetWidth  || 100;
    const tipH = tooltip.offsetHeight || 56;

    let left = dotX - tipW / 2;
    left = Math.max(4, Math.min(left, container.clientWidth - tipW - 4));

    let top = dotY - tipH - 10;
    if (top < 4) top = dotY + (16 * scale) + 4;

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top  = `${Math.round(top)}px`;
  }

  function showAt(idx) {
    const d = data[idx];
    const p = pts[idx];

    // Move and show crosshair
    crosshairEl.setAttribute('x1', p.x.toFixed(1));
    crosshairEl.setAttribute('x2', p.x.toFixed(1));
    crosshairEl.classList.add('is-visible');

    // Scale up the hovered dot
    svg.querySelectorAll('.svg-chart-dot').forEach((el, i) => {
      el.classList.toggle('is-hovered', i === idx);
    });

    // Tooltip content
    const countHtml = d.count !== undefined
      ? `<span class="svg-chart-tooltip-count">${d.count} sale${d.count !== 1 ? 's' : ''}</span>`
      : '';
    tooltip.innerHTML =
      `<span class="svg-chart-tooltip-label">${esc(d.label)}${d.isToday ? ' \u00B7 Today' : ''}</span>` +
      `<span class="svg-chart-tooltip-value">${esc(fmt(d.value))}</span>` +
      countHtml;

    // Position after content is painted, then fade in
    requestAnimationFrame(() => {
      positionTooltip(p);
      tooltip.classList.add('is-visible');
    });
  }

  function hide() {
    tooltip.classList.remove('is-visible');
    crosshairEl.classList.remove('is-visible');
    svg.querySelectorAll('.svg-chart-dot').forEach(el => el.classList.remove('is-hovered'));
  }

  // Mouse hover -- per dot
  svg.querySelectorAll('.svg-chart-hit').forEach(hitEl => {
    const idx = parseInt(hitEl.dataset.idx, 10);
    hitEl.addEventListener('mouseenter', () => showAt(idx));
    hitEl.addEventListener('focus',      () => showAt(idx));
    hitEl.addEventListener('mouseleave', hide);
    hitEl.addEventListener('blur',       hide);
  });
  svg.addEventListener('mouseleave', hide);

  // Touch -- show nearest data point to touch X position
  svg.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch   = e.touches[0];
    const svgRect = svg.getBoundingClientRect();
    const scale   = svgRect.width / W;
    const touchX  = (touch.clientX - svgRect.left) / scale;

    let nearest = 0, minDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - touchX);
      if (dist < minDist) { minDist = dist; nearest = i; }
    });
    showAt(nearest);
  }, { passive: false });

  svg.addEventListener('touchend', () => setTimeout(hide, 1800));
}
