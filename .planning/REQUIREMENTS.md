# Vikretha — Requirements

## Milestone 1: MVP (Full Shop Management PWA)

### Functional Requirements

#### FR-01: Authentication (Phone OTP)

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-01.1 | Full-screen sign-in on unauthenticated visit — no data accessible | Must | STORY-000, AC-000.1 |
| FR-01.2 | Phone number input with +91 prefix and "Send OTP" button | Must | AC-000.2 |
| FR-01.3 | Firebase Auth sends 6-digit OTP; UI shows OTP entry field | Must | AC-000.3 |
| FR-01.4 | Correct OTP authenticates user → navigate to dashboard | Must | AC-000.4 |
| FR-01.5 | Wrong/expired OTP shows inline error, no navigation | Must | AC-000.5 |
| FR-01.6 | Persistent session — no re-login on revisit | Must | AC-000.6 |
| FR-01.7 | Sign Out in Settings clears session | Must | AC-000.7 |
| FR-01.8 | Firestore Security Rules: per-shop data isolation | Must | AC-000.8 |
| FR-01.9 | Shop owner can add/remove authorized phone numbers (staff) | Must | AC-000.9 |

#### FR-02: Billing / Record of Sale

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-02.1 | Prominent "New Sale" button on dashboard | Must | AC-001.1 |
| FR-02.2 | Searchable product list from inventory (offline-capable) | Must | AC-001.2 |
| FR-02.3 | Quantity input per product; auto-calculating cart total | Must | AC-001.3 |
| FR-02.4 | Optional discount field (% or ₹ fixed) | Must | AC-001.4 |
| FR-02.5 | Optional customer mobile number field | Should | AC-001.5 |
| FR-02.6 | Atomic batch write: sale doc + stock decrement + summary update | Must | AC-001.6 |
| FR-02.7 | Sequential Sale ID format: `YYYYMMDD-NNNN` via counter doc | Must | AC-001.7 |
| FR-02.8 | Optimistic UI — receipt shown immediately (offline write) | Must | AC-001.8–001.9 |
| FR-02.9 | Offline: Firestore queues write; ⏳ indicator until synced | Must | AC-001.10, AC-002.1–002.3 |

#### FR-03: Receipt Generation & WhatsApp Sharing

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-03.1 | Client-side receipt via Canvas 2D API (< 1 sec) | Must | AC-003.1 |
| FR-03.2 | Receipt shows: shop name, logo, date, Sale ID, items, totals | Must | AC-003.2–003.3 |
| FR-03.3 | Download receipt as PNG | Must | AC-003.4 |
| FR-03.4 | Share via WhatsApp (Web Share API → `wa.me` fallback) | Must | AC-003.5–003.6 |
| FR-03.5 | Receipt renders correctly on mobile (< 430px) | Must | AC-003.7 |

#### FR-04: Dashboard & Reports

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-04.1 | Summary cards: Today, This Week, This Month (count + revenue) | Must | AC-004.1 |
| FR-04.2 | Summary from `summary` doc (atomic updates, no collection scan) | Must | AC-004.2 |
| FR-04.3 | CSS bar chart: daily revenue for past 7 days | Must | AC-004.3 |
| FR-04.4 | Real-time updates via snapshot listener; instant from cache | Must | AC-004.4 |
| FR-04.5 | "Last synced" timestamp + refresh indicator | Should | AC-004.5 |
| FR-04.6 | Monthly report: pick month, see revenue + bill count | Should | AC-005.1 |
| FR-04.7 | Top 5 products by revenue for selected period | Should | AC-005.2 |

#### FR-05: Inventory Management

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-05.1 | Inventory list from `inventory` collection (name, unit, stock, price) | Must | AC-006.1–006.2 |
| FR-05.2 | Low-stock visual flag (below threshold) | Must | AC-006.3 |
| FR-05.3 | Instant load from Firestore offline cache | Must | AC-006.4 |
| FR-05.4 | Add new inventory item (name, unit, price, qty, threshold) | Must | AC-007.1 |
| FR-05.5 | Edit existing item (price, qty, threshold) | Must | AC-007.2 |

#### FR-06: Data Export (Excel)

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-06.1 | Export button with options: Sales (month/all), Inventory snapshot | Must | AC-008.1 |
| FR-06.2 | Generate `.xlsx` via SheetJS (CDN-cached) with formatted columns | Must | AC-008.2 |
| FR-06.3 | Sales columns: Sale ID, Date, Items, Qty, Subtotal, Discount, Total, Phone | Must | AC-008.3 |
| FR-06.4 | Inventory columns: ID, Name, Unit, Price, Stock, Threshold, Status | Must | AC-008.4 |
| FR-06.5 | Client-side generation, auto-download | Must | AC-008.5 |
| FR-06.6 | Works offline from cached data | Must | AC-008.6 |
| FR-06.7 | Progress indicator for >1000 rows | Should | AC-008.7 |
| FR-06.8 | Filename: `{shop_name}_sales_{YYYY-MM}.xlsx` / `{shop_name}_inventory_{date}.xlsx` | Must | AC-008.8 |

#### FR-07: Setup & Configuration

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-07.1 | Single `shop.config.js` for all customization + Firebase config | Must | AC-009.1 |
| FR-07.2 | Step-by-step README setup guide | Must | AC-009.2 |
| FR-07.3 | Sample Firestore Security Rules file | Must | AC-009.3 |
| FR-07.4 | No build step — works after config + GitHub Pages enable | Must | AC-009.4 |

---

### Non-Functional Requirements

| ID | Requirement | Target | Source |
|----|-------------|--------|--------|
| NFR-01 | Initial page load (4G) | < 3 seconds | TRD §3.7 |
| NFR-02 | Subsequent load (cached) | < 1 second | TRD §3.7 |
| NFR-03 | Receipt generation time | < 1 second | TRD §3.7 |
| NFR-04 | Bill submission perceived time | < 200ms | TRD §3.7 |
| NFR-05 | App JS payload (excl. Firebase) | < 30 KB | PRD §1 |
| NFR-06 | Excel export (1000 rows) | < 3 seconds | TRD §3.7 |
| NFR-07 | Firebase free tier headroom | 33× writes, 75× reads | PRD §3.8 |
| NFR-08 | Offline: full read + write | Firestore SDK | TRD §3.7 |
| NFR-09 | HTTPS enforced | GitHub Pages | PRD §3.6 |
| NFR-10 | CSP restricts scripts to self + Firebase CDN | Meta tag | PRD §3.6 |
| NFR-11 | Mobile-first responsive (primary: Android) | < 430px viewport | PRD §2.1 |
| NFR-12 | PWA installable | manifest.json + SW | TRD §2.2 |

---

### Security Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| SEC-01 | Firebase Auth Phone OTP — only verified phones access data | PRD SEC-001 |
| SEC-02 | Per-shop Firestore Security Rules isolation | PRD SEC-002 |
| SEC-03 | `authorized_phones` array controls access; owner manages | PRD SEC-003 |
| SEC-04 | Minimal PII (optional customer phone, authorized phones) | PRD SEC-004 |
| SEC-05 | HTTPS enforced (GitHub Pages + Firebase SDK) | PRD SEC-005 |
| SEC-06 | Firebase config safe to commit (not secret) | PRD SEC-006 |
| SEC-07 | CSP meta tag restricts script sources | PRD SEC-007 |
| SEC-08 | Exports generated client-side (no data exfiltration) | PRD SEC-008 |
