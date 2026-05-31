---
phase: 04-receipt
plan: 01
subsystem: receipt
tags: [router, canvas, pwa, whatsapp, firebase]
dependency_graph:
  requires: [03-billing, 01-foundation]
  provides: [receipt-page, receipt-download, whatsapp-share]
  affects: [app.js, modules/receipt.js, styles/main.css]
tech_stack:
  added: [Canvas 2D API, Web Share API, canvas.toBlob]
  patterns: [hash-router sub-routes, dynamic canvas height, wa.me fallback]
key_files:
  created: [modules/receipt.js]
  modified: [app.js, styles/main.css]
decisions:
  - Canvas 2D used for receipt image (no external library)
  - AbortError caught separately to prevent wa.me fallback on user cancel
  - Dynamic canvas height calculated per item count before drawing
metrics:
  duration_minutes: 12
  completed: "2026-05-31"
  tasks_completed: 2
  files_changed: 3
---

# Phase 4 Plan 01: Receipt Router + Canvas Module Summary

**One-liner:** Hash router updated for sub-routes; Canvas 2D receipt with PNG download and WhatsApp Web Share API + wa.me fallback.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix app.js router for parameterised sub-routes | b033227 | app.js |
| 2 | Create modules/receipt.js — Canvas receipt, download, WhatsApp share | 6e7a40c | modules/receipt.js, styles/main.css |

## What Was Built

### Task 1 — Router (app.js)
- Replaced single-segment `route` extraction with `routeParts/route/routeParam` parsing
- `#/receipt/20260531-0001` now routes to `modules/receipt.js` with `routeParam = "20260531-0001"`
- Added `'receipt'` to `PROTECTED_ROUTES` (requires auth)
- Added `receipt: 'Receipt'` to page titles map
- `module.render(content, routeParam)` — backward-compatible (existing modules ignore extra args)

### Task 2 — Receipt Module (modules/receipt.js)
- `render(container, saleId)` — async entry point
- Loading spinner → Firestore fetch → not-found guard → Canvas draw → wire buttons
- `_drawReceipt(sale)` — dynamic height calculation, Canvas 2D drawing:
  - Header: optional logo (48×48), shop name, date (toLocaleString), Bill # in brand color
  - Items: alternating row backgrounds, truncated names, right-aligned qty/price/total
  - Totals: subtotal, conditional discount row in red, thick rule, grand total bold
  - Footer: thank-you text, optional customer phone
- Download: `canvas.toBlob()` → `URL.createObjectURL` → anchor `.click()`
- WhatsApp: `navigator.canShare({ files })` → `navigator.share` with PNG; `AbortError` caught (no fallback on cancel); wa.me deep link fallback
- Receipt page max-width 440px; canvas width 400px → fits 375px viewport

### CSS (styles/main.css — Section 15)
- `.receipt-page`: flex column, 16px gap, max-width 440px centered
- `.receipt-preview`: secondary bg, 12px border-radius, centered image
- `.receipt-actions`: flex column, 10px gap

## Deviations from Plan

None — plan executed exactly as written.

## Security Notes

- No `innerHTML` with Firestore-derived data — all user/sale data rendered via `ctx.fillText()` (Canvas API, XSS-safe)
- WhatsApp phone number stripped to digits only (`replace(/\D/g, '')`) before inclusion in wa.me URL
- External link uses `noopener,noreferrer`
- `saleId` in anchor download attribute — not injected into DOM innerHTML

## Known Stubs

None — all data sourced from Firestore sale document.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `modules/receipt.js` exists
- [x] `export async function render` at line 201
- [x] Task 1 commit `b033227` confirmed in git log
- [x] Task 2 commit `6e7a40c` confirmed in git log
- [x] `.receipt-actions` in styles/main.css
- [x] No `innerHTML` with Firestore item/sale data
