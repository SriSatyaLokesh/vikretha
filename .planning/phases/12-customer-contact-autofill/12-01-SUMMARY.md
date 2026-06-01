# Phase 12 Plan 01 — Summary

## What Was Built

Customer contact book integration into the billing module.

## Artifacts Created / Modified

| File | Change |
|------|--------|
| `firestore.rules` | Added `customers` subcollection rule — `read, write: if isAuthorized(shopId)` |
| `modules/billing.js` | 6 changes: import, state, function, HTML, event listeners, submit handler |

## Key Implementation Details

**firestore.rules** — Inserted after `monthly_summary` block, before `summary` (legacy) block:
```
match /shops/{shopId}/customers/{customerId} {
  allow read, write: if isAuthorized(shopId);
}
```

**billing.js** changes:
1. Added `getDocs, setDoc` to firebase-firestore import
2. Added `let _customers = []` module state (reset on each `render()`)
3. Added `_loadCustomers()` — async getDocs from `shops/{SHOP_ID}/customers`, maps to `[{ name, phone }]`
4. Updated HTML: phone input gets `list="phone-suggestions"` + `<datalist id="phone-suggestions">`, new `#customer-name` text input below
5. After `_loadInventory()`: calls `_loadCustomers().then()` to populate datalist; adds `input` event listener on phone field for exact-match autofill
6. `_handleSubmit()`: reads `customerName` from `#customer-name`; adds `customer_name` to sale doc; after `batch.commit()` upserts `shops/{SHOP_ID}/customers/{phoneKey}` with `{ name, phone, lastSaleAt }` via `setDoc(..., { merge: true })`

## Commit

`feat(12-01): customer contact book — phone datalist + name autofill + upsert on sale`

## Decisions

- Phone key normalized (`phone.replace(/\s+/g, '')`) to ensure consistent doc IDs
- `setDoc(..., { merge: true })` used for upsert — safe for both new and returning customers
- Customer upsert is fire-and-forget (`.catch` only) — does not block sale confirmation
- `escapeHtml()` applied to all datalist option values to prevent XSS
