---
phase: 17-theme-dark-mode
status: complete
completed_on: 2026-06-03
approved_by: owner
milestone: 2
---

# Phase 17 — Theme System & Dark Mode · SUMMARY

## Goal
Six predefined color palettes + dark mode toggle, persisted to Firestore and applied instantly via CSS custom properties. Settings screen gains a visual theme picker; the app's color scheme changes live without reload.

## Delivered

### Plan 17-01 — CSS Palette Architecture (Wave 1)
**Files:** `shop.config.js`, `shop.config.js.template`, `styles/main.css`

- Added `THEME_PALETTES` constant to `shop.config.js` and template: 6 palette objects (Orange, Emerald, Sky, Violet, Rose, Slate) each with `id`, `label`, and `primary` hex value
- Added 5 `[data-theme="..."]` CSS blocks to `main.css`, each overriding `--primary`, `--primary-hover`, `--primary-light`, and `--primary-ring`
- Added `[data-dark="true"]` CSS block overriding all semantic bg/text/border tokens for dark mode
- Added CSS classes: `.theme-swatch-grid`, `.theme-swatch`, `.theme-swatch.active` (active ring indicator), `.toggle-btn`, `.toggle-thumb` (iOS-style dark mode toggle)
- Zero-JS approach: theme changes require only HTML attribute swaps on `<html>`; all styling cascades through existing CSS custom properties

### Plan 17-02 — Runtime Theme Switching (Wave 2)
**Files:** `lib/firebase-init.js`, `modules/settings.js`, `app.js`

- `lib/firebase-init.js` — added `applyTheme(themeId, dark)` export: sets/removes `data-theme` and `data-dark` on `<html>`; IIFE applies localStorage-cached theme immediately on module load (before auth, no flash)
- `lib/firebase-init.js` — added `loadThemeFromFirestore()` export: reads `config/main` doc and calls `applyTheme()` for cross-device sync
- `app.js` — calls `loadThemeFromFirestore()` non-blocking after each successful authentication
- `modules/settings.js` — added "Appearance" card at the top of settings with:
  - 6 palette swatches with active ring reflecting `document.documentElement.dataset.theme`
  - iOS-style dark mode toggle reflecting `document.documentElement.dataset.dark`
  - Swatch click: calls `applyTheme()` + writes to Firestore `config/main` + updates localStorage
  - Toggle change: calls `applyTheme()` + writes `darkMode` to Firestore `config/main` + updates localStorage

### Plan 17-03 — Human Verification (Wave 3)
All 23 UAT checks passed by owner. Phase approved.

## UAT Results — All Passed ✅
- Settings shows 6 palette swatches with visible active ring indicator
- Tapping a palette updates the app color instantly (no reload)
- Dark mode toggle switches bg/text/surface colors across all screens
- Theme + dark mode preference survives page reload (no flash of wrong theme)
- Theme preference syncs across devices (stored in Firestore `config/main`)
- All existing screens (Billing, Inventory, Receipt, Reports, Dashboard) correct in all palettes + dark mode
- No regressions in billing, staff management, or data export

## Requirements Covered
FR-08.1, FR-08.2, FR-08.3, FR-08.4, FR-08.5, FR-08.6, NFR-15

## Files Changed
| File | Change |
|------|--------|
| `shop.config.js` | Added `THEME_PALETTES` constant (6 palettes) |
| `shop.config.js.template` | Same — kept in sync with config |
| `styles/main.css` | Added palette + dark mode CSS blocks + swatch/toggle UI CSS |
| `lib/firebase-init.js` | Added `applyTheme()`, `loadThemeFromFirestore()` exports + IIFE init |
| `modules/settings.js` | Added Appearance card with swatch grid + dark mode toggle |
| `app.js` | Added `loadThemeFromFirestore()` call in auth success branch |

## Key Design Decisions
- **Zero-JS theming** — CSS attribute selectors override custom properties; no runtime style injection
- **localStorage-first flash prevention** — theme applied before Firestore auth completes, then synced from Firestore for cross-device consistency
- **Non-breaking** — only new CSS blocks appended; no existing rules modified; all existing modules receive palette/dark mode for free through custom property inheritance
