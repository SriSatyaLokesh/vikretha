# Phase 21 — Plan 01 Summary: Branded Receipt Implementation

**Status:** ✅ Complete  
**Commit:** `ba8b395` — `feat(21): branded receipt — settings form + dynamic canvas logo/footer`

## What Was Built

### lib/firebase-init.js
- Added `export async function getShopConfig()` — reads `shops/{SHOP_ID}/config/main` from Firestore
- Returns full document data object or `{}` on error/missing
- Reuses existing `doc`, `getDoc` imports already present in the file

### modules/settings.js
- Added **Receipt Branding** card before the Sign Out card in the Settings screen HTML
- Card contains: Logo URL `<input type="url">`, Footer text `<textarea maxlength="120">`, "Save Branding" button, status paragraph
- On render: async IIFE pre-fills both fields from Firestore `config/main` if values exist
- Save button: calls `setDoc(configRef, { receiptLogoUrl, receiptFooter }, { merge: true })`
- On success: `toast.success('Receipt branding saved')`
- On error: `toast.error('Could not save branding')` + console.error

### modules/receipt.js
- Updated import: `import { db, getShopConfig } from '../lib/firebase-init.js'`
- Changed `_drawReceipt(sale)` → `_drawReceipt(sale, cfg = {})`
- Logo source: `cfgLogoUrl = cfg.receiptLogoUrl?.trim() || LOGO_URL?.trim() || ''` (Firestore first, static fallback, then none)
- Logo drawing: 2-second timeout via `setTimeout` — receipt always renders even if image is slow or 404
- Footer text: `cfg.receiptFooter?.trim() ? cfg.receiptFooter.trim().toUpperCase() : '* THANK YOU FOR SHOPPING! *'`
- `render()`: `const shopCfg = await getShopConfig()` after fetching sale, passed to `_drawReceipt(sale, shopCfg)`

### styles/main.css
- Added CSS for Receipt Branding form: `.settings-field-row`, `.settings-field-label`, `.settings-text-input`, `.settings-textarea`, `.settings-branding-save`

## Verification Checklist
- [x] `getShopConfig()` exported from `lib/firebase-init.js`
- [x] Receipt Branding card visible in Settings with Logo URL + Footer textarea + Save button
- [x] Fields pre-fill from Firestore on Settings load
- [x] Save writes `receiptLogoUrl` + `receiptFooter` to Firestore with merge
- [x] `_drawReceipt` uses `cfgLogoUrl` (not hardcoded `LOGO_URL`)
- [x] Logo load has 2s timeout — receipt never blocks on slow/broken image
- [x] Footer text is dynamic with fallback to "THANK YOU FOR SHOPPING"
- [x] `render()` fetches shop config and passes to `_drawReceipt`
- [x] All changes backward-compatible (empty config = same behavior as before)

## Key Decisions
- Logo falls back to static `LOGO_URL` from `shop.config.js` if no Firestore config — no behavior regression
- 2s timeout chosen to be generous but bounded; `clearTimeout` prevents double-resolution
- Footer uppercased at render time to match existing receipt text style
- `setDoc` with `merge: true` used (consistent with existing settings.js pattern for dark mode save)
