# Vikretha — Roadmap

## Milestone 2: Polish & Features (v1.1)

> **Goal:** High-fidelity UI with theme palettes, dark mode, smooth animations, live SVG charts, customer order history, branded receipts, and easier setup.  
> **Phases:** 17–22 (continuing from Milestone 1)

---

### Phase 17 — Theme System & Dark Mode

**Goal:** Six predefined color palettes + dark mode toggle, persisted to Firestore and applied instantly via CSS custom properties.

**Delivers:** Settings screen gains a visual theme picker; dark mode toggle. The app's color scheme changes live without reload.

**Requirements covered:** FR-08.1–FR-08.6

**Depends on:** Phase 10 (CSS custom property architecture already in place)

**Key tasks:**
- Define 6 palette sets in `styles/main.css` as CSS custom property override blocks (data-theme attribute)
- Add `THEME_PALETTES` constant to `shop.config.js` (palette names + primary/accent/surface hex values)
- `modules/settings.js` — add Theme section: visual swatch grid (6 palettes); active state ring
- `modules/settings.js` — add Dark Mode toggle (persists to `config/main.darkMode`)
- `lib/firebase-init.js` — on init, read `config/main.theme` + `config/main.darkMode`; apply `data-theme` + `data-dark` on `<html>`
- Write selected theme + dark mode back to Firestore `config/main` on change
- Ensure all 8 modules render correctly in each palette + dark mode

**UAT:**
- [ ] Settings shows 6 palette swatches with visible active indicator
- [ ] Tapping a palette updates the app color instantly (no reload)
- [ ] Dark mode toggle switches background, text, and surface colors across all screens
- [ ] Theme + dark mode preference survives page reload
- [ ] Theme preference syncs across devices (stored in Firestore)
- [ ] All existing screens (billing, inventory, receipt, reports) look correct in all palettes + dark mode

**Plans:** 3 plans

Plans:
- [x] 17-01-PLAN.md — CSS palette architecture + `data-theme`/`data-dark` on `<html>` + dark mode overrides in main.css
- [x] 17-02-PLAN.md — Settings theme picker + dark mode toggle + Firestore persist + init-time apply in firebase-init.js
- [x] 17-03-PLAN.md — Human verification checkpoint

---

### Phase 18 — Animation & Toast Notification System

**Goal:** Replace all `alert()`/`confirm()` calls with a non-blocking toast system; add page transitions, bottom-sheet slide-up, and cart entry/removal animations.

**Delivers:** App feels native-quality. Feedback is visual and non-blocking. Transitions guide the user's eye between screens.

**Requirements covered:** FR-09.1–FR-09.8, NFR-13, NFR-17

**Depends on:** Phase 17 (CSS custom properties stable)

**Key tasks:**
- Create `lib/toast.js` — toast manager: `toast.success()`, `toast.error()`, `toast.warn()`, `toast.info()`; max 5 stack; auto-dismiss 3s; slide-in/slide-out CSS animation
- Add `#toast-container` to `index.html` (fixed bottom-right, z-index above modals)
- Replace every `alert()` / `confirm()` / `window.alert()` across all modules with `toast.*` calls
- `app.js` router — add CSS class `page-enter` on route change; CSS transition slides old page out + new page in (200ms)
- `styles/main.css` — `.page-enter`, `.page-exit` keyframes; `.sheet-enter` for bottom sheets; `.cart-item-enter`, `.cart-item-exit` for billing rows
- `modules/billing.js` — wrap cart row add/remove in animation classes; use `requestAnimationFrame` for smooth height collapse
- `@media (prefers-reduced-motion: reduce)` block — sets all transition durations to 0ms

**UAT:**
- [ ] Sale submitted → green toast "Sale recorded ✓" appears bottom-right, auto-dismisses in 3s
- [ ] Error (e.g. empty cart submit) → red toast "Add at least one item"
- [ ] Navigating between screens shows a slide transition
- [ ] Adding item to cart → row slides/fades in
- [ ] Removing item → row collapses before disappearing
- [ ] Bottom sheets (add inventory, ad-hoc item) slide up from bottom
- [ ] With `prefers-reduced-motion` enabled → all animations skipped, toasts appear instantly

**Plans:** 3 plans

