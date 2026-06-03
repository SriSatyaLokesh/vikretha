# Milestone 1 Summary — Vikretha MVP (v1.0)

> **Generated:** 2026-06-03  
> **Milestone:** 1 — MVP (Full Shop Management PWA)  
> **Status:** 15 of 16 phases complete; Phase 16 Wave 1 complete (in progress)

---

## 1. Overview

**Vikretha** is a zero-cost, self-hosted shop management Progressive Web App (PWA) for small Indian shop owners — kirana stores, boutiques, and street vendors.

### The Problem

Small shop owners track sales on paper registers or WhatsApp. They lose data, have no business insights, and can't send professional receipts. SaaS alternatives cost money and require server expertise they don't have.

### The Solution

Sellers fork the GitHub template repository, fill in their Firebase credentials in `shop.config.js`, enable GitHub Pages, and immediately get a full shop management app — no subscription, no server, no vendor lock-in, ₹0 forever.

### Who It's For

| Persona | Description |
|---------|-------------|
| Shop Owner / Admin | Low-to-medium tech comfort. Wants insights, stock tracking, professional bills, Excel export. Android smartphone user. |
| Salesperson / Counter Staff | Low tech comfort. Needs fast, simple UI for recording sales and sharing receipts. |

### What Milestone 1 Delivered

A fully functional PWA covering: phone/email auth, fast billing with offline support, Canvas receipt generation + WhatsApp share, real-time dashboard, inventory management, Excel export, staff management, and a modern responsive design — all from a single GitHub repository with no build step.

---

## 2. Architecture

### Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Hosting | GitHub Pages | Zero cost, HTTPS, CDN, no server needed |
| Frontend | Vanilla JS ES Modules | No build step; fork-and-go; < 30 KB payload |
| Styling | Custom CSS (Tailwind-inspired utility classes) | Mobile-first, no CDN dependency after Phase 10 |
| Database | Firebase Firestore (Spark free tier) | 20K writes/day, offline-first IndexedDB persistence, ACID transactions |
| Auth | Firebase Auth (Email/Password → Staff Roles) | Per-shop isolation via Firestore Security Rules |
| Receipts | Canvas 2D API | 0 KB dependency, < 1 sec generation |
| Charts | CSS flexbox bar chart | No library, no network call |
| Export | SheetJS (xlsx) via CDN | Client-side Excel, lazy-loaded on demand |
| Offline | Firestore SDK IndexedDB persistence | Automatic write queue + sync |
| PWA | Service Worker + manifest.json | Installable on Android home screen |
| Routing | Hash-based (`#/route`) | Works on GitHub Pages without 404 hacks |

### Firestore Data Model

All data lives under `shops/{SHOP_ID}/`:

```
shops/{SHOP_ID}/
  config/main          — shop name, authorized_emails, staff_roles, theme settings
  inventory/{itemId}   — name, unit, unitType, price, stock, threshold, sizes?, type, branch, color
  sales/{saleId}       — saleId, timestamp, items[], total, discount, customerId, customer_name, editedAt?
  counters/sale        — counter for sequential YYYYMMDD-NNNN Sale IDs
  customers/{phoneKey} — name, phone, lastSaleAt  (customer contact book)
  summary/totals       — legacy aggregate totals (backward compat)
  daily_summary/{date} — { date, count, revenue, last_updated }
  monthly_summary/{YM} — { month, count, revenue, last_updated }
```

### File Layout

```
vikretha/
  index.html             — Entry point (CSP meta, PWA links, module script)
  app.js                 — Hash router + auth guard + app shell mount
  shop.config.js         — All shop customization + Firebase config
  manifest.json          — PWA manifest
  sw.js                  — Service worker (app shell cache)
  firestore.rules        — Firestore Security Rules (role-based)
  lib/
    firebase-init.js     — Firebase SDK init + IndexedDB persistence
  modules/
    auth.js              — Email/Password auth, staff roles, bootstrapShopConfig
    billing.js           — Cart, product search, discount, ad-hoc items, customer autofill
    dashboard.js         — Summary cards, 7-day bar chart, monthly report, top products
    inventory.js         — Inventory list/add/edit, sizes, type/branch/color filters
    receipt.js           — Canvas receipt generation, download, WhatsApp share
    reports.js           — Sales history, pagination, detail panel, owner bill editing
    export.js            — SheetJS Excel export (sales + inventory)
    settings.js          — Staff management, sign-out
  styles/
    main.css             — Full design system (Inter font, slate/orange palette, responsive)
```

