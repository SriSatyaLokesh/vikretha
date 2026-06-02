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

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — modules/billing.js (product search, cart, discount, Sale ID transaction, atomic batch write, ⏳ sync indicator)
- [x] 03-02-PLAN.md — modules/dashboard.js (New Sale CTA + summary placeholder cards)
- [x] 03-03-PLAN.md — Human verification checkpoint

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

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — app.js sub-route fix + modules/receipt.js (Canvas 2D receipt, download, WhatsApp share) + receipt styles
- [x] 04-02-PLAN.md — Human verification checkpoint

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

**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — Live summary cards + 7-day CSS bar chart + last synced (modules/dashboard.js rewrite)
- [x] 05-02-PLAN.md — Monthly report + top 5 products (month picker + Firestore range query)
- [x] 05-03-PLAN.md — Human verification checkpoint

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
- [x] Inventory loads instantly from Firestore cache
- [x] Low-stock items visually flagged
- [x] Add new item → appears in list
- [x] Edit item → changes reflected
- [x] Stock decrements correctly after billing
- [x] Works fully offline (reads from cache, writes queued)

**Plans:** 2 plans

Plans:
- [x] 06-01-PLAN.md — modules/inventory.js (list, onSnapshot, low-stock badges, sort/filter, add/edit/delete modals)
- [x] 06-02-PLAN.md — Human verification checkpoint

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

**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md — modules/export.js (SheetJS lazy-load, sales month/all/inventory exports, progress overlay) + CSS Section 18
- [x] 07-02-PLAN.md — Wire Export menu into dashboard.js + human verification checkpoint

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

**Plans:** 2 plans

Plans:
- [x] 08-01-PLAN.md — modules/settings.js (staff email list, add/remove with arrayUnion/arrayRemove) + CSS Section 19
- [x] 08-02-PLAN.md — Human verification checkpoint

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
**Plans:** 3 plans

Plans:
- [x] 09-01-PLAN.md — README.md + shop.config.js.template (setup guide + credentials-safe config template)
- [x] 09-02-PLAN.md — scripts/seed-demo.js (demo data) + accessibility fixes (aria-labels, touch targets)
- [x] 09-03-PLAN.md — Bundle size audit + human verification checkpoint (Lighthouse, cross-browser)

---

### Phase 10 — Modern Responsive Redesign (2026)

**Goal:** Full visual overhaul — modern 2026 design system with a dark sidebar on desktop, responsive bottom nav on mobile, Inter typography, and orange-on-slate color palette. The app currently renders mobile-only; this phase makes it fully responsive from 375px phone to 1440px desktop.

**Delivers:** New main.css design system, updated app shell, and redesigned UI for all 6 modules.

**Requirements covered:** NFR-05, NFR-09, NFR-11, NFR-12

**Depends on:** Phase 9

**Key tasks:**
- Replace CSS custom properties with modern token system (slate palette + orange primary)
- Add Inter font via Google Fonts (preloaded)
- Responsive layout: dark fixed sidebar (≥1024px) + bottom nav (<1024px)
- Redesign all module HTML templates: auth, dashboard, billing, inventory, receipt, settings
- Desktop-optimized layouts: split panels for billing, data tables for inventory, sidebar-within-settings
- 7-day bar chart improvements (grid lines, value labels)

**Status:** ✅ Complete (2026-06-01)

**UAT:**
- [x] App renders correctly at 375px, 768px, 1024px, 1440px
- [x] Sidebar visible and functional on desktop; hidden on mobile
- [x] Bottom nav visible on mobile; hidden on desktop
- [x] All interactive elements meet 44px touch target
- [x] Inter font loads and renders
- [x] Receipt redesigned — retro thermal monospace style (Courier New, torn edges, paper texture)
- [x] Billing fixed — nested button bug resolved, mobile cart bar added

**Plans:** 4 plans

Plans:
- [x] 10-01-PLAN.md — CSS design system + index.html + app.js shell (design tokens, Inter font, responsive layout)
- [x] 10-02-PLAN.md — Auth + Dashboard + Billing + Inventory + Receipt module redesigns
- [x] 10-03-PLAN.md — Retro thermal receipt canvas (torn edges, Courier New, paper texture)
- [x] 10-04-PLAN.md — Billing nested-button fix + mobile cart bar

---

### Phase 11 — Firestore Architecture Hardening

**Goal:** Role-based security rules, date-sharded aggregation, and optimized dashboard reads per ADR-0001.

**Delivers:** Secure RBAC, immutable sales, daily/monthly summary docs, 93% read reduction on dashboard.

**Requirements covered:** ADR-0001-SEC, ADR-0001-PERF, ADR-0001-AGG, ADR-0001-BACKFILL

**Depends on:** Phase 10 (all existing phases complete)