Plans:
- [x] 18-01-PLAN.md — `lib/toast.js` + `#toast-container` in index.html + CSS animations in main.css
- [x] 18-02-PLAN.md — Replace all alert/confirm with toast; add page transitions in app.js; cart entry/exit animations in billing.js
- [x] 18-03-PLAN.md — Human verification checkpoint
- [x] 18-04-PLAN.md — Three-primitive colour system refactor (fg/bg/accent + surface scale); 25 dark-mode overrides → 6

---

### Phase 19 — Live SVG Dashboard Charts

**Goal:** Replace the CSS flexbox bar chart with an inline SVG chart; add a real-time today counter that increments live as sales are recorded.

**Delivers:** Dashboard feels alive. Revenue visualization is professional and interactive. Today's counter updates without refresh.

**Requirements covered:** FR-10.1–FR-10.5, NFR-14

**Depends on:** Phase 11 (daily_summary collection drives chart data)

**Key tasks:**
- Create `lib/svg-chart.js` — `drawAreaChart(container, data, options)`: pure SVG, no library; area + line + axis labels + hover tooltip via `<title>` element
- `modules/dashboard.js` — replace `.bar-chart-wrap` block with `svg-chart.js` call; pass last-7-day `daily_summary` data
- `modules/dashboard.js` — add "Today" live counter widget: small real-time sale count badge, updated on each `onSnapshot` event from `daily_summary/{today}`
- Ensure SVG chart is responsive (viewBox-based, scales to container width)
- `styles/main.css` — chart area styles (grid lines, tooltip, axis text)

**UAT:**
- [ ] Dashboard shows an SVG area chart (not CSS bars) for the 7-day revenue
- [ ] Chart has day labels on the x-axis and proportional area fill
- [ ] Hovering a data point (desktop) shows a tooltip with exact revenue
- [ ] Today counter increments live when a new sale is recorded (test with two browser tabs)
- [ ] Chart reflows correctly on mobile (≤ 430px) — no overflow
- [ ] Days with zero revenue show a baseline point (not broken)

**Plans:** 2 plans

Plans:
- [ ] 19-01-PLAN.md — `lib/svg-chart.js` + dashboard chart integration + live today counter
- [ ] 19-02-PLAN.md — Human verification checkpoint

---

### Phase 20 — Customer Order History

**Goal:** Customer lookup in Reports — enter a phone number, see all past bills for that customer with aggregate stats.

**Delivers:** Shop owner can look up a customer's lifetime spend, bill count, and view individual bills. Accessible from the receipt screen.

**Requirements covered:** FR-11.1–FR-11.5

**Depends on:** Phase 12 (customers collection), Phase 15 (reports detail panel)

**Key tasks:**
- `modules/reports.js` — add "Customers" tab alongside "Sales" in the reports screen
- Customer search input (phone number); debounced 300ms query against `customers` collection
- Customer result panel: name, phone, total spend (sum of sale totals), bill count, last sale date
- Tappable bill list (Firestore query: `sales` where `customer_phone == X` ordered by timestamp DESC, paginated 25)
- Tapping a bill → opens existing sale detail panel (reuse `_renderDetailPanel`)
- Receipt screen — add "Customer history →" link (only if customer phone was captured)
- `styles/main.css` — customer panel layout styles

**UAT:**
- [ ] Reports screen shows "Sales" and "Customers" tabs
- [ ] Typing a phone number in Customers tab shows matching customer (or "No customer found")
- [ ] Customer panel shows correct name, total spend, bill count, last sale date
- [ ] Tapping a past bill opens the full sale detail panel
- [ ] "Customer history →" link on receipt screen navigates to that customer's panel
- [ ] Pagination works: "Load more" shows older bills beyond 25

**Plans:** 3 plans

Plans:
- [ ] 20-01-PLAN.md — Customers tab in reports: search, result panel, bill list, CSS
- [ ] 20-02-PLAN.md — Receipt screen "Customer history →" link
- [ ] 20-03-PLAN.md — Human verification checkpoint

---

### Phase 21 — Branded Receipt

**Goal:** Render shop logo and a custom "thank you" footer message on the Canvas receipt. Both configurable via Settings.

**Delivers:** Receipts look professional and on-brand. Shop owner sets logo URL and footer text once in Settings; every receipt includes them automatically.

