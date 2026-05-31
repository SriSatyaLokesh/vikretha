---
title: "Vikretha — Small Seller Shop Site"
version: "3.0"
date_created: "2026-05-31"
last_updated: "2026-05-31"
status: "Draft"
owner: "SriSatyaLokesh"
tags: ["prd", "mvp", "static-site", "small-business", "zero-cost", "firebase", "pwa"]
---

# Vikretha — Product Requirements Document

![Status: Draft](https://img.shields.io/badge/status-Draft-yellow)

---

## 1. Executive Summary

### Problem Statement

Small, independent shop owners (kiranas, boutiques, street vendors) need a way to
track inventory and sales without paying for SaaS tools. Existing solutions are
expensive, require internet infrastructure, or are too complex. Most shops rely on
paper registers or WhatsApp forwards — leading to lost data, no insights, and zero
professionalism in customer receipts.

### Proposed Solution

**Vikretha** is a zero-cost, self-hosted shop management progressive web app (PWA)
that runs as a static site on GitHub Pages, using **Firebase Firestore** as the
backend database with **Firebase Auth (Phone OTP)** for access control. Sellers
fork the template repository, configure their Firebase project credentials, and
immediately get their own branded shop management tool — no subscription, no
custom server, no vendor lock-in.

### Why Firebase over Google Sheets?

| Concern | Google Sheets (old approach) | Firebase Firestore (chosen) |
|---------|---------------------------|----------------------------|
| Write quota | 6 min/day Apps Script (≈300 bills) | **20,000 writes/day** (free) |
| Auth | Shared API key (anyone can read) | **Phone OTP** (per-user, proper) |
| Offline | Must build custom queue | **Built-in** (SDK handles it) |
| Real-time | Manual refresh only | **Live sync** across devices |
| Data privacy | Sheet is publicly readable | **Private by default** (Security Rules) |
| Blocked in India? | No | **No** (Google infra, un-bannable) |
| Transactions | Race conditions possible | **ACID transactions** |

### Success Criteria

| KPI | Target |
|-----|--------|
| Phone OTP login — only authorized users access shop data | ✅ Day 1 |
| Daily, weekly, and monthly sales summary visible on dashboard | ✅ Day 1 |
| Receipt image generated and shareable via WhatsApp | < 1 sec generation time |
| Setup time for a new shop owner (fork → working app) | < 30 minutes |
| Cost to run for a shop owner | ₹0 forever |
| Works on mobile (Android/iOS Chrome) | Full feature parity |
| Offline billing — no lost sales during connectivity drops | ✅ Day 1 (Firestore built-in) |
| Export sales/inventory to Excel | ✅ Day 1 |
| Total app JS payload (excluding Firebase SDK cached) | < 30 KB |

---

## 2. User Experience & Functionality

### 2.1 User Personas

#### Persona A — Shop Owner / Admin
- **Who**: Owner of a small retail shop (kirana, garment, stationery, pharmacy)
- **Tech comfort**: Low to medium — comfortable with WhatsApp and UPI payments
- **Goal**: Know what's selling, what's in stock, send professional bills to
  customers, export data to Excel for accounting
- **Pain**: Doesn't want to pay monthly fees; doesn't have a dedicated computer
- **Device**: Primarily Android smartphone; occasionally laptop

#### Persona B — Salesperson / Counter Staff
- **Who**: Employee handling day-to-day billing at the counter
- **Tech comfort**: Low — needs a dead-simple UI
- **Goal**: Quickly add a bill, send receipt to customer via WhatsApp
- **Pain**: No time to learn complex tools; needs it to work instantly

---

### 2.2 User Stories & Acceptance Criteria

#### Epic 1: Authentication (Phone OTP)

**STORY-000** — *As a shop owner, I want to log in with my phone number so that
only authorized people can access my shop data.*
- **AC-000.1**: On first visit (no auth session), the app renders a full-screen
  "Sign In" screen — no data, no navigation, nothing else is accessible
- **AC-000.2**: The screen has a phone number input with country code (+91
  pre-filled for India) and a "Send OTP" button
- **AC-000.3**: On submitting a valid phone number, Firebase Auth sends a 6-digit
  OTP via SMS; the UI shows an OTP entry field
- **AC-000.4**: On correct OTP entry, the user is authenticated and the app
  navigates to the dashboard. Firebase handles session persistence.
- **AC-000.5**: If OTP is wrong or expired, an inline error is shown — the app
  does not proceed
- **AC-000.6**: On subsequent visits, Firebase Auth automatically restores the
  session — no re-login needed (persistent session)
- **AC-000.7**: A "Sign Out" option in Settings clears the session and returns
  to the Sign In screen
- **AC-000.8**: Firestore Security Rules ensure each user can only read/write
  data within their own shop's document path (`shops/{shopId}/*`)
- **AC-000.9**: The shop owner can add additional phone numbers as authorized
  users (staff) via a simple Settings screen

---

#### Epic 2: Billing / Record of Sale ⭐ PRIMARY

**STORY-001** — *As a Salesperson, I want to record a sale as fast as possible so
customers don't wait.*
- **AC-001.1**: A prominent "New Sale" button is visible immediately on the
  dashboard after authentication
- **AC-001.2**: Bill entry screen shows a searchable product list loaded from the
  `inventory` collection (with Firestore offline cache, instant even without network)
- **AC-001.3**: Tapping a product lets the salesperson enter quantity; cart total
  auto-calculates in real-time
- **AC-001.4**: Optional discount field (% or ₹ fixed amount)
- **AC-001.5**: Optional customer mobile number field
- **AC-001.6**: "Submit Sale" writes the bill to the `sales` collection and
  decrements stock in `inventory` using a Firestore **batch write** (atomic)
- **AC-001.7**: A unique **Sale ID** is auto-generated client-side (format:
  `YYYYMMDD-NNNN` using a Firestore counter document for sequential numbering)
- **AC-001.8**: On submission the app immediately shows the receipt (optimistic
  UI via Firestore offline persistence — the write is queued locally and synced
  when online)
- **AC-001.9**: Perceived time from "Submit" to receipt display: < 200ms
  (Firestore offline write is instant)
- **AC-001.10**: If the device is offline at submission time, Firestore SDK
  queues the write automatically. The sale is visible locally immediately. A
  small ⏳ indicator shows "syncing" until confirmed by server.

**STORY-002** — *As a Salesperson, I want a clear indication if the sale hasn't
synced to the server.*
- **AC-002.1**: Bills that haven't synced yet show a ⏳ badge in the sales list
- **AC-002.2**: Once synced, the badge disappears automatically (Firestore
  snapshot listener handles this)
- **AC-002.3**: No data is ever lost — Firestore SDK persists writes in
  IndexedDB and syncs when connectivity returns

---

#### Epic 3: Receipt Generation & WhatsApp Sharing

**STORY-003** — *As a Salesperson, I want to generate a receipt image immediately
after a sale so I can share it via WhatsApp.*
- **AC-003.1**: Receipt image is generated client-side using the **Canvas 2D API**
  (direct programmatic drawing — no html2canvas dependency) within 1 second
- **AC-003.2**: Receipt displays: shop name, logo, date-time, **Sale ID**, itemized
  list with qty and unit price, subtotal, discount (if any), and final total
- **AC-003.3**: The Sale ID on the receipt matches the document ID in Firestore —
  enabling the shop owner to look up any bill
- **AC-003.4**: "Download Receipt" button saves the PNG to the device
- **AC-003.5**: "Share via WhatsApp" uses Web Share API with `wa.me` fallback;
  if a customer mobile number was entered, that number is pre-filled
- **AC-003.6**: The pre-written message includes shop name, Sale ID, and total
- **AC-003.7**: Receipt renders correctly on mobile viewport (< 430px wide)

---

#### Epic 4: Reports & Dashboard

**STORY-004** — *As an Admin, I want a dashboard with today's, this week's, and
this month's sales so I can track performance at a glance.*
- **AC-004.1**: Dashboard shows three summary cards: **Today**, **This Week**,
  and **This Month** — each displaying total bill count and total revenue
- **AC-004.2**: Summary data is maintained in a `summary` document that is
  updated atomically on each sale (using Firestore `increment()` — no full
  collection scan needed)
- **AC-004.3**: A lightweight CSS bar chart (flexbox + percentage heights, zero
  JS library) shows daily revenue for the past 7 days
- **AC-004.4**: Dashboard data loads instantly from Firestore offline cache;
  updates in real-time via snapshot listeners when online
- **AC-004.5**: A "last synced" timestamp is shown; a "Refresh" indicator appears
  when new data arrives from the server

**STORY-005** — *As an Admin, I want a monthly report view so I can compare
months and see which products sell most.*
- **AC-005.1**: Monthly view lets the Admin pick any past month and see total
  revenue and total bill count
- **AC-005.2**: Top 5 selling products by revenue are listed for the selected
  period
- **AC-005.3**: Monthly aggregates are queried from Firestore with date-range
  filters on the `sales` collection (indexed by timestamp)

---

#### Epic 5: Inventory Management

**STORY-006** — *As an Admin, I want to view current stock levels so I know what
needs reordering.*
- **AC-006.1**: Inventory list is read from the `inventory` collection
- **AC-006.2**: Each item shows name, unit, current quantity, and unit price
- **AC-006.3**: Items below their `low_stock_threshold` are visually flagged
- **AC-006.4**: Inventory list loads instantly from Firestore offline cache

**STORY-007** — *As an Admin, I want to add or update stock so the data stays
current.*
- **AC-007.1**: Admin can add a new inventory item (name, unit, price, quantity,
  low-stock threshold)
- **AC-007.2**: Admin can edit an existing item's price, quantity, or threshold
- **AC-007.3**: All writes go through Firestore SDK (with offline persistence)

---

#### Epic 6: Data Export (Excel/CSV)

**STORY-008** — *As an Admin, I want to export my sales and inventory data to
Excel so I can do my own analysis or share with my accountant.*
- **AC-008.1**: Dashboard has an "Export" button with options: "Sales (This
  Month)", "Sales (All Time)", "Inventory Snapshot"
