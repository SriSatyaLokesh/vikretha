# Vikretha — Roadmap

## Milestone 1: MVP (v1.0)

> **Goal:** Fully functional shop management PWA — auth, billing, receipts, dashboard, inventory, export.  
> **Timeline reference:** PRD §4.2 (5 weeks)

---

### Phase 1 — Foundation & App Shell

**Goal:** Repository scaffold, PWA infrastructure, hash router, Firebase SDK integration, and mobile-first responsive UI shell.

**Delivers:** Deployable static site on GitHub Pages with working service worker, manifest, router, and Firebase initialization. No features yet — just the skeleton.

**Requirements covered:** FR-07.1, FR-07.4, NFR-01, NFR-02, NFR-05, NFR-09, NFR-10, NFR-11, NFR-12

**Key tasks:**
- Create `index.html` with responsive viewport, CSP meta tag, theme color
- Create `shop.config.js` template (Firebase config + shop settings)
- Create `lib/firebase-init.js` (SDK init + enableIndexedDbPersistence)
- Implement hash-based router (`app.js`) with lazy ES module loading
- Create auth guard (redirect unauthenticated to `#/login`)
- Create `sw.js` (service worker — cache app shell)
- Create `manifest.json` (PWA installable)
- Mobile-first CSS layout shell (header, nav, content area)
- GitHub Pages deployment config

**UAT:**
- [ ] Site loads on GitHub Pages with HTTPS
- [ ] Service worker registers and caches app shell
- [ ] PWA install prompt appears on mobile
- [ ] Hash routes navigate between placeholder screens
- [ ] Unauthenticated user sees only login screen

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Static scaffold (index.html, shop.config.js, manifest.json, styles/main.css, .nojekyll)
- [x] 01-02-PLAN.md — JavaScript core (firebase-init.js, app.js router + auth guard, sw.js)
- [x] 01-03-PLAN.md — Human verification checkpoint

---

### Phase 2 — Authentication (Email/Password)

**Goal:** Firebase Email/Password authentication — register, sign in, session persistence, sign out, auth guard enforcement, password reset.

**Delivers:** Working login screen. Only authorized email addresses can access the app.

**Requirements covered:** FR-01.1–FR-01.10, SEC-01, SEC-02

**Depends on:** Phase 1