**Requirements covered:** FR-12.1–FR-12.4

**Depends on:** Phase 4 (receipt.js Canvas logic)

**Key tasks:**
- `modules/settings.js` — add "Receipt Branding" section: "Logo URL" input + "Footer text" textarea; save to `config/main.receiptLogoUrl` + `config/main.receiptFooter`
- `modules/receipt.js` — read `receiptLogoUrl` and `receiptFooter` from shop config (loaded from Firestore on init)
- Receipt canvas: draw logo image at top (with graceful fallback — timeout or `onerror` draws placeholder box); draw footer text at bottom in italic
- Update `lib/firebase-init.js` to expose `getShopConfig()` helper so receipt.js can access live config values
- Maintain < 1s receipt generation including logo (async `Image` load with 2s timeout fallback)

**UAT:**
- [ ] Settings → Receipt Branding section shows Logo URL + Footer text inputs
- [ ] Save branding → receipt immediately shows logo + footer on next bill
- [ ] Logo renders at correct size/position on receipt canvas
- [ ] If logo URL is empty or fails to load → receipt renders without logo (no crash, no blank receipt)
- [ ] Footer text appears at bottom of receipt canvas
- [ ] Downloaded PNG includes logo + footer

**Plans:** 2 plans

Plans:
- [ ] 21-01-PLAN.md — Settings branding fields + receipt.js canvas integration (logo + footer)
- [ ] 21-02-PLAN.md — Human verification checkpoint

---

### Phase 22 — Setup Simplification

**Goal:** Reduce time-to-first-use for new shop owners: runtime config validation, CLI rules deploy script, and improved README.

**Delivers:** Missing Firebase config shows a clear on-screen error (not a silent JS crash). Firestore rules can be deployed with one command. README has copy-pasteable setup commands.

**Requirements covered:** FR-13.1–FR-13.4, NFR-05

**Depends on:** Phase 1 (shop.config.js structure)

**Key tasks:**
- `lib/firebase-init.js` — validate `FIREBASE_CONFIG` on init: check `apiKey`, `projectId`, `appId` are non-empty strings; if invalid, render a full-screen "Setup Required" panel with instructions instead of crashing
- `app.js` — validate `SHOP_ID` and `SHOP_NAME` non-empty on startup; show setup banner if missing
- `scripts/deploy-rules.js` — Node.js script: reads `firestore.rules` from repo root, calls `firebase deploy --only firestore:rules` via `child_process.exec`; prints coloured success/error output
- `shop.config.js.template` — expand all inline comments with examples for every field
- `README.md` — new "Quick Setup (3 commands)" section with copy-pasteable Firebase CLI commands

**UAT:**
- [ ] With `FIREBASE_CONFIG.apiKey` set to empty string → app shows "Setup Required" panel (not blank screen or JS error)
- [ ] `node scripts/deploy-rules.js` runs successfully and reports deployed rules version
- [ ] `shop.config.js.template` has a comment + example for every exported field
- [ ] README Quick Setup section is self-contained (no external docs needed for basic setup)

**Plans:** 2 plans

Plans:
- [ ] 22-01-PLAN.md — firebase-init.js validation + setup banner + scripts/deploy-rules.js
- [ ] 22-02-PLAN.md — shop.config.js.template comments expansion + README Quick Setup + human verification checkpoint

---

### Phase 23 — Full-Spectrum Theme Palettes

**Goal:** Expand each theme palette from accent-only (4 tokens) to full light+dark color sets — background, surface, sidebar, foreground, and border tokens — giving shop owners predefined curated complete themes rather than just accent color swaps.

**Delivers:** Theme picker in Settings shows visually distinct full-palette previews. Dark mode respects the chosen theme's dark variant (e.g. true-black vs slate-grey). Each palette feels like a distinct visual identity, not just a color tint.

**Requirements covered:** FR-08.7, FR-08.8

**Depends on:** Phase 17 (data-theme/data-dark CSS architecture), Phase 22 (shop.config.js THEME_PALETTES structure)

**Background:** Currently `[data-theme="X"]` only overrides `--primary`, `--primary-hover`, `--primary-light`, `--primary-ring` (accent color). The dark mode is one shared layer (`[data-dark="true"]`) with slate-based backgrounds for all themes. This means gold+dark and violet+dark look identical in their dark backgrounds — only the accent differs.