- **AC-008.2**: Exports generate a `.xlsx` file (using SheetJS/xlsx library,
  ~90KB CDN-cached) with properly formatted columns, headers, and data types
- **AC-008.3**: Sales export includes columns: Sale ID, Date/Time, Items
  (comma-separated names), Qty, Subtotal, Discount, Total, Customer Phone
- **AC-008.4**: Inventory export includes columns: Item ID, Name, Unit, Price,
  Current Stock, Low Stock Threshold, Status (OK/Low)
- **AC-008.5**: File is generated entirely client-side from Firestore data
  (no server needed) and auto-downloads to the device
- **AC-008.6**: Export works offline (from cached Firestore data)
- **AC-008.7**: Large exports (>1000 rows) show a progress indicator
- **AC-008.8**: Exported file name format: `{shop_name}_sales_{YYYY-MM}.xlsx`
  or `{shop_name}_inventory_{YYYY-MM-DD}.xlsx`

---

#### Epic 7: Customization & Setup

**STORY-009** — *As a new shop owner, I want to fork and configure the app in
under 30 minutes.*
- **AC-009.1**: A single `shop.config.js` file contains all customizations: shop
  name, logo URL, currency symbol, theme color, WhatsApp number. Firebase config
  (apiKey, projectId, etc.) is also set here.
