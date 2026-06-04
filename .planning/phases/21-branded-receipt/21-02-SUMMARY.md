# Phase 21 — Plan 02 Summary: Static Config Branding + Dancing Script Wordmark

**Status:** ✅ Complete  
**Commit:** `4667ec3` — `feat(21): move branding to shop.config.js + Dancing Script wordmark on nav and receipt`  
**Also:** `be988c7` — `feat: add gold/black/white theme palette`

## Pivot Summary

**Original Phase 21 Wave 1** (commit `ba8b395`) built Firestore-based branding with Settings UI.

**This pivot** (Plan 02) moves branding to static `shop.config.js` configuration, simplifying deployment and avoiding Firestore writes for read-only config. Future phases can add an admin screen for UI-based customization.

## What Was Built

### shop.config.js
- Added `RECEIPT_FOOTER = ""` — custom footer text on receipts; empty = default "THANK YOU FOR SHOPPING!"
- Updated `LOGO_URL` comment to mention wordmark fallback
- Added `THEME_COLOR` export (was already defined, now used in receipt.js)

### index.html
- Added **Dancing Script** font (Google Fonts, weight 700) to fonts link:  
  `family=Inter:wght@400;500;600;700;800&family=Dancing+Script:wght@700`
- CSP already allows fonts.googleapis.com and fonts.gstatic.com

### modules/settings.js
- **Removed** Receipt Branding card (Logo URL input, Footer textarea, Save button)
- **Removed** async IIFE that pre-filled fields from Firestore
- **Removed** save button listener and toast notifications
- Staff Management + Dark Mode toggle remain intact

### modules/receipt.js
- **Updated imports:** Added `THEME_COLOR` to shop.config.js destructure
- **Updated `_drawReceipt` signature:** Removed `cfg` parameter; reads directly from shop.config
- **Unconditional bodyH:** Changed `if (hasLogo) bodyH += 68` → `bodyH += 68` (space always reserved for logo or wordmark)
- **Logo block with wordmark else-branch:**
  ```javascript
  if (hasLogo) {
    // Load image from LOGO_URL with 2s timeout
  } else {
    // No logo — draw shop name in Dancing Script
    await document.fonts.ready;
    ctx.font = "700 30px 'Dancing Script', cursive";
    ctx.fillStyle = THEME_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText(SHOP_NAME, WIDTH / 2, y + 44);
  }
  y += 68;
  ```
- **Footer text:** Uses `RECEIPT_FOOTER?.trim()` from config (not Firestore cfg)
- **render() cleanup:** Removed `getShopConfig()` call and `shopCfg` parameter to `_drawReceipt()`

### app.js
- **Updated import:** Added `LOGO_URL` from shop.config.js
- **Conditional sidebar brand:**
  ```javascript
  ${LOGO_URL?.trim()
    ? `<img src="${LOGO_URL}" class="sidebar-brand-logo" alt="${SHOP_NAME}"><span class="sidebar-brand-name">${SHOP_NAME}</span>`
    : `<span class="sidebar-brand-wordmark">${SHOP_NAME}</span>`}
  ```
  - With logo: shows image + shop name text
  - No logo: shows shop name in Dancing Script (replaces both icon and name)

### styles/main.css
- Added `.sidebar-brand-logo`: 34×34px, contains image, object-fit: contain
- Added `.sidebar-brand-wordmark`: Dancing Script font, 1.5rem, centered, white
- Appended Phase 21 comment for future reference

### shop.config.js (Theme Update)
- Added `gold` theme to `THEME_PALETTES`:  
  ```javascript
  { id: 'gold', label: 'Gold', primary: '#d4af37' }
  ```

### styles/main.css (Theme Update)
- Added gold theme CSS block:
  ```css
  [data-theme="gold"] {
    --primary:       #d4af37;
    --primary-hover: #c19a2b;
    --primary-light: #fffacd;
    --primary-ring:  rgba(212,175,55,0.25);
  }
  ```

## Configuration Usage

**To set a logo:**
```javascript
export const LOGO_URL = "https://example.com/logo.png";
```
→ Sidebar shows logo + name; Receipt shows logo at top

**To remove logo (default):**
```javascript
export const LOGO_URL = "";
```
→ Sidebar shows shop name in Dancing Script; Receipt shows shop name in Dancing Script + theme color

**To set custom receipt footer:**
```javascript
export const RECEIPT_FOOTER = "Thank you for your business!";
```
→ Receipt footer: `THANK YOU FOR YOUR BUSINESS!` (uppercased at render)

**Default footer (empty):**
```javascript
export const RECEIPT_FOOTER = "";
```
→ Receipt footer: `* THANK YOU FOR SHOPPING! *`

## Verification Checklist
- [x] LOGO_URL in shop.config.js comment mentions wordmark fallback
- [x] RECEIPT_FOOTER in shop.config.js with default empty
- [x] Dancing Script font loaded in index.html (Google Fonts)
- [x] Settings Receipt Branding card removed
- [x] receipt.js logo block draws wordmark with THEME_COLOR when no LOGO_URL
- [x] receipt.js footer uses RECEIPT_FOOTER from config
- [x] app.js sidebar brand conditional: logo + name OR wordmark
- [x] CSS classes for logo image and wordmark styling added
- [x] All Firestore branding config code removed from receipt.js and render()
- [x] Gold theme palette added to config and CSS
- [x] Wordmark displays in Dancing Script on both sidebar and receipt

## Why This Pivot

1. **Simpler deployment:** Shop.config.js is deployed once; no Firestore writes needed for branding
2. **Faster receipt generation:** No async Firestore call before drawing
3. **Future extensibility:** Phase 22+ can add admin UI to edit shop.config.js via Settings
4. **Consistent theming:** Wordmark uses THEME_COLOR (respects user's palette choice)
5. **Better UX:** Shop name as styled wordmark is more professional than placeholder box

## Key Decisions
- Wordmark draws at `y + 44` to center vertically in reserved 68px space
- Font size 30px selected to fit shop names up to ~20 chars without wrapping
- Dancing Script 700 weight for bold, professional appearance
- Wordmark width not constrained — relies on shop name being reasonable length (shop.config.js not UI-editable yet)
- Logo uses existing 56×56px dimension; wordmark uses same 68px total height for consistency

## Future Work (Phase 22+)
- Admin settings screen to edit LOGO_URL and RECEIPT_FOOTER directly in app
- Image upload for logo (instead of URL)
- Receipt footer rich text editing