**Key tasks:**
- Design token expansion: define `--bg-app`, `--bg-surface`, `--bg-elevated`, `--bg-sidebar`, `--text-primary`, `--text-secondary`, `--border` for both light and dark variants of each theme
- CSS: add `[data-theme="X"]` light overrides and `[data-theme="X"][data-dark="true"]` dark overrides per palette
- Curated palette set (8 themes × 2 modes):
  - **Slate** (default dark): slate-900 sidebar, slate-50 bg — current behavior, baseline
  - **True Black**: `#000000` bg-app, `#0a0a0a` surface, pure white text — OLED-friendly
  - **Warm**: cream white bg (`#fffdf7`), warm-grey sidebar (`#2d2416`), amber sidebar active
  - **Nord**: cool blue-grey dark (`#2e3440`), frost white light (`#eceff4`) — Nordic feel
  - **Sepia**: parchment bg (`#f5f0e8`), dark brown sidebar (`#2c1a0e`) — document/print feel
  - Plus existing orange/emerald/sky/violet/rose/gold — enhanced with proper dark backgrounds
- `shop.config.js` + template: update THEME_PALETTES entries with `darkBg` and `lightBg` preview hex for the swatch renderer
- Settings theme picker: update swatch component to show a mini light+dark preview chip (not just primary color dot)
- `lib/firebase-init.js` — `applyTheme()` already handles `data-theme` + `data-dark` — no change needed

**UAT:**
- [ ] Switching to "True Black" theme + dark mode → page background is `#000000`, not slate-900
- [ ] Switching to "Warm" theme + light mode → page background is cream, sidebar is warm-brown
- [ ] Each theme swatch in Settings shows a small light/dark preview (not just a color circle)
- [ ] Switching themes in light mode changes backgrounds visibly (not just the accent color)
- [ ] All 8 themes × light+dark combinations render all screens without contrast failures
- [ ] Theme + dark mode preference persists across reload (Firestore sync unchanged)

**Plans:** 2 plans

Plans:
- [x] 23-01-PLAN.md — CSS full-spectrum token blocks (4 new themes + dark variants for existing) + THEME_PALETTES metadata
- [x] 23-02-PLAN.md — Settings theme picker swatch grid + Firestore persist + loadThemeFromFirestore update + UAT checkpoint

---

### Phase 24 — Admin Settings Panel (/adminSettings)

**Goal:** Move all owner-level configuration out of the general Settings screen into a dedicated `/adminSettings` route. Only users with `staff_roles[email] == 'owner'` can access it. Dark mode / light mode toggle moves to the nav bar and remains client-side only (localStorage, no Firestore).

**Delivers:** Clean separation of concerns — general settings (dark mode, sign out) accessible by all staff; shop configuration (name, branding, theme, receipt fields) owner-only and Firestore-persisted. Foundation for future admin capabilities.

**Requirements covered:** FR-14.1–FR-14.8

**Depends on:** Phase 8 (staff roles model), Phase 17 (theme system), Phase 21 (receipt branding), Phase 23 (theme picker)

**Data model changes:**
- `config/main.shopName` (string) — overrides SHOP_NAME from shop.config.js when set
- `config/main.receiptLogoUrl` (string) — overrides LOGO_URL from shop.config.js
- `config/main.receiptFooter` (string) — overrides RECEIPT_FOOTER from shop.config.js
- `config/main.theme` (string) — already used by Phase 23 theme picker (just moving the UI)
- Dark mode: **removed from Firestore** — becomes `localStorage['vk_dark']` only (already partly the case)

**Key tasks:**

`modules/adminSettings.js` — new module, export `render(container)`:
- Guard: read `config/main`, check `staff_roles[currentEmail] == 'owner'`; if not owner → show "Access denied" panel
- **Shop Identity section:** editable `shopName` field (saved to `config/main.shopName`); shown in header/sidebar live after save via DOM update
- **Receipt Branding section:** Logo URL input + Receipt Footer textarea (moved from settings.js); saves to `config/main.receiptLogoUrl` + `config/main.receiptFooter`; preview of current values
- **Theme section:** move the 11-swatch theme picker grid from `settings.js` to here; save to `config/main.theme` as before
- Save button per section (not per field); toast on success/error