- **AC-009.2**: The README has a step-by-step setup guide covering: fork repo →
  create Firebase project (free) → enable Phone Auth → create Firestore database
  → copy Firebase config → edit `shop.config.js` → enable GitHub Pages
- **AC-009.3**: A sample Firestore Security Rules file is provided (copy-paste
  into Firebase Console)
- **AC-009.4**: The app works immediately after configuring `shop.config.js` and
  enabling GitHub Pages — no build step required

---

### 2.3 Non-Goals (Out of Scope for MVP)

- ❌ Role-based permissions beyond "authorized phone numbers"
- ❌ Multi-branch / multi-location support
- ❌ Payment gateway integration (billing only, not payment collection)
- ❌ Native iOS/Android app (PWA only)
- ❌ Custom domain setup guidance (GitHub Pages default URL is fine for MVP)
- ❌ Barcode scanner integration
- ❌ GST/tax calculation (can be a post-MVP config option)
- ❌ PDF export (Excel covers the use case; PDF can be added later)

---

## 3. Technical Specifications

### 3.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     GitHub Pages (Static CDN)                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Vikretha Static PWA (HTML/JS/CSS)             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  │  │
│  │  │   Auth   │  │ Billing  │  │Dashboard│  │Inventory │  │  │
│  │  │  Module  │  │  Module  │  │ + Export │  │  Module  │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬────┘  └────┬─────┘  │  │
│  │       │              │              │             │        │  │
│  │  ┌────▼──────────────▼──────────────▼─────────────▼─────┐ │  │
│  │  │            Firebase SDK (JS, ~80KB cached)            │ │  │
│  │  │  • Firestore (read/write + offline persistence)       │ │  │
│  │  │  • Auth (Phone OTP + session management)              │ │  │
│  │  └──────────────────────────┬────────────────────────────┘ │  │
│  └─────────────────────────────│──────────────────────────────┘  │
└────────────────────────────────│─────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Firebase (Free)      │
                    │  ┌──────────────────┐   │
                    │  │   Firestore DB   │   │
                    │  │  • /shops/{id}/  │   │
                    │  │    /inventory    │   │
                    │  │    /sales        │   │
                    │  │    /summary      │   │
                    │  └──────────────────┘   │
                    │  ┌──────────────────┐   │
                    │  │  Firebase Auth   │   │
                    │  │  (Phone OTP)     │   │
                    │  └──────────────────┘   │
                    └─────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Hosting | GitHub Pages | Free, zero-config CDN, HTTPS enforced, direct from repo |
