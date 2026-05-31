---
phase: 09-docs
plan: 02
subsystem: demo-data, accessibility
tags: [seed-script, a11y, aria-labels, touch-targets, focus-visible]
dependency_graph:
  requires: []
  provides: [scripts/seed-demo.js, a11y-fixes]
  affects: [demo-site, screen-reader-support, touch-usability]
tech_stack:
  added: []
  patterns: [firebase-rest-api, progressive-enhancement, wcag-aa]
key_files:
  created: [scripts/seed-demo.js]
  modified: [modules/inventory.js, modules/settings.js, styles/main.css]
decisions:
  - "Deterministic sale templates (5 templates, % rotation) avoids random data inconsistency"
  - "CSS Section 20 appended at end of main.css for easy location and review"
  - "Surgical aria-label additions only — no structural changes to modules"
metrics:
  duration: "20 min"
  completed: "2026-05-31"
---

# Phase 9 Plan 02: Seed Script + Accessibility Summary

**One-liner:** Node.js demo seed script (12 inventory items + 30 days of sales via Firebase REST) and WCAG 2.1 AA accessibility fixes across all modules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/seed-demo.js | b362ee0 | scripts/seed-demo.js (248 lines) |
| 2 | Accessibility audit + fixes | b362ee0 | modules/inventory.js, modules/settings.js, styles/main.css |

## Accessibility Changes Made

### ARIA Labels Added
- `modules/inventory.js` — `aria-label="Search inventory items"` on search input
- `modules/inventory.js` — `aria-label="Close"` on modal close button (×)
- `modules/settings.js` — `aria-label="Staff email address"` on add-email input
- `modules/settings.js` — `aria-label="Staff role"` on add-role select

### CSS (Section 20)
- Touch target minimum: `button, a, [role="button"], select { min-height: 44px }`
- Exception for inline text links: `p a, li a, td a { min-height: unset }`
- `.btn-icon` class: `min-width: 44px; min-height: 44px` with flexbox centering
- `:focus-visible` rule for keyboard navigation focus ring

### Pre-existing (no changes needed)
- `billing.js` — aria-labels already present on all item buttons (increase/decrease/remove)
- `dashboard.js` — aria-label on new sale FAB and month picker select
- `export.js` — export button has visible "Export" text + aria-haspopup/aria-expanded
- `receipt.js` — buttons have visible text labels ("↓ Download Receipt", "Share via WhatsApp")

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] scripts/seed-demo.js exists (248 lines, > 80 required)
- [x] Uses REST API pattern (identitytoolkit.googleapis.com + firestore.googleapis.com)
- [x] No npm install required (uses built-in fetch, Node 18+)
- [x] Seeds 12 inventory items, 30 days of sales, updates summary/main
- [x] 12 aria-label occurrences across modules (> 5 required)
- [x] Section 20 added to main.css
- [x] :focus-visible rule present
- [x] min-height: 44px touch target rule present

## Known Stubs

None.
