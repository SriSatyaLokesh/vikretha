# Vikretha - విక్రేత 

**Zero-cost shop management PWA for small retailers. Fork → configure → deploy. No subscriptions, no servers.**

Vikretha (Telugu for "seller/merchant") is a progressive web app that gives independent shop owners professional billing, inventory tracking, dashboards, and WhatsApp receipt sharing — all hosted free on GitHub Pages with Firebase Firestore as the backend.

---

## Features

- **Billing & Sales** — Record sales with multiple items, quantities, optional discount, and payment mode (Cash / UPI / Card / Split) in seconds
- **Canvas Receipts** — Generates a receipt image in the browser; share instantly via WhatsApp or download as PNG
- **Dashboard** — Live summary cards (today / week / month revenue + sale count) and a 7-day bar chart
- **Sales History & Reports** — Paginated sales list with advanced filters (date/time range, payment mode, amount range, sort order), active filter chips, per-filter stats, and full Excel export
- **Customers Tab** — Browse all customers by phone number and drill into their individual bill history
- **Inventory Management** — Track stock levels with low-stock badges and alerts; full CRUD
- **Excel Export** — Export filtered sales data for any date range as an `.xlsx` file (client-side, no server)
- **Staff Management** — Add/remove staff email addresses from the Settings screen; role-based access (owner / admin / member)
- **Owner Settings** — Customise shop name, receipt branding (logo URL + footer), color theme, dark mode, and login screen copy — all saved to Firestore and reflected instantly
- **Dark Mode** — Toggle from the header; persisted per device
- **Offline-First PWA** — Service worker caches the app shell; Firestore SDK queues writes while offline

---

## Demo

> A live demo is available at: **https://srisatyalokesh.github.io/vikretha/**

---

## Prerequisites

- A **GitHub account** (free)
- A **Firebase account** (free Spark plan — no credit card required)
- A **modern browser**: Chrome 90+, Safari 14+, Firefox 88+

---

## Setup

Follow these steps to go from fork to a working shop in under 30 minutes.


> **⚡ Quick Setup** — Already know Firebase? Here are the 3 commands:
> ```bash
> # 1. Copy the template and fill in your credentials
> cp shop.config.js.template shop.config.js   # then edit shop.config.js
>
> # 2. Deploy Firestore security rules (requires Firebase CLI)
> npm install -g firebase-tools
> firebase login
> node scripts/deploy-rules.js
>
> # 3. Push to GitHub Pages
> git add . && git commit -m "Configure shop" && git push
> ```
> Then visit your GitHub Pages URL and create your owner account. Full steps below.

### Step 1 — Fork this repository

1. Click the **Fork** button at the top-right of this page
2. Give your fork a name (e.g., `my-shop`) or keep the default `vikretha`
3. Optionally clone it locally — but GitHub Pages doesn't require it