| Frontend | Vanilla JS (ES Modules, no framework) | Zero build step, fork-and-go |
| Styling | Tailwind CSS (CDN play mode) or minimal custom CSS | Responsive, mobile-first |
| Database | **Firebase Firestore** (Spark free plan) | 20K writes/day, offline built-in, real-time sync |
| Auth | **Firebase Auth (Phone OTP)** | Indian users know OTP; no email needed |
| Offline | **Firestore SDK built-in persistence** | Automatic IndexedDB cache + write queue |
| Receipt Generation | Canvas 2D API (direct draw) | 0KB dependency, fast, reliable |
| Charts | CSS flexbox bar chart | 0KB JS for 7 bars |
| Data Export | SheetJS (xlsx) CDN (~90KB cached) | Client-side Excel generation, no server |
| WhatsApp Integration | `wa.me` deep link + Web Share API | Native device share sheet |
| PWA | Hand-rolled Service Worker + manifest.json | Installable, offline shell |
| Routing | Hash-based (`/#/route`) | Works on GitHub Pages without 404 hacks |

### 3.3 Data Model (Firestore Structure)

```
/shops/{shopId}/
├── config                      (single document)
│   ├── shop_name: string
│   ├── currency: string
│   ├── whatsapp_number: string
│   ├── authorized_phones: string[]    ← who can access this shop
│   └── created_at: timestamp
│
├── inventory/                  (collection)
│   └── {itemId}
│       ├── name: string
│       ├── unit: string        (kg, pcs, ltr)
│       ├── price: number
│       ├── stock: number
│       └── low_stock_threshold: number
│
├── sales/                      (collection)
│   └── {saleId}               (e.g., "20260531-0042")
│       ├── timestamp: timestamp
│       ├── items: array [{item_id, name, qty, price, line_total}]
│       ├── subtotal: number
│       ├── discount: number
│       ├── total: number
│       ├── customer_phone: string (optional)
│       └── salesperson: string (optional)
│
├── summary                     (single document — updated atomically per sale)
│   ├── today_count: number
│   ├── today_revenue: number
│   ├── today_date: string      (resets when date changes)
│   ├── week_count: number
│   ├── week_revenue: number
│   ├── week_start: string      (resets on Monday)
│   ├── month_count: number
│   ├── month_revenue: number
│   ├── month_key: string       (e.g., "2026-05")
│   └── last_7_days: array [{date, revenue}]
│
└── counters/                   (collection — for sequential Sale IDs)
    └── sales_counter
        └── last_seq: number    (incremented atomically per sale)
```

