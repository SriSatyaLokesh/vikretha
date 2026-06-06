# Phase 26 Plan 03 Summary — Export Filtered Results

**Status:** COMPLETE (pending UAT approval)  
**Commit:** 343d9bf

## What Was Built

### _loadSheetJSLocal()

Lazy-loads SheetJS from CDN (same `xlsx-0.20.3` as `export.js`) into `_rptXLSX` cache.  
Reuses cached instance on subsequent calls.

### _exportFiltered(btn)

Exports currently filtered `_filtered` array to Excel:

| Column | Source |
|--------|--------|
| Sale ID | `saleId \| sale_id \| docSnap.id` |
| Date | `timestamp.toDate().toLocaleDateString(LOCALE)` |
| Customer | `customer_name` |
| Phone | `customer_phone` |
| Items | `name×quantity` joined by `; ` |
| Qty | sum of all item quantities |
| Subtotal | `subtotal` |
| Discount | `discount` |
| Total | `total` |
| Payment Mode | `payment_mode` |
| Cash | `payment_split.cash` or total if mode=cash |
| UPI | `payment_split.upi` or total if mode=upi |
| Card | `payment_split.card` or total if mode=card |

- Shows `toast.warn` if `_filtered` is empty  
- Shows `toast.success` with count on success  
- Shows `toast.error` on failure  
- `#rpt-export-filtered-btn` only visible when filters are active (`_updateFilterBadge` controls display)

## Import Added

`import { toast } from '../lib/toast.js';` — line 13 of reports.js

## Files Modified

- `modules/reports.js`