`modules/settings.js` — remove Theme section (swatch grid + `_renderThemePicker`); keep: Dark mode toggle, Staff Access, Sign Out

`app.js` — add `/adminSettings` to hash router:
- Add nav item "Admin" visible only if owner role (checked after auth)
- Show in sidebar nav + mobile bottom nav only for owners
- Lazy-load `modules/adminSettings.js`

`lib/firebase-init.js` — dark mode changes:
- `loadThemeFromFirestore()` — still loads theme palette from Firestore `config/main.theme`, but dark mode preference read from `localStorage['vk_dark']` only (no Firestore read/write for dark mode)
- Remove `darkMode` field write from all call sites

`app.js` — dark mode toggle moves to the app header (top-right):
- Add a sun/moon icon button `#dark-mode-toggle` in `.app-header` (right side, inside `#header-actions`)
- Clicking it reads/writes `localStorage['vk_dark']`, calls `applyTheme(currentTheme, newDark)`
- No Firestore call

`styles/main.css` — header dark mode toggle button styles; admin settings page layout

`firestore.rules` — no changes needed (config/main writes already guarded by `isOwnerOrAdmin`)

**UAT:**
- [ ] Logged in as owner: nav shows "Admin" link; `/adminSettings` loads with all config sections
- [ ] Logged in as member/admin: `/adminSettings` shows "Access denied" (not a blank screen or crash)
- [ ] Saving Shop Name in Admin Settings → header and sidebar update live without page reload
- [ ] Saving theme in Admin Settings → app palette changes immediately (same as before)
- [ ] Saving Receipt Footer → next receipt uses the new footer text
- [ ] Dark mode toggle in nav bar works for all users (owner AND member) without Firestore call
- [ ] Dark mode preference persists across reload via localStorage (not Firestore)
- [ ] Settings screen no longer contains theme picker or receipt fields

**Plans:** 2 plans

Plans:
- [ ] 24-01-PLAN.md — modules/adminSettings.js (owner guard + shop identity + receipt branding + theme picker)
- [ ] 24-02-PLAN.md — app.js router + nav dark mode toggle + settings.js cleanup + firebase-init.js dark mode decoupling
- [ ] 24-03-PLAN.md — Human verification checkpoint

---

### Phase 25 — Billing UX Fixes & Payment Mode

**Goal:** Fix four UAT-surfaced issues and add payment mode capture to the sale flow: WhatsApp share uses the customer's phone from the sale; login screen reads shop name from Firestore config; receipt canvas uses pitch-black text/lines for print quality; billing collects Cash / UPI / Card with optional split-payment breakdown.

**Delivers:** WhatsApp receipt button opens a pre-filled chat to the customer who made the purchase. Login shows the correct configured shop name. Receipts print cleanly with black text. Cashiers record how payment was made; owners can see payment breakdown in sale history.

**Requirements covered:** FR-BUG-01, FR-BUG-02, FR-BUG-03, FR-PAY-01, FR-PAY-02, FR-PAY-03

**Depends on:** Phase 4 (receipt.js + WhatsApp share), Phase 2 (auth.js login screen), Phase 21 (receipt canvas), Phase 3 (billing submit flow), Phase 15 (sale detail panel)

**Key tasks:**
- `modules/receipt.js` — WhatsApp share: use `sale.customer_phone` (already stored on sale doc) to build `https://wa.me/{phone}?text={encoded-receipt}` URL; fall back to `WHATSAPP_NUMBER` from shop config if no customer phone on the sale
- `modules/auth.js` — login screen shop name: read `config/main.shopName` from Firestore (same getConfig pattern used elsewhere); display it in the subtitle and page title; fall back to `SHOP_NAME` from `shop.config.js` if not set
- `modules/receipt.js` — receipt canvas: change all `fillStyle` / `strokeStyle` for text, lines, and dividers to `#000000`; remove any grey or muted color assignments in the canvas draw path
- `modules/billing.js` — payment mode: add a "Payment" section to the cart panel (below Customer Name, above Submit); radio/button group for Cash / UPI / Card; "Split Payment" toggle that reveals three optional number inputs (Cash ₹, UPI ₹, Card ₹); validation: if split mode, sum must equal total (or show warning, not block); store `payment_mode` (string: `'cash'|'upi'|'card'|'split'`) and `payment_split` (`{cash, upi, card}` — null if not split) on the sale document
- `firestore.rules` — add `payment_mode` to required fields list in the sales `allow create` rule
- `modules/billing.js` (sale detail panel / receipt) — display payment mode badge on submitted sale confirmation screen
- `styles/main.css` — payment mode button group styles; split input row layout