**Key tasks:**
- Rewrite firestore.rules with role-based access (owner/admin/cashier)
- Add write validation (required fields, type checks, immutable sales)
- Extend billing batch with daily_summary + monthly_summary writes
- Bootstrap owner role in auth.js config creation
- Migrate dashboard to read from date-sharded summaries (8 reads vs 100+)
- Remove legacy summary/totals writes
- Create backfill script for existing sales data

**UAT:**
- [ ] Security rules deployed and enforcing RBAC
- [ ] Billing writes daily_summary + monthly_summary atomically
- [ ] Dashboard reads from sharded docs (not sales scan)
- [ ] Sales are immutable (update/delete denied by rules)
- [ ] Backfill script works for existing data
- [ ] Owner role set on first bootstrap

**Plans:** 3 plans

Plans:
- [x] 11-01-PLAN.md — Security rules v2 + billing summary writes + auth owner bootstrap
- [x] 11-02-PLAN.md — Dashboard migration to date-sharded reads + backfill script + remove legacy summary
- [x] 11-03-PLAN.md — Human verification checkpoint


---

### Phase 12 — Customer Contact & Autofill

**Goal:** Store customer name + phone in a customers collection; enable phone typeahead in billing with auto-fill of customer name; display customer name on receipt.

**Delivers:** Billing screen with phone autocomplete (live search as user types), customer name auto-populated when a known number is selected, unknown customers saved automatically, and customer name rendered on the receipt canvas.

**Requirements covered:** FR-02.9, FR-03.5

**Depends on:** Phase 4, Phase 11

**Key tasks:**
- Create customers Firestore subcollection under shop doc (fields: 
ame, phone, lastSaleAt)
- Update modules/billing.js: phone input with datalist/dropdown autocomplete, auto-fill name on selection, upsert customer on sale submit
- Update modules/receipt.js: render customer name on canvas (below Sale ID header)

**UAT:**
- [ ] Typing a phone number in billing shows matching customer suggestions
- [ ] Selecting a suggestion auto-fills the customer name field
- [ ] Submitting a sale with a new phone + name saves customer to Firestore
- [ ] Next time same phone is entered, name auto-fills
- [ ] Receipt canvas shows customer name when available
- [ ] Receipt still renders correctly when no customer name provided

**Plans:** 2 plans

Plans:
- [x] 12-01-PLAN.md — customers Firestore collection + billing.js phone autocomplete + name autofill + upsert on submit
- [x] 12-02-PLAN.md — receipt.js canvas update to show customer name + human verification checkpoint
---


### Phase 13 — Inventory Item Sizes & Piece Variant Quantities

**Goal:** Enforce correct unit types in inventory (pieces locked by default; liquid units hidden unless "Other" chosen), allow size-variant configuration for piece-type items (width, dimension, PSI), track per-size quantities, and display size details in billing cart and on the receipt.

**Delivers:** Inventory add/edit form defaults to "Pieces" unit (CG/litres hidden unless "Other" selected). Piece-type items can have size variants (width, size label, optional PSI, per-size stock). Billing cart shows selected size alongside product name. Receipt canvas renders size info per line item. Low-stock flag triggers if any size variant is below threshold.

**Requirements covered:** FR-05.1, FR-05.2, FR-02.1, FR-03.1

**Depends on:** Phase 6, Phase 3, Phase 4

**Key tasks:**
- Inventory add/edit: unit field defaults to "Pieces"; liquid units (CG, litres) hidden unless user taps "Other"
- Inventory add/edit: "Does this item have sizes?" toggle for piece-type items
- Size variant form: width field, size/dimension label field, PSI field (optional), stock quantity per size
- Firestore schema: `sizes[]` array on inventory item doc (fields: label, width, psi, stock)
- Billing: when adding a sized item to cart, show size picker (dropdown/radio)
- Cart line item displays product name + selected size label
- Atomic batch write: decrement per-size stock on billing submit
- Receipt canvas: render size label on each line item that has a size
- Low-stock badge: flag item if any size variant stock falls below threshold

**UAT:**
- [ ] Inventory add form shows "Pieces" unit by default; liquid units visible only when "Other" is tapped
- [ ] Piece-type item with sizes toggle: can add multiple size variants (width, label, PSI, qty)
- [ ] Each size variant has its own stock quantity
- [ ] In billing, adding a sized item shows a size picker before it enters the cart
- [ ] Cart line item shows product name + selected size label
- [ ] Sale submission decrements the correct per-size stock
- [ ] Receipt shows size label next to each line item that has one
- [ ] Low-stock flag appears on item if any one size variant is below threshold

**Plans:** 3 plans

Plans:
- [ ] 13-01-PLAN.md — modules/inventory.js: unit type toggle (Pieces/Other) + size variants CRUD + isLow update
- [ ] 13-02-PLAN.md — modules/billing.js size picker + composite cart + per-size batch decrement; receipt.js size label canvas
- [ ] 13-03-PLAN.md — Human verification checkpoint

