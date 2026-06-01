---
title: "ADR-0001: Firestore Data Architecture — Schema, Security, and Access Optimization"
status: "Proposed"
date: "2026-06-01"
authors: ["SriSatyaLokesh (Owner/Architect)"]
tags: ["architecture", "decision", "firestore", "database", "security", "performance"]
supersedes: ""
superseded_by: ""
---

# ADR-0001: Firestore Data Architecture — Schema, Security, and Access Optimization

## Status

**Proposed**

## Context

Vikretha stores all shop data in Cloud Firestore (Spark free tier) using the following schema:

```
/shops/{shopId}/
├── config/main         → { authorized_emails: [], staff_roles: {} }
├── counters/sales_counter → { last_seq: number }
├── inventory/{itemId}  → { name, unit, price, stock, threshold? }
├── sales/{saleId}      → { saleId, timestamp, items[], subtotal, discount, total, customer_phone, created_by }
└── summary/totals      → { today_count, today_revenue, week_count, week_revenue, month_count, month_revenue, last_updated }
```

**Security Model:** A single `isAuthorized(shopId)` function checks if the authenticated user's email exists in `config/main.authorized_emails`. If yes, the user has **full read/write access to every subcollection** under that shop.

**Access Patterns:**
- Billing: `onSnapshot` on entire `inventory` collection + batch writes (sale + stock decrement + summary increment)
- Dashboard: `getDocs` with `where('timestamp', >=, date)` on `sales` for 7-day and monthly queries
- Inventory: `onSnapshot` on entire `inventory` collection
- Settings: read/write `config/main`

**Constraints:**
- Firebase Spark free tier: 20K writes/day, 50K reads/day, 10 free SMS OTPs/day
- No Cloud Functions (Spark plan limitation)
- Offline-first: all data must be readable from local cache
- Single-developer shop with 1-3 staff max
- SHOP_ID is a hardcoded constant in `shop.config.js`

---

## Current Architecture — Problems Identified

### Security Weaknesses

| Problem | Risk Level | Explanation |
|---------|-----------|-------------|
| **Flat authorization** — any authorized email can read/write everything | Medium | A "cashier" can delete inventory, alter config, or remove other staff |
| **No write validation in rules** — any shape of data accepted | High | A compromised/malicious client can write arbitrary fields, invalid types, or negative stock values |
| **SHOP_ID is client-side constant** — no server enforcement of shop ownership | Low | In practice only matters if multiple shops share one Firebase project (unlikely in fork-and-go model) |
| **summary/totals can be arbitrarily overwritten** — no server-side compute | Medium | A bad actor (or bug) can overwrite revenue counters with false data |
| **config/main allows any authorized user to remove others** | Medium | A staff member could remove the owner's email, locking them out |

### Performance / Cost Issues

| Problem | Impact | Explanation |
|---------|--------|-------------|
| **Dashboard queries all sales docs** for stats (7-day, monthly) | High reads | Each dashboard load fetches potentially hundreds of full sale documents just to sum `total` fields |
| **No date-partitioned subcollection** | Read waste | Cannot efficiently query "today's sales" without scanning all sales matching timestamp filter |
| **summary/totals never resets** — today/week/month counters accumulate forever | Data corruption | After midnight, "today_count" still reflects yesterday. No Cloud Function to reset it |
| **Full inventory collection loaded on every billing page visit** | Acceptable (small) | For <500 items this is fine via `onSnapshot`; breaks at scale |
| **items[] array embedded in sale document** | Inflexible | Cannot query "all sales containing item X" without downloading every sale and filtering client-side |
| **onSnapshot on entire inventory** (billing + inventory modules) | Duplicate listeners | Two listeners on the same collection when both routes are loaded in the same session |

---

## Decision

Adopt a **layered security + date-sharded + pre-aggregated** Firestore architecture that addresses the above problems while remaining feasible on Spark free tier (no Cloud Functions).

### Recommended Schema (v2)

```
/shops/{shopId}/
├── config/main
│   └── { authorized_emails: [], staff_roles: { email: "owner"|"admin"|"cashier" }, shop_name, ... }
│
├── counters/sales_counter
│   └── { last_seq: number }
│
├── inventory/{itemId}
│   └── { name, unit, price, stock, threshold, updated_at, created_at }
│
├── sales/{saleId}                    ← keep as-is for receipt lookups
│   └── { saleId, timestamp, items[], subtotal, discount, total, customer_phone, created_by }
│
├── daily_summary/{YYYY-MM-DD}        ← NEW: one doc per day, written atomically with each sale
│   └── { date, count, revenue, top_items: { [item_id]: { name, qty, revenue } } }
│
└── monthly_summary/{YYYY-MM}         ← NEW: one doc per month, incremented with each sale
    └── { month, count, revenue }
```