**UAT:**
- [ ] Sale with customer phone → WhatsApp button opens `wa.me/{customer_phone}` (not the shop number)
- [ ] Sale without customer phone → WhatsApp button falls back to `WHATSAPP_NUMBER` from config
- [ ] Login screen subtitle shows configured shop name from Firestore (not hardcoded "My Shop")
- [ ] If `config/main.shopName` is not set → falls back to `SHOP_NAME` from `shop.config.js`
- [ ] Receipt canvas PNG: all text is #000000; no grey lines or muted text
- [ ] Print receipt → text is clearly legible and black on white
- [ ] Billing screen shows Payment section: Cash / UPI / Card buttons
- [ ] Selecting "Split Payment" reveals three optional amount inputs
- [ ] Submitting a sale saves `payment_mode` on the Firestore sale doc
- [ ] Split mode: entering partial amounts is allowed (no hard block if sum ≠ total)
- [ ] Sale confirmation screen shows a payment mode badge (e.g. "Cash" or "Split: ₹200 Cash + ₹150 UPI")

**Plans:** 2 plans

Plans:
- [ ] 25-01-PLAN.md — WhatsApp customer phone fix + login shop name fix + receipt black canvas fix + footer text bug
- [ ] 25-02-PLAN.md — Payment mode UI in billing (Cash/UPI/Card + split) + Firestore field + sale detail badge + UAT checkpoint


---

### Phase 26 — Reports Advanced Filters

**Goal:** Give shop owners deep analytical filters on the Reports screen — filter sales by payment method, date range, product type, brand, customer, cashier/staff, and amount range. Summary chips update live to reflect the filtered dataset.

**Delivers:** Owner can instantly answer: "How much cash collected today?", "Which staff has highest sales this week?", "How much came via UPI vs Cash in June?" All filters compose — any combination works together.

**Requirements covered:** FR-RPT-01 through FR-RPT-12

**Depends on:** Phase 15 (reports base), Phase 20 (customer tab), Phase 25 (payment_mode on sale docs)

**Filter dimensions:**

| Filter | Type | Values |
|--------|------|--------|
| Date range | Preset + custom | Today / Yesterday / This week / This month / Last 30 days / Custom (from–to date picker) |
| Payment method | Multi-select toggle | Cash / UPI / Card / Split / (All) |
| Amount range | Min–Max inputs | e.g. ₹500 – ₹5000 |
| Product type | Dropdown | All Types + types from inventory |
| Brand | Dropdown | All Brands + brands from inventory |
| Customer | Phone search | Matches customer_phone on sale doc |
| Staff / cashier | Dropdown | All staff + names from sale docs (recorded_by field) |
| Sort by | Dropdown | Newest / Oldest / Amount ↑ / Amount ↓ / Item count ↑ / Item count ↓ |

**Summary chips (live-updating):** Total count · Total revenue · Payment breakdown (₹X cash / ₹Y UPI / ₹Z card) · Average sale value

**Key tasks:**
- `modules/reports.js` — collapsible "Filters" panel with all dimensions; active filter count badge (e.g. "Filters (3)"); "Clear all" button
- Firestore query builder: compose `where()` clauses for payment_mode, customer_phone, recorded_by, date range; client-side post-filter for amount range, product type, brand
- Summary chips row below filter bar: recalculate from filtered result set on every data change
- Payment breakdown chip: for split sales sum `sale.payment_split.cash`, `.upi`, `.card` components correctly
- Export filtered results to Excel (reuse Phase 7 export logic, pass filtered array)
- `styles/main.css` — filter panel layout, active badge, summary chips row, date range inputs