---

### Phase 14 — Ad-hoc Items in Billing

**Goal:** Allow shop staff to add custom one-off line items during a sale — items that don't exist in inventory — by typing a name and price inline. After the sale is submitted, optionally prompt to save the ad-hoc item to inventory for future reuse.

**Delivers:** "Add custom item" entry in the billing product grid / cart area. Staff types item name + price → item enters cart like a regular product but marked as ad-hoc. On sale submission success, a bottom-sheet prompt asks "Add this item to inventory?" with an optional quantity-on-hand field. Accepting creates the inventory doc; dismissing skips silently.

**Requirements covered:** FR-02.1, FR-05.1

**Depends on:** Phase 3, Phase 6

**Key tasks:**
- Billing: "Other item +" button in product grid or at bottom of cart section
- Custom item entry form: name (required) + price (required) fields, inline in billing
- Ad-hoc cart entry: same structure as inventory item but with `adhoc: true`, no `id` (or ephemeral ID), no stock decrement in batch write
- Sale doc stores ad-hoc items with `adhoc: true` flag; receipt renders them identically to regular items
- Post-submit prompt: bottom-sheet "Save 'ItemName' to inventory for future use?" with optional stock and unit fields
- Accepting prompt: creates Firestore inventory doc (name, price, unit, stock if provided)
- Dismissing prompt: no action, UX continues normally
- Multiple ad-hoc items in one sale: prompt shown once per unique ad-hoc item sequentially

**UAT:**
- [ ] "Other item +" button visible in billing screen
- [ ] Typing name + price adds item to cart immediately
- [ ] Ad-hoc cart rows display correctly (name, price, qty stepper)
- [ ] Sale submits successfully with mixed inventory + ad-hoc items
- [ ] Inventory stock decremented only for regular items (ad-hoc items skipped)
- [ ] Receipt shows ad-hoc items identically to regular items
- [ ] Post-submit prompt appears for each unique ad-hoc item
- [ ] Accepting saves item to inventory; item appears in inventory list
- [ ] Dismissing skips silently, no errors

**Plans:** 2 plans

Plans:
- [x] 14-01-PLAN.md — modules/billing.js: adhoc item entry + cart integration + skip stock decrement + sale doc flag
- [x] 14-02-PLAN.md — Post-submit save-to-inventory prompt + human verification checkpoint

---
### Phase 15 -- Sales History & Bill Management

**Goal:** Sales history list with search and date-range filter, re-send receipt for any past sale via WhatsApp, and owner-only bill editing with an audit trail.

**Delivers:** A dedicated Sales History screen showing all past sales (paginated, filterable). Tapping a sale shows the full receipt detail and allows re-sharing it. Owner role can edit a past bill's line items, quantities, discount, and totals -- changes are saved with an audit record.

**Requirements covered:** FR-04.8 (sales history list), FR-04.9 (resend receipt), FR-04.10 (owner bill editing)

**Depends on:** Phase 4, Phase 11

**Key tasks:**
- Create `modules/sales-history.js`
- Sales history list: paginated (25/page), reverse-chronological, date-range picker, search by customer name/phone or Sale ID
- Sale detail view: full receipt data (line items, totals, customer, Sale ID, date) with "Resend Receipt" button
- Resend receipt: regenerate canvas receipt from stored sale doc -- Web Share API / wa.me fallback
- Bill editing (owner-only via RBAC):
  - "Edit Bill" button visible only when shopConfig.role === 'owner'
  - Inline edit form: modify line items (name, qty, price), change discount, recalculate total
  - Firestore updateDoc on save (owner exempt from immutability rule -- amend security rule)
  - Audit fields written on update: editedAt, editedBy, originalTotal, amendedTotal
  - Receipt regenerated and re-rendered from updated doc after save

**UAT:**
- [ ] Sales History accessible from nav/dashboard
- [ ] List shows all past sales, most recent first
- [ ] Date-range filter narrows the list correctly
- [ ] Search by customer name, phone, or Sale ID works
- [ ] Tapping a sale opens detail view with all receipt data
- [ ] "Resend Receipt" re-generates canvas and opens share sheet / wa.me
- [ ] "Edit Bill" button visible only to owner role (hidden for cashier/admin)
- [ ] Owner can modify line items, quantities, prices, and discount
- [ ] Saving edits updates sale doc and shows amended totals
- [ ] Audit fields (editedAt, editedBy, originalTotal, amendedTotal) stored on doc
- [ ] Receipt re-renders correctly from amended data
- [ ] Cashier cannot edit bills (rule denies write)

**Plans:** To be planned

Plans:
- [ ] (plans TBD -- run /gsd-plan-phase 15)

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


