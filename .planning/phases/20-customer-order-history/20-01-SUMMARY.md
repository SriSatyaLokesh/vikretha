# Phase 20 Plan 01 — SUMMARY

**Status:** Complete  
**Phase:** 20-customer-order-history  
**Plan:** 01 — Customers tab in Reports

## What was built

Added a **Customers tab** to the Reports screen (`modules/reports.js`), alongside the existing Sales tab.

### Files modified

- **`modules/reports.js`** — complete rewrite adding:
  - New Firebase imports: `getAggregateFromServer`, `count`, `sum`
  - New module-level state: `_activeTab`, `_custPhone`, `_custBills`, `_custLastDoc`, `_custLoading`, `_custSearchTimer`
  - `_switchTab(tab, container)` — toggles visibility of sales/customers panes and tab styles
  - `_loadCustomerSearch(rawPhone, container)` — Firestore lookup in `shops/{SHOP_ID}/customers/{phone}` + aggregate query for total spend and bill count
  - `_renderCustomerPanel(cust, stats, resultEl)` — renders customer card with name, phone, stats (total spend, bill count, last sale date)
  - `_loadCustomerBills(phone, reset, resultEl)` — paginated query of `sales` by `customer_phone`, 25 per page, with Load More
  - `_openCustBillDetail(docId)` — reuses existing overlay/panel to open a specific bill from customer history
  - `render()` signature: `render(container, routeParam = null)` — handles `routeParam = 'customers/{phone}'` to deep-link to customer history
  - Tab bar HTML in template (Sales / Customers tabs)
  - Customer pane HTML (`#rpt-customers-pane`) with phone input and result container
  - Tab click bindings + debounced phone input search (300ms)

- **`styles/main.css`** — appended CSS for:
  - `.rpt-tabs`, `.rpt-tab`, `.rpt-tab--active` — tab bar
  - `.rpt-customers-pane` — pane layout
  - `.rpt-cust-search-wrap`, `.rpt-cust-phone-input` — phone search input
  - `.rpt-cust-loading`, `.rpt-cust-empty`, `.rpt-cust-error` — state classes
  - `.rpt-cust-card`, `.rpt-cust-card-header`, `.rpt-cust-avatar`, `.rpt-cust-name`, `.rpt-cust-phone-display` — customer card
  - `.rpt-cust-stats`, `.rpt-cust-stat`, `.rpt-cust-stat-label` — stats grid
  - `.rpt-cust-bills-header`, `.rpt-cust-bills-list`, `.rpt-cust-bill-row` — bills list
  - `.rpt-cust-bill-date`, `.rpt-cust-bill-id`, `.rpt-cust-bill-total` — bill row columns
  - `#rpt-cust-bills-pagination` — load-more button container

## Decisions made

- Phone is used as the Firestore document ID in the `customers` collection (normalized, no spaces)
- Aggregate stats use `getAggregateFromServer` (single RPC, not client-side sum)
- Bills list uses delegated event listeners (set once on reset, not per-row)
- Deep-link route pattern: `#/reports/customers/{encodedPhone}` via existing `routeParam` mechanism in `app.js`

## Patterns established

- `_switchTab` visibility toggle: hide sales pane + filter bar, show customers pane
- Customer search is read-triggered (input debounce), not button-triggered