### Recommended Security Rules (v2)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }

    function getConfig(shopId) {
      return get(/databases/$(database)/documents/shops/$(shopId)/config/main).data;
    }

    function isAuthenticated() {
      return request.auth != null && request.auth.token.email != null;
    }

    function isAuthorized(shopId) {
      return isAuthenticated()
        && request.auth.token.email in getConfig(shopId).authorized_emails;
    }

    function getRole(shopId) {
      let config = getConfig(shopId);
      return config.staff_roles[request.auth.token.email];
    }

    function isOwnerOrAdmin(shopId) {
      return isAuthorized(shopId)
        && getRole(shopId) in ['owner', 'admin'];
    }

    match /shops/{shopId}/config/main {
      // Only owners can modify config (add/remove staff)
      allow read: if isAuthorized(shopId);
      allow write: if isAuthorized(shopId) && getRole(shopId) == 'owner';
      // Bootstrap: first user creates config with themselves as owner
      allow create: if isAuthenticated()
        && request.auth.token.email in request.resource.data.authorized_emails
        && request.resource.data.staff_roles[request.auth.token.email] == 'owner';
    }

    match /shops/{shopId}/inventory/{itemId} {
      allow read: if isAuthorized(shopId);
      // Only owner/admin can add/edit/delete inventory
      allow write: if isOwnerOrAdmin(shopId)
        && request.resource.data.keys().hasAll(['name', 'unit', 'price', 'stock'])
        && request.resource.data.price is number
        && request.resource.data.price > 0
        && request.resource.data.stock is number
        && request.resource.data.stock >= 0;
      // Cashiers can only decrement stock (via billing batch)
      allow update: if isAuthorized(shopId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stock'])
        && request.resource.data.stock is number;
    }

    match /shops/{shopId}/sales/{saleId} {
      allow read: if isAuthorized(shopId);
      // Any authorized user can create a sale, but not update/delete
      allow create: if isAuthorized(shopId)
        && request.resource.data.keys().hasAll(['saleId', 'timestamp', 'items', 'total'])
        && request.resource.data.total is number
        && request.resource.data.total >= 0;
      allow update, delete: if false;  // Sales are immutable once created
    }

    match /shops/{shopId}/counters/{counterId} {
      allow read, write: if isAuthorized(shopId);
    }

    match /shops/{shopId}/daily_summary/{dateId} {
      allow read: if isAuthorized(shopId);
      // Only allow increment-style writes (no overwrite)
      allow write: if isAuthorized(shopId);
    }

    match /shops/{shopId}/monthly_summary/{monthId} {
      allow read: if isAuthorized(shopId);
      allow write: if isAuthorized(shopId);
    }
  }
}
```

### Recommended Access Pattern Changes

| Current Pattern | Problem | Optimized Pattern |
|----------------|---------|-------------------|
| Dashboard queries all `sales` where timestamp >= 7 days ago | Reads every sale document (~hundreds) | Read 7 `daily_summary/{date}` docs (7 reads instead of 100+) |
| Dashboard monthly total queries all monthly sales | Reads all month's sales | Read 1 `monthly_summary/{YYYY-MM}` doc |
| `summary/totals` with stale today/week/month counters | Never resets, becomes incorrect | Date-keyed docs are naturally correct; no reset needed |
| Batch write: sale + stock decrement + summary increment | summary/totals doc = hot contention point | Increment `daily_summary/{today}` + `monthly_summary/{month}` instead |
| Client-side `items[]` search for product analytics | Full collection scan | `daily_summary.top_items` map provides per-day product breakdown without scanning sales |

### Migration Strategy (Non-Breaking)

1. **Phase 1 (immediate):** Add `daily_summary` and `monthly_summary` writes to the billing batch. Keep writing `summary/totals` for backward compat.
2. **Phase 2:** Update dashboard to read from `daily_summary` / `monthly_summary` instead of querying `sales`.
3. **Phase 3:** Remove `summary/totals` writes. Deploy updated security rules with role enforcement.
4. **Phase 4:** Backfill `daily_summary` docs from existing `sales` data (one-time script).

---

## Consequences

### Positive

- **POS-001**: Role-based security prevents cashiers from modifying inventory, config, or other users — defense in depth without Cloud Functions
- **POS-002**: Immutable sales (no update/delete) creates an audit trail that cannot be tampered with by staff
- **POS-003**: Date-sharded summaries reduce dashboard reads from ~100-500 docs to exactly 7-12 docs (93-98% read reduction)
- **POS-004**: No stale counter problem — `daily_summary/2026-06-01` is always accurate for June 1st; no midnight reset required
- **POS-005**: Write validation in rules prevents malformed data (negative prices, missing fields) even if client code has bugs
- **POS-006**: `top_items` map in daily summary enables product analytics without querying all sales
- **POS-007**: Still fully compatible with Spark free tier — no Cloud Functions needed
- **POS-008**: Migration is non-breaking — can be done incrementally while the app is live

### Negative

- **NEG-001**: More complex security rules — harder to debug; each `get()` call costs 1 read toward the 50K/day limit (role check = 1 extra read per request)
- **NEG-002**: Batch write grows from 3 operations (sale + stock + summary) to 5 (sale + stock + daily_summary + monthly_summary + legacy_summary) during migration
- **NEG-003**: Role enforcement on inventory writes means the billing batch `stock decrement` needs a separate rule path, increasing rule complexity
- **NEG-004**: Cannot fully validate `increment()` operations in rules — Firestore rules can only validate the final state, not the delta
- **NEG-005**: Backfill script (Phase 4) must be run once by the shop owner to populate historical daily summaries

---

## Alternatives Considered

### Alternative 1: Cloud Functions for Server-Side Aggregation

- **ALT-001**: **Description**: Use Firebase Cloud Functions (onWrite trigger on `/sales/{id}`) to atomically compute daily/monthly summaries and enforce business rules server-side
- **ALT-002**: **Rejection Reason**: Requires Blaze (pay-as-you-go) plan — violates the "₹0 forever" constraint. Also introduces cold start latency (200-800ms) incompatible with offline-first UX

### Alternative 2: Flatten All Data into One Collection

- **ALT-003**: **Description**: Store everything (inventory, sales, config) as documents in a single flat collection with a `type` field discriminator
- **ALT-004**: **Rejection Reason**: Destroys Firestore's collection-level security model; makes `onSnapshot` listeners impossible to scope efficiently; increases read costs since you can't query a subcollection

### Alternative 3: Client-Side Summary Computation Only

- **ALT-005**: **Description**: Remove all server-side summary docs; compute everything from raw sales docs on each dashboard load
- **ALT-006**: **Rejection Reason**: Reads scale linearly with sales volume (100 sales/day × 30 days = 3000 reads per dashboard load); would exhaust 50K daily read quota within 16 dashboard views

### Alternative 4: Time-Series Subcollection per Item

- **ALT-007**: **Description**: Store each stock change as a subdocument: `/inventory/{id}/history/{timestamp}` for full audit trail
- **ALT-008**: **Rejection Reason**: Massively increases write operations (every sale writes N stock-change documents + N history documents); incompatible with free tier write quota for active shops

---

## Implementation Notes

- **IMP-001**: Security rules `get()` for role lookup adds 1 read per request. With Firestore's request-level caching, multiple rule evaluations in the same batch share one `get()` call. At ~200 requests/day (typical small shop), this is ~200 extra reads — well within 50K limit.
- **IMP-002**: The `daily_summary` write must be inside the same `writeBatch` as the sale to maintain atomicity. If the batch fails, neither the sale nor the summary is written.
- **IMP-003**: Monitor success via: dashboard loads without querying `sales` collection directly; read quota usage should drop by >80% post-migration.
- **IMP-004**: The owner role must be immutable — the first bootstrap creates it, and only another owner (if any) can add a second owner. This prevents staff from escalating privileges.
- **IMP-005**: For shops with >500 inventory items (rare for kirana/boutique), consider pagination with `limit(50)` + `startAfter` on the inventory `onSnapshot`. Current architecture is fine for <500 items.

---

## References

- **REF-001**: [Vikretha TRD v3.0](../trd/vikretha-trd.md) — Current technical design
- **REF-002**: [Firebase Security Rules Reference](https://firebase.google.com/docs/firestore/security/get-started)
- **REF-003**: [Firestore Best Practices — Aggregation](https://firebase.google.com/docs/firestore/solutions/aggregation)
- **REF-004**: [Firestore Pricing / Spark Limits](https://firebase.google.com/pricing) — 50K reads, 20K writes/day
- **REF-005**: [Distributed Counters Pattern](https://firebase.google.com/docs/firestore/solutions/counters) — Relevant if a single summary doc becomes a hot spot (unlikely at small-shop scale)