---

## 3. Phases

### Phase 1 — Foundation & App Shell ✅
**Built:** `index.html`, `manifest.json`, `sw.js`, `shop.config.js` template, `styles/main.css`, `lib/firebase-init.js`, hash-based router in `app.js`, auth guard.  
**Key decisions:** 1×1 PNG icon placeholders (replace before production), CSP with `style-src 'unsafe-inline'` for CSS custom properties, no build tooling.

### Phase 2 — Authentication ✅
**Built:** `modules/auth.js` — Email/Password sign-in, Create Account, Forgot Password, `onAuthStateChanged` session restoration, `bootstrapShopConfig` (writes owner role on first sign-up), `firestore.rules` v1 (`authorized_emails` guard).  
**Note:** Original spec was Phone OTP; implemented as Email/Password for broader compatibility.

### Phase 3 — Billing & Sale Recording ✅
**Built:** `modules/billing.js` — product search from inventory, cart with quantity + discount (% or ₹), customer phone field, Firestore `runTransaction` for sequential `YYYYMMDD-NNNN` Sale IDs, offline fallback Sale ID, atomic batch write (sale + stock decrement + summary update), `⏳` sync indicator via `hasPendingWrites`.  
**Key decision:** Delegated click handlers on billing grid avoid rebinding on every re-render.

### Phase 4 — Receipt Generation & WhatsApp Share ✅
**Built:** `modules/receipt.js` — Canvas 2D receipt layout (header, items table, totals, footer), PNG download, Web Share API with `wa.me` fallback, customer phone pre-fill in share link.  
**Key decision:** `AbortError` caught separately so user dismissing the native share sheet doesn't trigger the wa.me fallback.

### Phase 5 — Dashboard & Reports ✅
**Built:** `modules/dashboard.js` — three summary cards (Today / Week / Month) from `summary` doc via `onSnapshot`, 7-day CSS bar chart, last-synced timestamp, monthly report with month picker, top 5 products by revenue.  
**Key decision:** Summary cards read from pre-computed `summary` doc (no collection scan) for instant load.

### Phase 6 — Inventory Management ✅
**Built:** `modules/inventory.js` — inventory list from Firestore, low-stock visual flags, add/edit modal, stock threshold config.

### Phase 7 — Data Export (Excel) ✅
**Built:** `modules/export.js` — SheetJS lazy-loaded on demand, sales export (month/all) and inventory snapshot, auto-download with shop-name filename. Security: `_safeStr()` strips `=`, `+`, `-`, `@` prefix characters to prevent formula injection.

### Phase 8 — Staff Management & Settings ✅
**Built:** `modules/settings.js` — add/remove authorized emails, role assignment (owner/admin/cashier), sign-out.

### Phase 9 — Documentation & Polish ✅
**Built:** `README.md` setup guide, `shop.config.js.template`, ADR document, PRD/TRD in `docs/`.

