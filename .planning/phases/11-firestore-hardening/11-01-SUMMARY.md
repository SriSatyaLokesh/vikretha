# Phase 11 — Plan 01 Summary
## Firestore Security Hardening v2 + Date-Sharded Aggregation Writes

**Status:** COMPLETE  
**Commit:** c8d5de0

### What Was Built

**firestore.rules** — Complete rewrite with role-based access control:
- Helper functions: `isAuthenticated()`, `getConfig()`, `isAuthorized()`, `getRole()`, `isOwnerOrAdmin()`
- `config/main`: owner-only writes, bootstrap requires `staff_roles[email] == 'owner'`
- `inventory`: full CRUD for owner/admin (validated), stock-only update for cashiers
- `sales`: create-only (immutable audit trail), update/delete = false
- `counters`: read/write for any authorized user
- `daily_summary`: read/write for any authorized user
- `monthly_summary`: read/write for any authorized user
- `summary` (legacy): read/write for any authorized user (backward compat)

**modules/billing.js** — Batch extended with date-sharded aggregation:
- Added `daily_summary/{YYYY-MM-DD}` write: `{ date, count, revenue, last_updated }`
- Added `monthly_summary/{YYYY-MM}` write: `{ month, count, revenue, last_updated }`
- Both use `increment()` + `merge:true` for atomic idempotent upserts
- Legacy `summary/totals` write retained (dashboard migration in Plan 02)

**modules/auth.js** — Bootstrap creates owner role:
- `bootstrapShopConfig` now writes `staff_roles: { [user.email]: 'owner' }` in the config doc
- Required for the new security rules bootstrap rule

### Key Links
- `billing.js _handleSubmit()` → `daily_summary/{today}` via `batch.set(..., { merge: true })`
- `billing.js _handleSubmit()` → `monthly_summary/{YYYY-MM}` via `batch.set(..., { merge: true })`
- `auth.js bootstrapShopConfig()` → `config/main.staff_roles.{email} = 'owner'` via `setDoc`

### Document Shapes

Daily summary doc `/shops/{SHOP_ID}/daily_summary/{YYYY-MM-DD}`:
```js
{ date: "2026-06-01", count: 5, revenue: 1250.00, last_updated: Timestamp }
```

Monthly summary doc `/shops/{SHOP_ID}/monthly_summary/{YYYY-MM}`:
```js
{ month: "2026-06", count: 42, revenue: 15800.50, last_updated: Timestamp }
```
