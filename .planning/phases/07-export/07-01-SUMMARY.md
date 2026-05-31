# 07-01 Summary — Export Module (modules/export.js + CSS)

## Status: Complete

## Artifacts Created

- **modules/export.js** (231+ lines) — Full client-side Excel export module
- **styles/main.css** — Section 18 appended (export button, dropdown, progress overlay)

## What Was Built

### modules/export.js
- `_loadSheetJS()` — Lazy CDN loader for SheetJS. Caches `window.XLSX` after first load. Returns a Promise that resolves with XLSX instance.
- `_showProgress(container, msg)` / `_hideProgress(container)` — Full-viewport semi-transparent overlay with spinner and message text. Created once, reused.
- `_safeStr(v)` — Formula injection prevention: prefixes strings starting with `=`, `+`, `-`, `@` with a space.
- `_exportSalesMonth(container, year, month)` — Fetches Firestore `/shops/{SHOP_ID}/sales` filtered by month range, builds 8-column .xlsx, downloads as `{SafeName}_sales_{YYYY-MM}.xlsx`.
- `_exportSalesAll(container)` — Same but no date filter, filename `{SafeName}_sales_all.xlsx`.
- `_exportInventory(container)` — Fetches inventory, sorts by name, builds 7-column .xlsx with Status ("Low Stock"/"OK"), filename `{SafeName}_inventory_{YYYY-MM-DD}.xlsx`.
- `attachExportMenu(container)` — Entry point. Injects Export button + dropdown into `#dash-export-anchor`. Handles toggle, outside-click close, and delegates item clicks to export functions.

### styles/main.css Section 18
Classes added: `.export-menu-wrap`, `.export-btn`, `.export-btn:disabled`, `.export-dropdown`, `.export-dropdown[hidden]`, `.export-dropdown-item`, `.export-progress-overlay`, `.export-progress-box`, `.export-progress-spinner`, `@keyframes spin`, `prefers-reduced-motion` override.

## Key Design Decisions
- SheetJS loaded from `cdn.sheetjs.com` via dynamic `<script>` injection (CDN per project architecture)
- `_safeStr()` applied to all Firestore string fields going into Excel cells (T-07-01 mitigated)
- `try/finally` on every async export function guarantees `_hideProgress()` always runs
- Export button disabled during export to prevent duplicate calls
- Module-level `_outsideClickHandler` ref enables proper cleanup on re-render

## Commit
`e2f6d51` — feat(07-export): create export.js and CSS Section 18 (07-01)
