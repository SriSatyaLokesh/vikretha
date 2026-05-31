# Phase 05 — Plan 01 SUMMARY
## Live Summary Cards + 7-Day Bar Chart + Sync Badge

**Completed:** 2026-05-31
**Commit:** feat(05-dashboard): live stats, 7-day bar chart, sync badge, monthly report

## What Was Built

Rewrote `modules/dashboard.js` from a static placeholder to a fully Firestore-wired dashboard.

### Key changes
- **Imports added:** `collection, doc, onSnapshot, getDocs, query, where, Timestamp` from Firebase CDN; `db` from `lib/firebase-init.js`; `SHOP_ID, CURRENCY, LOCALE` from `shop.config.js`
- **Module-level state:** `_unsubSummary` cleanup handle + `escapeHtml()` utility
- **`render(container)`:** Calls `_unsubSummary?.()` on re-render, then sets full HTML with data-bound slots, then wires events + Firestore snapshot
- **`_fetchAndRenderStats(container)`:** Runs two Firestore `getDocs` queries (last 7 days + current month) and populates Today/Week/Month stat cards
- **`_renderBarChart(container, dayMap)`:** Builds 7 bar divs with proportional `height` CSS; today's bar is full opacity; all bar titles escape-safe
- **`onSnapshot` on `summary/totals`:** Fires on every new sale (billing.js writes to it); updates sync badge + refreshes stats
- **Sync badge:** Amber `⏳` when `fromCache=true`, green `✓` when server data; shows `toLocaleTimeString` of `last_updated`

### CSS added (styles/main.css)
- Section 16: `.bar-chart-bars`, `.bar-chart-col`, `.bar-chart-bar`, `.bar-chart-bar--today`, `.bar-chart-label`, `.bar-chart-label--today`
- Section 16b: `.sync-badge`, `.sync-badge--pending`, `.sync-badge--synced`

## Decisions
- `escapeHtml()` used for bar chart title attribute values
- Pre-filled 7-day `dayMap` ensures 7 bars always render even on days with 0 sales
- `includeMetadataChanges: true` on `onSnapshot` to detect cache vs server transitions

## Artifacts
- `modules/dashboard.js` — 392 lines (rewritten)
- `styles/main.css` — sections 16 + 16b appended
