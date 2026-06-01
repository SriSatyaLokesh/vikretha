# Phase 11 — Plan 02 Summary
## Dashboard Migration to Date-Sharded Reads + Legacy Removal + Backfill Script

**Status:** COMPLETE  
**Commit:** 64cc783

### What Was Built

**modules/dashboard.js** — Optimized to read 8 docs instead of scanning hundreds:
- Import: added `getDoc` to Firebase imports
- `_fetchAndRenderStats()`: completely rewritten
  - 7 parallel `getDoc(daily_summary/{YYYY-MM-DD})` calls via `Promise.all()`
  - 1 `getDoc(monthly_summary/{YYYY-MM})` call
  - Computes today/week from daily docs, month from monthly doc
  - `_showMonthlyReport()` unchanged — still uses sales collection for per-item breakdown
- `onSnapshot` listener: migrated from `summary/totals` to `daily_summary/{today}`
  - Real-time refresh when today's daily summary doc changes
  - Sync badge updates show last_updated timestamp from daily_summary

**modules/billing.js** — Legacy summary/totals write removed:
- Removed `const summaryRef = doc(db, 'shops', SHOP_ID, 'summary', 'totals')` declaration
- Removed `batch.set(summaryRef, { today_count, week_count, month_count, ... })` block
- Batch now: sale + inventory decrements + daily_summary + monthly_summary

**scripts/backfill-summaries.js** — Browser console migration script:
- Reads all `sales` docs
- Aggregates into `{ [YYYY-MM-DD]: { count, revenue } }` and `{ [YYYY-MM]: { count, revenue } }`
- Writes `daily_summary` and `monthly_summary` docs using `setDoc` (full overwrite, safe to re-run)
- Run by pasting in DevTools console while logged in as owner

### Performance Impact
- Before: dashboard read 100-500+ sale docs per load (scales with sales history)
- After: dashboard reads exactly 8 docs per load (7 daily + 1 monthly), constant time