### Phase 10 — Modern Responsive Redesign ✅
**Built:** Complete UI overhaul — orange (#f97316) primary color replacing blue, Inter font, slate-900 dark sidebar on desktop (≥1024px), bottom nav on mobile, all module HTML rewritten for new class structure. Dual-render inventory (table on desktop, cards on mobile, CSS toggles at 768px breakpoint).

### Phase 11 — Firestore Architecture Hardening ✅
**Built:** Complete `firestore.rules` rewrite with helper functions (`isAuthenticated`, `isAuthorized`, `getRole`, `isOwnerOrAdmin`), role-based CRUD per collection, cashier restricted to stock-update-only on inventory. Date-sharded aggregation writes added to `billing.js` (`daily_summary/{YYYY-MM-DD}` + `monthly_summary/{YYYY-MM}`), replacing full-collection scans for dashboard queries.

### Phase 12 — Customer Contact & Autofill ✅
**Built:** `customers` subcollection in Firestore. Billing phone input gets `<datalist>` with phone suggestions. On exact match, customer name auto-fills. After sale commit, customer doc upserted (`setDoc merge:true`) with `lastSaleAt`. Fire-and-forget upsert doesn't block sale confirmation.

### Phase 13 — Inventory Piece Sizes & Variants ✅
**Built:** `hasSizes` inventory items — size variants with label, width, psi, and stock per size. `isLow` checks each size individually. Billing and receipt updated to display size selection. Size key sanitized (`_sizeKey()`: trim, lowercase, max 40 chars) for safe Firestore field names.

### Phase 14 — Ad-hoc Items in Billing ✅
**Built:** "Other item" button in billing opens a bottom-sheet form (name + price). Cart key uses `adhoc::` prefix + `Date.now().toString(36)` for uniqueness. Stock decrement loop guarded with `if (!item.item_id) continue` to skip ad-hoc items.

### Phase 15 — Sales History & Bill Management ✅
**Built:** `modules/reports.js` at `#/reports` — paginated sales list (latest 25, cursor pagination), date-range filter, debounced client-side search (300ms), sale detail panel with "View Receipt" navigation. Owner-only bill editing: edit form in detail panel, `updateDoc` with audit trail fields (`editedAt`, `editedBy`, `originalTotal`, `amendedTotal`). Firestore rules updated to allow owner-only `update` on sales (delete remains blocked).  
**Key decision:** `getRole == 'owner'` not `isOwnerOrAdmin` — admins explicitly excluded from bill editing.

### Phase 16 — Inventory Fields Enhancement 🔄 (Wave 1 complete)
**Built so far:** `type`, `branch`, `color` optional classification fields on inventory items. Inventory table extended to 7 columns; mobile cards show color badge and type/branch meta line. Type/branch filter dropdowns in both inventory and billing views. Export updated to 10 columns (Type, Branch, Color added). All new fields pass through `escapeHtml()` / `_safeStr()` before rendering or export.  
**Remaining:** Phase 16 Plan 03 — human verification checkpoint.

---

## 4. Key Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| Project start | Vanilla JS ES Modules, no build step | Fork-and-go simplicity; < 30 KB app payload |
| Project start | Firebase Spark (free) tier | 20K writes/day headroom; 33× of MVP usage |
| Project start | Hash-based routing | GitHub Pages 404 compatibility without redirect hacks |
| Phase 1 | Canvas 2D for receipts | Zero dependency, browser-native, fast |
| Phase 3 | `runTransaction` for Sale ID counter | Guarantees sequential YYYYMMDD-NNNN under concurrent writes |
| Phase 3 | Offline fallback Sale ID (timestamp-based) | Lets `batch.commit()` queue to IndexedDB when no network |
| Phase 3 | Delegated click on billing grid | Avoids listener rebinding on every re-render |
| Phase 4 | Catch `AbortError` separately | Prevents `wa.me` fallback on user dismiss of share sheet |
| Phase 10 | Orange primary, slate sidebar | Modern 2026 design language; distinct brand identity |
| Phase 11 | Date-sharded daily/monthly_summary docs | Dashboard O(1) reads instead of collection scans |
| Phase 11 | Role-based Firestore rules with helpers | Explicit intent; auditable; no ambient authority |
| Phase 12 | Fire-and-forget customer upsert | Customer tracking must never block a sale |
| Phase 13 | `_sizeKey()` sanitization | Safe Firestore field names from free-text size labels |
| Phase 15 | `originalTotal` preserves first original | Prevents audit trail overwrite on re-edits |
| Phase 15 | Owner-only bill editing (not admin) | Admins are operational staff; billing edits need owner accountability |
| Phase 16 | Optional type/branch/color — no required validation | Classification metadata; never blocks a sale |

---

## 5. Requirements Coverage

### Functional Requirements

| Requirement | Status | Phase |
|-------------|--------|-------|
| FR-01: Authentication | ✅ | 2, 8, 11 |
| FR-02: Billing & Sale Recording | ✅ | 3, 12, 14 |
| FR-03: Receipt Generation & WhatsApp | ✅ | 4 |
| FR-04: Dashboard & Reports | ✅ | 5, 11 |
| FR-05: Inventory Management | ✅ | 6, 13, 16 |
| FR-06: Data Export (Excel) | ✅ | 7, 16 |
| FR-07: Setup & Configuration | ✅ | 1, 9 |

### Non-Functional Requirements

| ID | Target | Status |
|----|--------|--------|
| NFR-01: Initial load < 3s (4G) | < 3s | ✅ Static assets, SW cache |
| NFR-02: Subsequent load < 1s | < 1s | ✅ IndexedDB + SW cache |
| NFR-03: Receipt generation < 1s | < 1s | ✅ Canvas 2D in-browser |
| NFR-04: Bill submission < 200ms | < 200ms | ✅ Optimistic UI |
| NFR-05: App JS payload < 30 KB | < 30 KB | ✅ ~25 KB vanilla JS |
| NFR-06: Excel export (1000 rows) < 3s | < 3s | ✅ Client-side SheetJS |
| NFR-08: Offline read + write | Full | ✅ Firestore IndexedDB |
| NFR-09: HTTPS | Enforced | ✅ GitHub Pages |
| NFR-11: Mobile-first (< 430px) | Full | ✅ Responsive CSS |
| NFR-12: PWA installable | Yes | ✅ manifest.json + SW |

### Security Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| SEC-01 | Email/Password + role-based access | ✅ Phase 2, 11 |
| SEC-02 | Per-shop Firestore Security Rules isolation | ✅ Phase 2, 11 |
| SEC-03 | `authorized_emails` + `staff_roles` management | ✅ Phase 8, 11 |
| SEC-04 | Minimal PII | ✅ Optional customer phone only |
| SEC-05 | HTTPS enforced | ✅ GitHub Pages |
| SEC-06 | Firebase config safe to commit | ✅ By design |
| SEC-07 | CSP meta tag restricts scripts | ✅ Phase 1 |
| XSS | `escapeHtml()` on all innerHTML injections | ✅ All phases |
| Injection | `_safeStr()` strips formula prefix chars in Excel | ✅ Phase 7, 16 |
| SQL equiv | Firestore parameterized queries (SDK) | ✅ By design |

---

## 6. Technical Debt & Known Issues

| Area | Item | Severity | Notes |
|------|------|----------|-------|
| Icons | Placeholder 1×1 PNG icons | Medium | Replace `icons/icon-192.png` and `icons/icon-512.png` before production |
| Auth | Phone OTP not implemented | Low | Spec called for OTP; Email/Password used instead; OTP would require reCAPTCHA verifier + App Check |
| Dashboard | `summary/totals` legacy doc retained | Low | Kept for backward compatibility; can be removed once all installs migrate to `daily_summary` / `monthly_summary` |
| Phase 16 | Verification checkpoint pending | Low | Plan 03 (human UAT) not yet run |
| Billing | No multi-item ad-hoc batch | Low | Can only add one ad-hoc item at a time via bottom-sheet form |
| Export | Sales export fetches all rows for "all time" | Low | Large shops (>10K bills) could hit memory; pagination not implemented for export |
| PWA | Service worker caches app shell only | Low | Firebase SDK files not cached in SW; handled by Firestore SDK's own persistence |

---

## 7. Getting Started

### Prerequisites
- A Google account (for Firebase)
- A GitHub account

### Setup Steps (< 30 minutes)

1. **Fork** this repository on GitHub.
2. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com):
   - Enable **Firestore** (Native mode)
   - Enable **Authentication → Email/Password**
   - Copy your web app config object
