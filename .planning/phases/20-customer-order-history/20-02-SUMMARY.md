# Phase 20 Plan 02 — SUMMARY

**Status:** Complete  
**Phase:** 20-customer-order-history  
**Plan:** 02 — Receipt customer history link

## What was built

Added a **conditional "Customer history →" link** to the receipt screen (`modules/receipt.js`).

### Files modified

- **`modules/receipt.js`**:
  - In the `container.innerHTML` template, inside `.receipt-actions`, between the WhatsApp button and the Back to Dashboard link:
    - Added `${sale.customer_phone ? \`<a id="btn-cust-history" ...>👤 Customer history →</a>\` : ''}` — only rendered when the sale has a `customer_phone`
  - After `document.getElementById('receipt-img').src = dataUrl;`:
    - Added conditional click handler: if `sale.customer_phone` exists, binds a click listener to `#btn-cust-history` that navigates to `#/reports/customers/{encodeURIComponent(sale.customer_phone)}`

## Decisions made

- Link is only shown when `sale.customer_phone` is truthy — no UI clutter for anonymous sales
- Navigation uses `window.location.hash` (same pattern as other navigation in the app)
- Back to Dashboard arrow changed from `←` to `&#x2190;` entity for consistency with template literals

## Deep-link flow

Receipt page → click "Customer history →" → `#/reports/customers/+919876543210` → `app.js` router extracts `routeParam = 'customers/+919876543210'` → `reports.js` `render()` switches to Customers tab, pre-fills phone input, loads customer data automatically
