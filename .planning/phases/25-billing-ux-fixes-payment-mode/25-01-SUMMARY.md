# Phase 25 — Plan 01 Summary

**Phase:** 25-billing-ux-fixes-payment-mode  
**Plan:** 01  
**Status:** Complete  
**Commit:** 32a9bcb

## What Was Built

Fixes for three UAT bugs across auth and receipt modules.

### Task 1 — Login shop name (modules/auth.js)

- `showSignInStep()` subtitle now reads `loginCfg.shopName || SHOP_NAME` instead of hardcoded `SHOP_NAME`
- `loginCfg` is already fetched from `config/main` at render time; change is a one-line update to line 71

### Task 2 — Receipt fixes (modules/receipt.js)

**a. Black canvas** — Palette constants changed from muted grey to true black:
- `INK = '#000000'`, `MUTED = '#333333'`, `FAINT = '#888888'`, `SAVE = '#000000'`, `SEP_CLR = '#000000'`

**b. Footer text bug** — Line ~322 was referencing the module import `RECEIPT_FOOTER` instead of the local loaded value `_footer`. Fixed to `_footer?.trim() ? _footer.trim().toUpperCase() : ''`

**c. WhatsApp customer routing** — Handler restructured:
1. If `sale.customer_phone` present → direct `wa.me/{phone}?text=...` link, return (no Web Share API)
2. If no customer phone → try Web Share API (system sheet for shopkeeper to choose recipient)
3. Final fallback → shop `WHATSAPP_NUMBER` or generic `wa.me`

## Key Decision

Web Share API was bypassed for the customer-phone case because on mobile it opens a generic system sheet before any phone-specific routing — losing the direct-to-customer behavior.

## Files Modified

- `modules/auth.js` — subtitle fix
- `modules/receipt.js` — palette, footer bug, WhatsApp routing