3. **Edit `shop.config.js`**:
   ```js
   export const FIREBASE_CONFIG = { /* paste your Firebase config */ };
   export const SHOP_NAME = "My Shop";
   export const SHOP_ID = "my-shop-unique-id";
   // ... other settings
   ```
4. **Deploy Firestore rules**: copy `firestore.rules` content to Firebase Console → Firestore → Rules, and publish.
5. **Enable GitHub Pages**: Repo Settings → Pages → Source: Deploy from branch `main`, root `/`.
6. **Open your shop URL** (e.g., `https://yourusername.github.io/vikretha`).
7. **Create your owner account** using "Create Account" on the login screen — this bootstraps your shop config automatically.

### First Sale
1. Go to **Inventory** → Add a few products.
2. Go to **Billing** → Search for a product → Add to cart → Submit.
3. The receipt screen opens — tap **Share via WhatsApp**.

### Key Module Map

| If you want to change... | Edit this file |
|--------------------------|----------------|
| Shop name / branding | `shop.config.js` |
| Auth behavior | `modules/auth.js` |
| Billing / cart logic | `modules/billing.js` |
| Receipt layout | `modules/receipt.js` |
| Dashboard stats | `modules/dashboard.js` |
| Inventory fields | `modules/inventory.js` |
| Export columns | `modules/export.js` |
| Staff / settings | `modules/settings.js` |
| Sales history | `modules/reports.js` |
| Colors / fonts / layout | `styles/main.css` |
| Firestore permissions | `firestore.rules` |

---

*Generated by gsd-milestone-summary from `.planning/` artifacts — 2026-06-03*