**UAT:**
- [ ] Selecting "Cash" shows only cash sales; chips show cash total
- [ ] Selecting "Today" shows only today's sales
- [ ] Cash + Today shows correct intersection
- [ ] Amount range ₹500–₹2000 hides outside-range sales
- [ ] Customer phone filter shows only that customer's sales
- [ ] Staff filter shows only that member's sales
- [ ] Sort by "Amount ↓" reorders correctly
- [ ] Summary chips update live on every filter change
- [ ] Payment breakdown correctly handles split-mode sales (sums components)
- [ ] "Clear all" resets to full unfiltered list
- [ ] Active badge shows correct filter count
- [ ] Export downloads filtered results only

**Plans:** **Plans:** 3 plans

Plans:
- [ ] 26-01-PLAN.md — Filter panel UI + preset dates + payment pills + sort + active badge + CSS
- [ ] 26-02-PLAN.md — _applyAllFilters() engine + enhanced stats chips + payment breakdown
- [ ] 26-03-PLAN.md — Export filtered results to Excel + UAT checkpoint

---

### Phase 27 — Inventory Variant System (Colors & Sizes)

**Goal:** Extend the inventory add/edit form with a structured variant system — items can have colors, sizes, or both. Variant-level quantities replace the single flat stock number. Type and brand become smart autocomplete fields fed by existing Firestore values.

**Delivers:** Shop owners can model real clothing/apparel stock: e.g. "Blue, M: 5 pcs", "Red, L: 2 pcs". A "Has Colors" checkbox enables per-color quantities. A "Has Sizes" checkbox (only active when Has Colors is also on) enables per-color × per-size quantities. Brand appears immediately below the Name field. Type and Brand inputs offer autocomplete from previously saved values, preventing duplicate entries due to typos. When "Has Colors" is checked, the standalone Color field is hidden (colors are now captured inside the variant grid).

**Delivers:** FR-06 (Inventory Management) — variant-level stock modelling for fashion/apparel shops.

**Depends on:** Phase 16 (type, branch, color fields added), Phase 13 (sizes infrastructure)

**Data model changes (Firestore inventory doc):**
- `has_colors` (boolean, default false)
- `has_sizes` (boolean, default false — only meaningful if `has_colors` is true)
- `variants` (array, replaces flat `stock`/`color` fields when either flag is true):
  - If only `has_colors`: `[{ color: "Blue", qty: 5 }, { color: "Red", qty: 2 }]`
  - If `has_colors` + `has_sizes`: `[{ color: "Blue", size: "M", qty: 5 }, { color: "Blue", size: "L", qty: 2 }, ...]`
- `stock` (number) — kept for items without variants (flat qty); computed as `sum(variants[].qty)` for variant items for backward-compat reads
- `color` field — still stored for simple color (no variants); hidden in form when `has_colors` is true

**Key tasks:**
- `modules/inventory.js` — add/edit item form:
  - Move **Brand** field directly below **Name** field (remove from end of form)
  - **Type** input: `<datalist>` or custom dropdown autocomplete — fetches distinct `type` values from inventory collection once per form open; shows suggestions as user types; allows free-text entry of new values
  - **Brand** input: same autocomplete pattern — fetches distinct `brand` values from inventory collection
  - Add **"Has Colors"** checkbox; when checked: hide the flat `color` input; show color-variant entry UI (add-color button, per-color row with name + qty)
  - Add **"Has Sizes"** checkbox (only enabled + visible when "Has Colors" is checked); when checked: each color row gains per-size sub-rows (add-size button per color row, size name + qty)
  - Variant entry grid: add/remove rows dynamically; validate no duplicate color or color+size combos; min qty 0
  - On save: write `has_colors`, `has_sizes`, `variants` to Firestore; compute and write `stock` as sum of all variant qtys
- `modules/inventory.js` — list view:
  - Items with variants show a compact variant summary badge (e.g. "3 colors", "2 colors × 4 sizes") instead of a flat stock number
  - Tooltip / expand shows full variant breakdown on tap/hover
- `modules/billing.js` — product card:
  - Variant items show a color/size selector before adding to cart
  - Cart line item captures selected variant (color + size if applicable)
- `styles/main.css` — variant entry grid styles, checkbox row layout, datalist/autocomplete dropdown styles
- `modules/export.js` — expand Excel export: variant items write one row per variant (color, size, qty columns); flat items unchanged

