# 19-01 SUMMARY — SVG Area Chart + Live Today Counter

**Phase:** 19-svg-charts  
**Plan:** 01  
**Status:** ✅ Complete  
**Commit:** d352981

## What Was Built

### `lib/svg-chart.js` (new)
Pure ES module SVG area chart with zero external dependencies. Exports `drawAreaChart(container, data, options)`.

- `viewBox="0 0 320 120"` with `preserveAspectRatio="none"` — responsive via CSS `width:100%`
- Linear gradient fill (`--primary` at 28% → 2% opacity)
- Grid lines at 25%, 50%, 75% chart height using CSS `--border`
- 7 data-point dots; today's dot: `r=4.5`, `stroke=var(--bg-surface)`, `stroke-width=2`
- Native SVG `<title>` tooltips with `esc()` XSS guard
- `maxVal = Math.max(...values, 1)` prevents divide-by-zero on all-zero data

### `modules/dashboard.js` (modified)
- Added `import { drawAreaChart } from '../lib/svg-chart.js'`
- Deleted `_renderBarChart` function entirely (CSS flexbox bars gone)
- HTML template: `#dash-bar-chart` → `#dash-svg-chart` with class `svg-chart-wrap`
- `_fetchAndRenderStats`: calls `drawAreaChart` with `chartData` array built from `dayMap`
- `onSnapshot` callback: live today counter fast-path reads `snap.data().revenue` and `.count` directly — updates `dash-today-rev` and `dash-today-ct` **before** `_fetchAndRenderStats` fires

### `styles/main.css` (modified)
Appended SVG chart styles after existing bar-chart rules:
- `.svg-chart-wrap`, `.svg-chart-grid`, `.svg-chart-area`, `.svg-chart-line`
- `.svg-chart-dot`, `.svg-chart-dot--today`
- `.svg-chart-axis-label`, `.svg-chart-axis-label--today`

## Key Decisions

- `preserveAspectRatio="none"` + `width:100%; height:auto` CSS = fully responsive without JS resize listener
- Fast-path in `onSnapshot` before `_fetchAndRenderStats` ensures today's stats update in < 100ms (no 7 async reads needed)
- `escapeHtml` already existed in module; `esc()` in svg-chart.js is independent (defense in depth)

## Patterns

```javascript
// Draw chart
drawAreaChart(container.querySelector('#dash-svg-chart'), chartData, {
  currencyFormatter: v => CURRENCY + v.toLocaleString(LOCALE, { minimumFractionDigits: 2 })
});

// chartData shape
[{ label: 'Mon', value: 1234.5, isToday: false }, ...]
```
