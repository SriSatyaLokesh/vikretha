---
phase: 03-billing
plan: 01
subsystem: frontend
tags: [billing, firestore, offline, product-grid, cart, sale-recording]
dependency_graph:
  requires: [lib/firebase-init.js, shop.config.js, styles/main.css, Firestore /shops/{SHOP_ID}/inventory]
  provides: [modules/billing.js]
  affects: [app-content #/billing route, Firestore /sales, /inventory, /summary, /counters]
tech_stack:
  added: []
  patterns: [Firestore batch write, runTransaction for sequential ID, onSnapshot live listener, delegated click handlers, scaleIn animation]
key_files:
  created: [modules/billing.js]
  modified: [styles/main.css]
decisions:
  - Delegated click handlers on grid/cart containers (not per-card) — avoids rebinding on every re-render
  - runTransaction for Sale ID counter — guarantees sequential YYYYMMDD-NNNN even under concurrent writes
  - Offline fallback ID (YYYYMMDD-OFF-xxxx) lets batch.commit() queue to IndexedDB when no network
  - escapeHtml() applied to all Firestore-derived strings before innerHTML insertion (XSS prevention)
  - btn.disabled immediately on submit click — prevents double-submit race condition
metrics:
  duration: ~20min
  completed: 2026-05-31
  tasks: 2
  files: 2
---

# Phase 3 Plan 1: Billing Module Summary

**One-liner:** Full offline-capable billing screen — 2-col product grid, in-cart stepper, atomic Firestore batch with sequential Sale IDs and animated sync confirmation.

## What Was Built

### `modules/billing.js` (584 lines)

**Billing screen UI:**
- Sticky pill search bar (44px height, leading SVG icon, focus ring, `border-radius: 9999px`)
- 2-column product grid via `display:grid; grid-template-columns:1fr 1fr`
- Product cards (`min-height: 88px`, tappable, `border: 2px solid transparent`)
- In-cart state: blue border (`--theme-color`) + qty stepper overlay on same card
- Out-of-stock cards: `disabled` attribute + 0.5 opacity, "Out of stock" chip
- Stock indicator chips: green (in stock), amber (≤5), red (0)

**Cart panel:**
- Slides in when first item added (`display:none` → `block`)
- Qty stepper in cart rows + × remove button
- Discount: segmented toggle (% / ₹) + number input, both modes calculate correctly
- Optional customer phone field
- Live totals: subtotal, discount line (hidden when 0), total
- Submit button (56px): live total text `Submit Sale — ₹XX.XX`

**Data layer:**
- `_loadInventory()`: `onSnapshot` on `/shops/{SHOP_ID}/inventory`, unsubscribed on re-render
- `_generateSaleId()`: `runTransaction` → read `last_seq`, increment, return `YYYYMMDD-NNNN`
- `_generateOfflineSaleId()`: `YYYYMMDD-OFF-BASE36` fallback when transaction fails offline
- `_handleSubmit()`: `btn.disabled=true` + spinner → `writeBatch` → sale doc + N inventory decrements + summary `set({merge:true})`
- `_showConfirmation()`: animated checkmark (scaleIn 250ms), monospace bill #, `onSnapshot({includeMetadataChanges:true})` for ⏳→✓ sync badge

### `styles/main.css` additions (4 new sections)

- **Section 11** `.product-card`: 12px radius, shadow-sm, `:active` scale(0.96), `.in-cart` blue border
- **Section 12** `.qty-stepper`: pill container, 36×36px buttons, tabular-nums span
- **Section 13** `.seg-toggle`: pill container, `.active` blue fill
- **Section 14** `@keyframes scaleIn`: 0.5→1 scale + fade, `prefers-reduced-motion` variant

## Security (Threat Model Compliance)

| Threat | Mitigation Applied |
|--------|-------------------|
| T-03-01 XSS | `escapeHtml()` on `item.name`, `item.id`, `saleId` in all innerHTML |
| T-03-02 Double submit | `btn.disabled = true` immediately; `runTransaction` atomicity |
| T-03-03 Negative amounts | `Math.min(discRaw, 100)/%`, `Math.min(discRaw, subtotal)/₹`, `Math.max(0, total)` |
| T-03-04 Oversell | Out-of-stock cards disabled; accepted risk for single-operator |

## Verification

- [x] `modules/billing.js` 584 lines, exports `render(container)`
- [x] `styles/main.css` contains `.product-card`, `.qty-stepper`, `.seg-toggle`, `@keyframes scaleIn`
- [x] Pill search: 44px, 9999px radius, leading icon, focus ring
- [x] Product grid: 2-col, cards min-height 88px
- [x] In-cart: blue border + stepper overlay on same card
- [x] Discount: seg-toggle + input; both % and ₹ modes correct
- [x] Submit: 56px height, live total text, disabled+spinner on click
- [x] Confirmation: scaleIn checkmark, monospace bill #, ⏳/✓ sync badge
- [x] Firestore batch: sale + N inventory updates + summary merge
- [x] `escapeHtml()` on all Firestore strings

## Known Stubs

None — billing flow is fully wired. Inventory data comes from live Firestore snapshot.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `modules/billing.js`: FOUND (584 lines)
- `styles/main.css` sections 11-14: FOUND
- Commit `b5e13ce`: FOUND