### Step 2 — Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Enter a project name (e.g., `my-kirana-store`) → click through the wizard
3. Enable **Firestore Database**:
   - Click **Firestore Database** in the left sidebar → **Create database**
   - Choose **Start in test mode** (you'll add proper rules in Step 5)
   - Select the region closest to your users (e.g., `asia-south1` for India)
4. Enable **Authentication**:
   - Click **Authentication** in the left sidebar → **Sign-in method** tab
   - Click **Email/Password** → toggle **Enable** → **Save**

### Step 3 — Get your Firebase config

1. In Firebase Console, click the **gear icon** (⚙️) next to "Project Overview" → **Project settings**
2. Scroll to **Your apps** → click the `</>` (Web) icon to register a web app (name it anything)
3. Firebase shows you a config object like:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```
4. Copy these values — you'll use them in Step 4

### Step 4 — Configure shop.config.js

Open `shop.config.js` in your fork (edit directly on GitHub or clone locally):

```javascript
export const FIREBASE_CONFIG = {
  apiKey: "YOUR-API-KEY",          // ← paste from Step 3
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "YOUR-SENDER-ID",
  appId: "YOUR-APP-ID"
};

export const SHOP_NAME = "My Kirana Store";   // ← your shop name
export const SHOP_ID   = "my_kirana_store";   // ← URL-safe ID (no spaces)
export const CURRENCY  = "₹";
export const LOCALE    = "en-IN";
export const WHATSAPP_NUMBER = "+919876543210"; // ← optional
export const THEME_COLOR = "#2563eb";
```

**Replace all placeholder values** with your actual Firebase credentials and shop details, then commit and push.

> ⚠️ **Security note:** `shop.config.js` contains your Firebase API key. For a personal/small shop deployment on a **public GitHub repo**, this is acceptable because the real security enforcement happens in Firestore Rules (Step 5) — not in the API key itself. Firebase API keys for web apps are designed to be public; they only identify your project, not grant admin access.

### Step 5 — Set Firestore Security Rules

1. Copy the full contents of [`firestore.rules`](./firestore.rules) from this repository
2. In Firebase Console → **Firestore Database** → **Rules** tab
3. Replace the existing rules with the copied content
4. Click **Publish**

The rules ensure only email addresses in your shop's `authorized_emails` list can read or write data. The first sign-in bootstraps this list with your email automatically.

### Step 6 — Enable GitHub Pages

1. Go to your fork on GitHub → **Settings** → **Pages** (left sidebar)
2. Under **Source**: select **Deploy from a branch**
3. **Branch**: `main`, **Folder**: `/ (root)` → **Save**
4. After ~60 seconds, your site is live at: `https://{your-username}.github.io/{repo-name}/`

### Step 7 — First sign-in

1. Visit your GitHub Pages URL
2. Click **Create Account** → enter your email address and a password
3. The app automatically bootstraps your shop config in Firestore with your email as the authorized owner
4. You're ready to start recording sales!

---

## Configuration Reference

Every field in `shop.config.js`:

| Field | Type | Example | Description |
|-------|------|---------|-------------|
| `FIREBASE_CONFIG.apiKey` | string | `"AIzaSy..."` | Firebase API key — from Project Settings |
| `FIREBASE_CONFIG.authDomain` | string | `"shop.firebaseapp.com"` | Firebase auth domain (`{projectId}.firebaseapp.com`) |
| `FIREBASE_CONFIG.projectId` | string | `"my-shop-123"` | Firebase project ID |
| `FIREBASE_CONFIG.storageBucket` | string | `"shop.firebasestorage.app"` | Storage bucket (`{projectId}.firebasestorage.app`) |
| `FIREBASE_CONFIG.messagingSenderId` | string | `"210720989974"` | Messaging sender ID |
| `FIREBASE_CONFIG.appId` | string | `"1:...:web:..."` | Firebase app ID |
| `SHOP_NAME` | string | `"My Kirana Store"` | Displayed in the header and on receipts |
| `SHOP_ID` | string | `"my_kirana_store"` | Firestore path segment `/shops/{SHOP_ID}/`. Must be URL-safe (no spaces, use underscores) |
| `CURRENCY` | string | `"₹"` | Currency symbol shown on receipts and reports |
| `LOCALE` | string | `"en-IN"` | BCP 47 locale for date/number formatting (e.g., `"en-US"`, `"en-IN"`) |
| `WHATSAPP_NUMBER` | string | `"+919876543210"` | Shop's WhatsApp number with country code — used as fallback recipient for receipt sharing. Leave `""` to skip. |
| `THEME_COLOR` | string | `"#2563eb"` | Primary colour (hex) — used for header, buttons, and bar charts |
| `LOGO_URL` | string | `"https://..."` | URL to shop logo image shown on receipts and in the mobile navigation header. Leave `""` to display `SHOP_NAME` as a Kaushan Script wordmark. Owners can also set this from Settings (saved to Firestore; overrides this value at runtime). |
| `RECEIPT_FOOTER` | string | `"No exchange after 7 days."` | Custom footer text printed at the bottom of every receipt. Leave `""` for the default "THANK YOU FOR SHOPPING!". |
| `COLOR_THEME` | string | `"gold"` | Default app-wide color palette. One of: `orange`, `emerald`, `sky`, `violet`, `rose`, `slate`, `gold`. Owners can override this live from the Settings screen (saved to Firestore). |

---

## Staff Management

1. Sign in as the owner → tap the **Settings** icon (⚙️) in the bottom nav
2. Under **Staff Access**, enter a staff member's email → select their role (**Admin** or **Member**) → tap **Add**
3. The staff member must visit your GitHub Pages URL and click **Create Account** using that same email address
4. They will immediately be able to sign in and access the shop data

To **remove staff access**:
- Settings → tap **Remove** next to their email

> **Roles:**
> - **Owner** — Full access to all features plus Settings (shop identity, receipt branding, theme, login screen, staff management)
> - **Admin** — Access to all features plus Staff Access section of Settings
> - **Member** — Access to Billing, Inventory, Reports, and Dashboard (no Settings)

## Owner Settings

Owners can customise the following from the Settings screen without editing any files:

| Section | Options |
|---------|----------|
| **Shop Identity** | Shop display name (used in header and receipts) |
| **Receipt Branding** | Logo URL (shown on receipt canvas and mobile header) + footer text |
| **Color Theme** | Visual palette picker with live preview — one of `orange`, `emerald`, `sky`, `violet`, `rose`, `slate`, `gold` |
| **Login Screen** | Tagline, description paragraph, and feature bullet list shown on the sign-in page |
| **Staff Access** | Add / remove staff emails and assign roles |

All changes are saved to Firestore and take effect immediately for all signed-in users.

---

## Features Deep-Dive

| Module | Description |
|--------|-------------|
| **Billing** | Add items from inventory to a sale, set quantities, apply an optional discount, and select payment mode (Cash / UPI / Card / Split). Sale IDs are sequential (`YYYYMMDD-0001`) and safe for offline use. Indian phone numbers are normalised to `+91XXXXXXXXXX` automatically. |
| **Receipt** | After confirming a sale, view the receipt as a PNG image rendered by the browser's Canvas 2D API — no server, no library. Share via Web Share API (native on Android/iOS) or WhatsApp fallback. |
| **Dashboard** | Live summary cards for today / this week / this month. A 7-day sales bar chart built with CSS flexbox. |
| **Reports** | Paginated sales history with a collapsible filter panel — filter by date/time range, payment mode, amount range, and sort order. Active filters shown as dismissible chips with per-result stats. Click any row to open a detail panel (full-screen drawer on desktop). |
| **Customers** | Separate tab inside Reports listing all customers (name + phone). Tap a customer to see their complete bill history. |
| **Inventory** | Manage product catalogue: name, price, unit, stock quantity, and low-stock threshold. Low-stock items are flagged with a badge. Searchable, sortable list. |
| **Export** | Export filtered sales for a chosen date range to `.xlsx` using SheetJS (lazy-loaded from CDN — 0 KB until first use). |
| **Settings** | **Owner:** Shop Identity (name), Receipt Branding (logo URL + footer text), Color Theme picker, Login Screen copy (tagline / description / feature bullets), Staff Access (add/remove/change role). **Admin:** Staff Access only. Dark mode toggle is available from the header for all roles. |

---

## Project Structure

```
vikretha/
├── index.html              # Entry point — loads app.js as ES module
├── app.js                  # Hash router + auth guard
├── shop.config.js          # ← Your configuration here
├── shop.config.js.template # Safe-to-commit placeholder (reference copy)
├── firestore.rules         # ← Copy-paste to Firebase Console (Step 5)
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline cache)
├── lib/
│   └── firebase-init.js    # Firebase app + Firestore + Auth initialisation
├── modules/
│   ├── auth.js             # Sign-in / create account / sign-out
│   ├── billing.js          # Sale recording with payment mode selection
│   ├── dashboard.js        # Summary cards + 7-day chart
│   ├── export.js           # Excel export (SheetJS)
│   ├── inventory.js        # Stock management
│   ├── receipt.js          # Canvas receipt + WhatsApp share
│   ├── reports.js          # Sales history, advanced filters, customers tab
│   └── settings.js         # Owner/admin settings (role-aware)
├── styles/
│   └── main.css
└── scripts/
    ├── seed-inventory.js   # Seed sample inventory items
    └── seed-demo.js        # Seed 30 days of sales + 12 inventory items
```

---

## Demo Data

To populate your Firebase project with 30 days of sample sales and 12 inventory items (useful for testing or demoing):

```bash
node scripts/seed-demo.js your@email.com yourpassword
```

Requires Node.js 18+. No `npm install` needed.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Hosting | GitHub Pages | Free, HTTPS, CDN |
| Frontend | Vanilla JS ES Modules | No build step, fork-and-go |
| Styling | Custom CSS | Mobile-first, responsive |
| Database | Firebase Firestore (Spark) | 20K writes/day, offline sync |
| Auth | Firebase Auth (Email/Password) | Per-user access control |
| Offline | Firestore SDK IndexedDB | Automatic write queue |
| Receipts | Canvas 2D API | 0 KB dependency |
| Charts | CSS Flexbox | No library |
| Export | SheetJS via CDN | Lazy-loaded on first use |
| WhatsApp | Web Share API + wa.me | Native + fallback |
| PWA | Service Worker + manifest.json | Installable |
| Routing | Hash-based (`#/route`) | Works on GitHub Pages |

---

## Contributing

Vikretha is designed as a **fork-and-own template** — every shop owner runs their own copy. Contributions to the template (bug fixes, new features, accessibility improvements) are welcome via pull request.

See `.planning/` for the project roadmap and architectural decisions.

---

## License

[MIT](LICENSE) — free to use, fork, and modify.