**UAT:**
- [ ] Add item form: Brand field appears directly below Name (not at bottom of form)
- [ ] Type input: typing shows suggestions from existing types; selecting one fills the field; typing a new value works too
- [ ] Brand input: same autocomplete behavior as Type
- [ ] "Has Colors" unchecked: flat Color field is visible; stock is a single number
- [ ] "Has Colors" checked: flat Color field is hidden; color-variant entry rows appear
- [ ] Can add multiple color rows, each with a name and quantity
- [ ] "Has Sizes" checkbox only appears (and is only usable) when "Has Colors" is also checked
- [ ] "Has Sizes" checked: each color row shows sub-rows for sizes with individual quantities
- [ ] Can add multiple size sub-rows under each color
- [ ] Saving a "Has Colors only" item writes correct `variants` array + computed `stock` to Firestore
- [ ] Saving a "Has Colors + Has Sizes" item writes correct variant matrix to Firestore
- [ ] Inventory list shows "3 colors" badge for color-variant items (not a raw stock number)
- [ ] Inventory list shows "2 colors × 4 sizes" badge for color+size variant items
- [ ] Editing an existing variant item pre-fills the variant grid correctly
- [ ] Billing product card for variant item shows a color/size picker before adding to cart
- [ ] Excel export: variant items produce one row per variant (color, size, qty)
- [ ] Items without variants (has_colors = false) are unaffected by this change

**Plans:** 3 plans

Plans:
- [x] 27-01-PLAN.md — Inventory form: Brand below Name, Type/Brand autocomplete, Has Colors + variant row UI
- [x] 27-02-PLAN.md — Has Sizes sub-rows, Firestore save/load, list badge, billing picker, export rows
- [ ] 27-03-PLAN.md — Human verification checkpoint

---
## Milestone 1: MVP (v1.0) — ✅ Complete (2026-06-03)

> All 16 phases complete. See `.planning/reports/MILESTONE_SUMMARY-v1.md`.

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

**Plans:** 3 plans

Plans:
- [x] 15-01-PLAN.md -- modules/reports.js (sales history list, pagination, date filter, search, detail panel, View Receipt)
- [x] 15-02-PLAN.md -- Owner bill editing (edit form, updateDoc, audit fields) + firestore.rules sales update permission
- [x] 15-03-PLAN.md -- Human verification checkpoint

---

### Phase 16 — Inventory Fields Enhancement (type, branch, color)

**Goal:** Extend inventory items with product classification fields — `type` (product category), `branch` (store branch/location), and `color` — so that stock can be organized, filtered, and accurately described. `size` and `quantity` (stock) already exist; this phase ensures all item attributes needed by a retail shop are captured.

**Delivers:** Inventory add/edit forms capture type, branch, and color. List view shows and filters by these fields. Billing product grid displays color info and supports filter-by-type/branch. Export includes the new columns.

**Requirements covered:** FR-06 (Inventory Management)

**Depends on:** Phase 6, Phase 13

**Key tasks:**
- Extend Firestore inventory doc schema: add `type` (string, product category), `branch` (string), `color` (string, optional)
- Update `modules/inventory.js` add/edit item form — new fields: Type, Branch, Color
- Update inventory table/mobile-list display columns to include Type, Branch, Color
- Add client-side filter chips / dropdowns for Type and Branch in inventory screen
- Update `modules/billing.js` product grid card — show color badge; add Type filter tab or dropdown
- Update `modules/export.js` — include type, branch, color columns in Excel export
- Migration note: existing docs without these fields default to empty string (no backfill needed)

**UAT:**
- [ ] Add item form has Type, Branch, Color fields
- [ ] Saved items store type, branch, color in Firestore
- [ ] Inventory list shows type, branch, color per item
- [ ] Filtering by Type or Branch narrows the list correctly
- [ ] Billing product grid shows color on item card
- [ ] Billing grid can be filtered by Type or Branch
- [ ] Excel export includes type, branch, color columns
- [ ] Items without color/branch show blank (no crash)
- [ ] Existing items (without new fields) still display correctly

**Plans:** 3 plans

Plans:
- [x] 16-01-PLAN.md — Inventory schema + CRUD forms (type, branch, color fields)
- [x] 16-02-PLAN.md — Billing grid + Export integration
- [ ] 16-03-PLAN.md — Human verification checkpoint

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