**Key tasks:**
- Create `modules/auth.js` (Email/Password sign-in + Create Account flow)
- Build sign-in UI (email input + password input + "Create Account" toggle)
- Firebase Email/Password auth: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`
- Implement `onAuthStateChanged` observer for session restoration
- Implement sign-out functionality
- Password reset via `sendPasswordResetEmail`
- Create Firestore Security Rules file (`firestore.rules`) — `authorized_emails` based
- Bootstrap shop config on first sign-up (`authorized_emails: [user.email]`)
- Error handling: wrong password, email not found, email already in use

**UAT:**
- [ ] Unauthenticated → full-screen sign-in, no data visible
- [ ] Correct email + password → navigates to dashboard
- [ ] Wrong password → inline error, no navigation
- [ ] Revisit (session persisted) → auto-navigates to dashboard
- [ ] Sign out → returns to sign-in screen
- [ ] "Create Account" creates Firebase account + bootstraps shop config
- [ ] "Forgot password" sends reset email
- [ ] Unauthorized email rejected by Firestore Security Rules

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — modules/auth.js (Email/Password sign-in, Create Account, Forgot Password, bootstrapShopConfig)
- [x] 02-02-PLAN.md — firestore.rules (authorized_emails Security Rules) + modules/settings.js (sign-out)
- [x] 02-03-PLAN.md — Human verification checkpoint


---

### Phase 3 — Billing & Sale Recording

**Goal:** Fast sale entry with atomic Firestore writes, offline support, and sequential Sale IDs.

**Delivers:** Complete billing flow — product search, cart, discount, submit, offline queue with sync indicator.

**Requirements covered:** FR-02.1–FR-02.9, NFR-04, NFR-08

**Depends on:** Phase 2

**Key tasks:**
- Create `modules/billing.js`
- Build "New Sale" button on dashboard
- Product search UI (from inventory collection, fuzzy filter)
- Cart: quantity input, line totals, auto-calculating total
- Discount field (% or ₹ toggle)
- Optional customer phone number field
- Sequential Sale ID generation via Firestore transaction (counter doc)
- Offline Sale ID fallback (timestamp-based)
- Atomic batch write: sale doc + stock decrement + summary update
- ⏳ sync indicator (pending hasPendingWrites metadata)
- Optimistic UI — immediate receipt navigation

**UAT:**
- [ ] "New Sale" button visible on dashboard
- [ ] Product search filters inventory list
- [ ] Cart total updates in real-time as items added
- [ ] Discount applies correctly (% and ₹)
- [ ] Submit creates sale in Firestore with correct Sale ID format
- [ ] Stock decremented atomically
- [ ] Summary counters updated atomically
- [ ] < 200ms perceived submission time
- [ ] Offline: sale queued, ⏳ shown, syncs when online

---

### Phase 4 — Receipt Generation & WhatsApp Share

**Goal:** Canvas 2D receipt image generation with download and WhatsApp sharing.

**Delivers:** Professional receipt PNG generated client-side, shareable via native share sheet or wa.me link.

**Requirements covered:** FR-03.1–FR-03.5, NFR-03

**Depends on:** Phase 3

**Key tasks:**
- Create `modules/receipt.js`
- Canvas 2D receipt layout: header (shop name, date, Sale ID), items table, totals, footer
- Render receipt from sale data immediately after submission
- "Download Receipt" button (Canvas → PNG → download)
- "Share via WhatsApp" (Web Share API with file → `wa.me` fallback)
- Pre-fill customer phone number in wa.me link if provided
- Pre-written share message: shop name, Sale ID, total
- Mobile viewport optimization (< 430px canvas width)

**UAT:**
- [ ] Receipt image generated in < 1 second after sale
- [ ] Receipt displays all required fields (shop, date, Sale ID, items, totals)
- [ ] PNG downloads correctly to device
- [ ] WhatsApp share opens with correct message + image (on supported devices)
- [ ] Fallback wa.me link works when Web Share API unavailable
- [ ] Receipt renders correctly on mobile viewports

---

### Phase 5 — Dashboard & Reports

**Goal:** Real-time dashboard with summary cards, 7-day chart, monthly reports, and sync status.

**Delivers:** At-a-glance business insights — today/week/month stats, trend visualization, monthly drill-down.

**Requirements covered:** FR-04.1–FR-04.7, NFR-04

**Depends on:** Phase 3

**Key tasks:**
- Create `modules/dashboard.js`
- Three summary cards (Today, Week, Month) — count + revenue
- Real-time `onSnapshot` listener on `summary` document
- CSS bar chart for last 7 days revenue
- "Last synced" timestamp + cache/online indicator
- Monthly report view: month picker, revenue + count
- Top 5 products by revenue (query with date-range filter)
- Firestore composite index (sales → timestamp DESC)

**UAT:**
- [ ] Summary cards show correct today/week/month data
- [ ] Cards update in real-time when new sale submitted (another tab/device)
- [ ] 7-day bar chart renders proportional heights
- [ ] Dashboard loads instantly from cache (then updates from server)
- [ ] Sync status shows ⏳ offline / ✓ synced
- [ ] Monthly report shows correct data for selected month
- [ ] Top 5 products listed correctly

---

### Phase 6 — Inventory Management

**Goal:** Full CRUD for inventory items with low-stock alerts and offline-first loading.

**Delivers:** Inventory list with add/edit capabilities, visual low-stock flags.

**Requirements covered:** FR-05.1–FR-05.5

**Depends on:** Phase 2

**Key tasks:**
- Create `modules/inventory.js`
- Inventory list view (name, unit, stock, price per item)
- Low-stock visual flag (items below threshold)
- "Add Item" form (name, unit, price, quantity, low-stock threshold)
- "Edit Item" form (update price, quantity, threshold)
- Delete item (with confirmation)
- All operations via Firestore SDK (offline-capable)
- Sort/filter inventory (by name, by stock status)

**UAT:**
- [ ] Inventory loads instantly from Firestore cache
- [ ] Low-stock items visually flagged
- [ ] Add new item → appears in list
- [ ] Edit item → changes reflected
- [ ] Stock decrements correctly after billing
- [ ] Works fully offline (reads from cache, writes queued)

---

### Phase 7 — Data Export (Excel)

**Goal:** Client-side Excel export for sales and inventory data.

**Delivers:** One-click `.xlsx` download for sales (monthly/all) and inventory snapshot.

**Requirements covered:** FR-06.1–FR-06.8

**Depends on:** Phase 5, Phase 6

**Key tasks:**
- Create `modules/export.js`
- Lazy-load SheetJS from CDN on first export
- "Export" button on dashboard with dropdown: Sales (month), Sales (all), Inventory
- Sales export: columns per spec (Sale ID, Date, Items, Qty, Subtotal, Discount, Total, Phone)
- Inventory export: columns per spec (ID, Name, Unit, Price, Stock, Threshold, Status)
- File naming: `{shop_name}_sales_{YYYY-MM}.xlsx` / `{shop_name}_inventory_{date}.xlsx`
- Progress indicator for >1000 rows
- Works offline (from Firestore cached data)

**UAT:**
- [ ] Export button visible on dashboard
- [ ] Sales (month) export generates correct .xlsx file
- [ ] Sales (all) export works for large datasets
- [ ] Inventory export generates correct .xlsx file
- [ ] File names follow convention
- [ ] Progress indicator shown for large exports
- [ ] Export works offline

---

### Phase 8 — Staff Management & Settings

**Goal:** Shop owner can manage authorized staff email addresses and app settings.

**Delivers:** Settings screen with staff management (add/remove phones) and sign-out.

**Requirements covered:** FR-01.9, FR-01.7

**Depends on:** Phase 2

**Key tasks:**
- Create `modules/settings.js`
- Settings screen with staff email list
- Add staff email address (validates email format)
- Remove staff email address (with confirmation)
- Update `authorized_emails` array in shop config document
- Sign out button
- Display current user email address

**UAT:**
- [ ] Settings accessible from navigation
- [ ] Current authorized phones listed
- [ ] Add phone → staff can now log in
- [ ] Remove phone → staff loses access
- [ ] Sign out clears session completely

---

### Phase 9 — Documentation & Polish

**Goal:** Setup documentation, deployment guide, and final polish for fork-and-go experience.

**Delivers:** Complete README, security rules template, demo site, and < 30 minute setup time.

**Requirements covered:** FR-07.2, FR-07.3, NFR-05

**Depends on:** Phase 1–8

**Key tasks:**
- Comprehensive README with setup walkthrough (fork → Firebase → config → deploy)
- Screenshot guide for Firebase Console steps
- `firestore.rules` file ready for copy-paste
- `shop.config.js` reference documentation
- Demo site with sample data on GitHub Pages
- Final bundle size audit (< 30 KB app JS)
- Cross-browser testing (Chrome Android, Chrome Desktop, Safari iOS)
- Accessibility pass (color contrast, touch targets)
- Performance audit (Lighthouse)

**UAT:**
- [ ] New user can go from fork to working app in < 30 minutes
- [ ] README covers all steps clearly
- [ ] Security rules work when copy-pasted
- [ ] App JS < 30 KB (excluding Firebase SDK)
- [ ] Lighthouse PWA score > 90
- [ ] Works on Chrome Android + Desktop + Safari iOS

---

## Backlog (Post-MVP)

| ID | Item | Notes |
|----|------|-------|
| 999.1 | GST/tax line on receipt | Config flag |
| 999.2 | Barcode scan via camera | ZXing.js |
| 999.3 | Multi-currency support | Config-driven |
| 999.4 | PDF export | Receipt + monthly report |
| 999.5 | Google Drive backup | Firebase Extension |
| 999.6 | Sales analytics (trends, growth %) | Derived from existing data |
| 999.7 | Multi-language (Hindi, Telugu, Tamil, Kannada) | i18n module |
| 999.8 | Custom domain setup guide | GitHub Pages CNAME |