### 3.4 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: check if user's phone is authorized for this shop
    function isAuthorized(shopId) {
      let config = get(/databases/$(database)/documents/shops/$(shopId)/config);
      return request.auth != null
        && request.auth.token.phone_number in config.data.authorized_phones;
    }

    match /shops/{shopId}/{document=**} {
      allow read, write: if isAuthorized(shopId);
    }
  }
}
```

### 3.5 Integration Points

| Integration | Method | Auth |
|-------------|--------|------|
| User authentication | Firebase Auth (Phone OTP) | SMS verification |
| Read/write all data | Firestore SDK (client-side) | Firebase Auth token (automatic) |
| Offline persistence | Firestore `enablePersistence()` | None needed (local) |
| Real-time dashboard updates | Firestore `onSnapshot()` listeners | Firebase Auth token |
| Receipt image | Canvas 2D → PNG Blob | None (client-side) |
| WhatsApp share | `wa.me` deep link + Web Share API | None |
| Excel export | SheetJS `writeFile()` | None (client-side) |

### 3.6 Security & Privacy

- **SEC-001**: Firebase Auth with Phone OTP — only verified phone numbers can
  access data. No shared keys, no public URLs.
- **SEC-002**: Firestore Security Rules enforce per-shop data isolation. A user
  can only read/write within their shop's document path.
- **SEC-003**: The `authorized_phones` array in the shop config document controls
  who has access. Shop owner adds/removes staff phone numbers.
- **SEC-004**: No PII is stored beyond optional customer phone numbers and the
  authorized user phone numbers. README warns about DPDP Act compliance.
- **SEC-005**: HTTPS enforced by GitHub Pages. Firebase SDK uses HTTPS for all
  API calls.
- **SEC-006**: Firebase config (apiKey, projectId) is safe to commit to the repo
  — Firebase API keys are not secret (they identify the project; security is
  enforced by Security Rules + Auth, not by key secrecy).
- **SEC-007**: Content Security Policy (CSP) meta tag restricts script sources
  to `'self'` and Firebase CDN domains.
- **SEC-008**: Excel exports are generated entirely client-side. No data leaves
  the browser except to Firebase (which the user already authorized).
- **SEC-009**: Firestore offline cache is stored in IndexedDB — same security
  model as localStorage (device-level access).

### 3.7 Performance Requirements

| Metric | Target |
|--------|--------|
| Initial page load (4G) | < 3 seconds (app shell + Firebase SDK) |
| Subsequent loads (cached) | < 1 second (service worker + Firestore cache) |
| Inventory list render | Instant (from offline cache) |
| Receipt image generation | < 1 second (Canvas 2D direct draw) |
| Bill submission perceived time | < 200ms (Firestore offline write) |
| Dashboard data | Instant (cached) + real-time updates |
| Excel export (1000 rows) | < 3 seconds |
| Offline capability | Full read + write (Firestore SDK handles sync) |

---

### 3.8 Firebase Free Tier (Spark Plan) Limits

| Resource | Free limit | Vikretha usage (100 sales/day) | Headroom |
|----------|-----------|-------------------------------|----------|
| Firestore writes | 20,000/day | ~600/day | 33× |
| Firestore reads | 50,000/day | ~660/day (mostly from cache) | 75× |
| Firestore storage | 1 GB | ~8 MB/year | 125 years |
| Auth (phone verifications) | 10/day (then $0.01/each) | ~1–2/day (persistent sessions) | 5–10× |
| Network egress | 10 GB/month | ~50 MB/month | 200× |

> **Note on Auth quotas:** Firebase free tier allows 10 phone verifications/day.
> Since sessions are persistent (user stays logged in), this is only consumed
> on first login or new device. For a shop with 1–3 staff, this is more than
> enough. If exceeded, it costs ₹0.85 per verification (negligible).

---

## 4. Risks & Roadmap

### 4.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Firebase free tier phone auth limit (10/day) | Low | Low | Sessions persist; only new logins consume quota; costs pennies if exceeded |
| Firebase service disruption in India | Very Low | High | Google infra is deeply embedded in India; never been blocked |
| Shop owner unable to create Firebase project | Medium | High | Provide video walkthrough + screenshot guide; Firebase Console is simpler than Google Cloud Console |
| Firestore offline cache cleared by browser | Low | Medium | Service Worker keeps app shell; Firestore re-syncs on next open; no data loss (server is source of truth) |
| SheetJS CDN unavailable | Very Low | Low | Bundle a local copy as fallback; export is non-critical feature |
| Phone number change (staff leaves) | Medium | Low | Owner removes number from `authorized_phones` in Settings |

### 4.2 Phased Roadmap

#### Phase 0 — Foundation & Auth (Week 1)
- Repo scaffold: `index.html`, `shop.config.js`, PWA manifest, service worker
- Hash-based router with lazy module loading
- Firebase SDK integration (Auth + Firestore)
- Phone OTP sign-in screen
- Firestore offline persistence enabled
- Firestore Security Rules (per-shop isolation)
- Responsive mobile-first UI shell
- GitHub Pages deployment

#### Phase 1 — Record of Sale + Receipt ⭐ (Week 2–3)
- Fast bill entry UI: product search (fuzzy), qty input, auto-calculating cart,
  discount (% or ₹), optional customer phone
- Firestore batch write: sale doc + stock decrement (atomic)
- Sequential Sale ID via counter document
- Receipt generation via Canvas 2D API
- WhatsApp share: Web Share API with `wa.me` fallback
- Offline write confirmation (⏳ indicator until synced)

#### Phase 2 — Dashboard, Reports & Export (Week 4)
- Three summary cards from `summary` document (real-time listener)
- 7-day CSS bar chart
- Monthly report with date-range Firestore queries
- Top 5 products by revenue
- **Excel export**: Sales (month/all) + Inventory snapshot via SheetJS
- "Last synced" indicator

#### Phase 3 — Inventory Management & Setup Docs (Week 5)
- Inventory list view with low-stock visual flags
- Add/edit inventory items
- Staff management (add/remove authorized phone numbers)
- README setup guide with screenshots
- Sample Firestore Security Rules file
- Demo site with sample data on GitHub Pages
- `shop.config.js` reference documentation

#### Post-MVP Backlog
- GST/tax line on receipt (config flag)
- Barcode scan via camera (ZXing.js)
- Multi-currency support
- PDF export (receipt / monthly report)
- Daily backup export to Google Drive (via Firebase Extension)
- Sales analytics (trends, growth %)
- Multi-language support (Hindi, Telugu, Tamil, Kannada)
