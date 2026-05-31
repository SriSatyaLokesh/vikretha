---
title: "Vikretha — Technical Requirements Document"
version: "3.0"
date_created: "2026-05-31"
last_updated: "2026-05-31"
status: "Draft"
owner: "SriSatyaLokesh"
tags: ["trd", "firebase", "firestore", "pwa", "static-site", "vanilla-js"]
---

# Vikretha — Technical Requirements Document

![Status: Draft](https://img.shields.io/badge/status-Draft-yellow)

---

## 1. Overview

This document defines the implementation-level technical specifications for
Vikretha — a zero-cost shop management PWA running on GitHub Pages with Firebase
Firestore as the backend. Every design decision optimizes for:

1. **Zero cost** — Firebase Spark (free) plan + GitHub Pages
2. **Offline-first** — Firestore built-in persistence via IndexedDB
3. **Fork-and-go** — No build step, no server, no CI/CD required
4. **Mobile-first** — Primary device is Android smartphone on spotty 4G
5. **Security** — Phone OTP auth + per-shop Firestore Security Rules

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User's Device (Android/Desktop)                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Service Worker (Cache Layer)                     │  │
│  │  • Caches app shell (HTML/CSS/JS) on install                      │  │
│  │  • Serves from cache on repeat visits (instant load)               │  │
│  │  • Network-first for Firebase SDK (CDN-cached anyway)              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                         Application Layer                          │  │
│  │                                                                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────────────┐  │  │
│  │  │  Router  │  │  Auth    │  │  Modules  │  │  Export Engine │  │  │
│  │  │ (hash)   │  │  Guard   │  │ (lazy ES) │  │  (SheetJS)     │  │  │
│  │  └──────────┘  └──────────┘  └───────────┘  └────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐   │  │
│  │  │              Firebase JS SDK (Modular, tree-shaken)         │   │  │
│  │  │  ┌───────────────┐  ┌──────────────────────────────────┐  │   │  │
│  │  │  │  firebase/auth │  │  firebase/firestore              │  │   │  │
│  │  │  │  (Phone OTP)   │  │  • enableIndexedDbPersistence() │  │   │  │
│  │  │  │                 │  │  • onSnapshot() listeners       │  │   │  │
│  │  │  │                 │  │  • batch writes                 │  │   │  │
│  │  │  └───────────────┘  └──────────────────────────────────┘  │   │  │
│  │  └────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     IndexedDB (Firestore Cache)                     │  │
│  │  • All read data cached automatically                              │  │
│  │  • Pending writes queued until online                              │  │
│  │  • Managed entirely by Firestore SDK                               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (Firebase SDK handles)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Firebase Backend (Spark/Free)                     │
│                                                                          │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │       Firebase Auth         │  │        Cloud Firestore            │  │
│  │  • Phone Number provider    │  │  • /shops/{shopId}/config         │  │
│  │  • reCAPTCHA verification   │  │  • /shops/{shopId}/inventory/*    │  │
│  │  • Session persistence      │  │  • /shops/{shopId}/sales/*        │  │
│  │  • 10 free OTPs/day         │  │  • /shops/{shopId}/summary        │  │
│  │                             │  │  • /shops/{shopId}/counters/*     │  │
│  └─────────────────────────────┘  │                                    │  │
│                                    │  Security Rules enforce per-shop   │  │
│                                    │  isolation via authorized_phones   │  │
│                                    └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Module Dependency Graph

```
index.html
├── app.js (entry point — router + auth guard)
├── shop.config.js (Firebase config + shop settings)
├── modules/
│   ├── auth.js (Firebase Auth Phone OTP flow)
│   ├── billing.js (sale entry, cart, batch write)
│   ├── receipt.js (Canvas 2D rendering)
│   ├── dashboard.js (summary listener, CSS chart)
│   ├── inventory.js (CRUD on inventory collection)
│   ├── export.js (SheetJS Excel generation)
│   └── settings.js (staff management, sign out)
├── lib/
│   └── firebase-init.js (SDK initialization + persistence)
├── sw.js (Service Worker)
└── manifest.json (PWA manifest)
```

### 2.3 Data Flow — Sale Submission

```
User taps "Submit Sale"
        │
        ▼
┌───────────────────────┐
│  Generate Sale ID     │  (read counter → increment → format YYYYMMDD-NNNN)
│  (Firestore transaction)│
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Firestore Batch Write │
│  ├── SET /sales/{id}   │  (sale document)
│  ├── UPDATE /inventory  │  (decrement stock for each item)
│  └── UPDATE /summary    │  (increment counts + revenue)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Optimistic UI        │  (Firestore returns immediately from local cache)
│  • Receipt renders    │
│  • ⏳ shows "syncing" │
└───────────┬───────────┘
            │
            ▼ (when online)
┌───────────────────────┐
│  Firestore server     │  (SDK syncs queued write)
│  confirms write       │  (snapshot listener fires → ⏳ badge removed)
└───────────────────────┘
```

---

## 3. Firebase Configuration

### 3.1 Project Setup Requirements

The shop owner creates a Firebase project with:
1. **Authentication** → Phone provider enabled
2. **Firestore Database** → Created in production mode (not test mode)
3. **Security Rules** → Copy-paste from provided template (see §3.3)
4. **No other services needed** (no Storage, no Functions, no Hosting)

### 3.2 Firebase SDK Integration

```javascript
// lib/firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { FIREBASE_CONFIG } from '../shop.config.js';

const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence — must be called before any Firestore reads/writes
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — only one can have persistence
    console.warn('Firestore persistence unavailable (multiple tabs)');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB
    console.warn('Firestore persistence not supported in this browser');
  }
});
```

**SDK Loading Strategy:**
- Use ES module imports from `gstatic.com` CDN (Google's edge CDN)
- Browser caches these indefinitely (immutable URLs with version)
- Total SDK size: ~80KB (auth + firestore, gzipped)
- No bundler needed — native ES module `import` in all target browsers

### 3.3 Security Rules (Complete)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // No access to anything by default
    match /{document=**} {
      allow read, write: if false;
    }

    // Helper: check if authenticated user's phone is in this shop's authorized list
    function isAuthorized(shopId) {
      let config = get(/databases/$(database)/documents/shops/$(shopId)/config);
      return request.auth != null
        && request.auth.token.phone_number != null
        && request.auth.token.phone_number in config.data.authorized_phones;
    }

    // Shop-level access: all subcollections
    match /shops/{shopId}/{document=**} {
      allow read: if isAuthorized(shopId);
      allow write: if isAuthorized(shopId);
    }
  }
}
```

**Security Rule Design Notes:**
- `get()` call counts as 1 read per evaluation (cached for the request lifecycle)
- Each request to any document under `/shops/{shopId}/` triggers one `get()` of
  the config document to check authorization
- This is acceptable because:
  - Config doc is tiny (~200 bytes)
  - Firestore caches evaluated rules within the same request
  - Reads are cheap (50K/day free) and client-side caching minimizes requests

### 3.4 Firestore Indexes

Required composite indexes (created in Firebase Console → Firestore → Indexes):

| Collection | Fields | Order | Purpose |
|------------|--------|-------|---------|
| `shops/{id}/sales` | `timestamp` | DESC | Monthly queries, recent sales list |

> **Note:** Most queries use simple field equality or the document ID, which
> don't require composite indexes. The timestamp DESC index is the only custom
> index needed for MVP.

---

## 4. Module Implementation Details

### 4.1 Authentication Module (`modules/auth.js`)

#### Phone OTP Flow

```javascript
import { auth } from '../lib/firebase-init.js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

let confirmationResult = null;

// Initialize invisible reCAPTCHA (required by Firebase for phone auth)
function initRecaptcha() {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, 'send-otp-btn', {
    size: 'invisible',
    callback: () => { /* reCAPTCHA solved — will proceed with signIn */ }
  });
}

// Step 1: Send OTP
async function sendOTP(phoneNumber) {
  const appVerifier = window.recaptchaVerifier;
  confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  // Show OTP input UI
}

// Step 2: Verify OTP
async function verifyOTP(code) {
  const result = await confirmationResult.confirm(code);
  // result.user contains the authenticated user
  return result.user;
}

// Auth state observer — called on every page load
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in — show app
    loadApp(user.phoneNumber);
  } else {
    // User is signed out — show login screen
    showLoginScreen();
  }
});
```

**Auth Flow Notes:**
- `RecaptchaVerifier` with `size: 'invisible'` means no user-facing CAPTCHA
  puzzle — Firebase handles bot detection transparently
- `signInWithPhoneNumber` sends the SMS via Firebase (no Twilio needed)
- Session persistence is `LOCAL` by default (survives browser restart)
- `onAuthStateChanged` fires immediately on page load with cached auth state
  (no network round-trip needed to know if user is logged in)

#### Auth Guard Pattern

```javascript
// app.js — route guard
import { auth } from './lib/firebase-init.js';
import { onAuthStateChanged } from 'firebase/auth';

function guardRoute(renderFn) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.hash = '#/login';
      return;
    }
    renderFn(user);
  });
}
```

### 4.2 Billing Module (`modules/billing.js`)

#### Sale Submission with Batch Write

```javascript
import { db } from '../lib/firebase-init.js';
import {
  collection, doc, getDoc, setDoc, updateDoc, writeBatch,
  increment, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID } from '../shop.config.js';

async function submitSale(cartItems, discount, customerPhone) {
  const shopRef = doc(db, 'shops', SHOP_ID);

  // Step 1: Get next sequential Sale ID via transaction
  const saleId = await runTransaction(db, async (transaction) => {
    const counterRef = doc(db, 'shops', SHOP_ID, 'counters', 'sales_counter');
    const counterDoc = await transaction.get(counterRef);

    let nextSeq = 1;
    if (counterDoc.exists()) {
      nextSeq = counterDoc.data().last_seq + 1;
    }

    transaction.update(counterRef, { last_seq: nextSeq });

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${today}-${String(nextSeq).padStart(4, '0')}`;
  });

  // Step 2: Calculate totals
  const subtotal = cartItems.reduce((sum, item) => sum + item.line_total, 0);
  const total = subtotal - (discount || 0);

  // Step 3: Batch write — atomic (sale + stock decrement + summary update)
  const batch = writeBatch(db);

  // Write sale document
  const saleRef = doc(db, 'shops', SHOP_ID, 'sales', saleId);
  batch.set(saleRef, {
    timestamp: serverTimestamp(),
    items: cartItems,
    subtotal,
    discount: discount || 0,
    total,
    customer_phone: customerPhone || null
  });

  // Decrement stock for each item
  for (const item of cartItems) {
    const itemRef = doc(db, 'shops', SHOP_ID, 'inventory', item.item_id);
    batch.update(itemRef, { stock: increment(-item.qty) });
  }

  // Update summary counters
  const summaryRef = doc(db, 'shops', SHOP_ID, 'summary');
  batch.update(summaryRef, {
    today_count: increment(1),
    today_revenue: increment(total),
    week_count: increment(1),
    week_revenue: increment(total),
    month_count: increment(1),
    month_revenue: increment(total)
  });

  await batch.commit();

  return { saleId, total, cartItems };
}
```

**Offline Behavior:**
- `runTransaction` requires network for the counter (sequential IDs need
  server confirmation). Fallback: use a client-generated UUID and update
  the display ID after sync.
- `batch.commit()` writes to IndexedDB immediately when offline
- The UI proceeds instantly — the `⏳` indicator resolves when Firestore
  confirms the server write via `onSnapshot`

#### Offline Sale ID Fallback Strategy

```javascript
// When offline, use timestamp-based ID (guaranteed unique per device)
function generateOfflineSaleId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const ms = now.getTime().toString(36); // compact timestamp
  return `${date}-OFF-${ms}`;
}
```

### 4.3 Receipt Module (`modules/receipt.js`)

#### Canvas 2D Receipt Generation

```javascript
export function generateReceipt(saleData, shopConfig) {
  const { saleId, items, subtotal, discount, total, timestamp } = saleData;
  const { shop_name, currency } = shopConfig;

  // Calculate canvas dimensions
  const lineHeight = 24;
  const headerHeight = 100;
  const itemsHeight = items.length * lineHeight;
  const footerHeight = 120;
  const width = 380;
  const height = headerHeight + itemsHeight + footerHeight + 40;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(shop_name, width / 2, 30);

  ctx.font = '12px system-ui';
  ctx.fillStyle = '#666666';
  ctx.fillText(new Date(timestamp).toLocaleString('en-IN'), width / 2, 50);
  ctx.fillText(`Bill No: ${saleId}`, width / 2, 68);

  // Divider
  ctx.strokeStyle = '#cccccc';
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  ctx.moveTo(20, 80);
  ctx.lineTo(width - 20, 80);
  ctx.stroke();
  ctx.setLineDash([]);

  // Column headers
  let y = headerHeight;
  ctx.font = 'bold 12px system-ui';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'left';
  ctx.fillText('Item', 20, y);
  ctx.fillText('Qty', 200, y);
  ctx.fillText('Price', 250, y);
  ctx.textAlign = 'right';
  ctx.fillText('Total', width - 20, y);

  // Items
  ctx.font = '12px system-ui';
  ctx.fillStyle = '#1a1a1a';
  items.forEach((item) => {
    y += lineHeight;
    ctx.textAlign = 'left';
    ctx.fillText(item.name.slice(0, 20), 20, y);
    ctx.fillText(`${item.qty}`, 200, y);
    ctx.fillText(`${currency}${item.price}`, 250, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${currency}${item.line_total}`, width - 20, y);
  });

  // Divider
  y += 16;
  ctx.strokeStyle = '#cccccc';
  ctx.beginPath();
  ctx.moveTo(20, y);
  ctx.lineTo(width - 20, y);
  ctx.stroke();

  // Totals
  y += 24;
  ctx.textAlign = 'left';
  ctx.fillText('Subtotal:', 200, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${currency}${subtotal}`, width - 20, y);

  if (discount > 0) {
    y += lineHeight;
    ctx.fillStyle = '#e63946';
    ctx.textAlign = 'left';
    ctx.fillText('Discount:', 200, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-${currency}${discount}`, width - 20, y);
  }

  y += lineHeight + 4;
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL:', 200, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${currency}${total}`, width - 20, y);

  // Footer
  y += 30;
  ctx.font = '10px system-ui';
  ctx.fillStyle = '#999999';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you for your purchase!', width / 2, y);

  return canvas;
}
```

#### WhatsApp Share

```javascript
export async function shareReceipt(canvas, saleData, shopConfig) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], `receipt_${saleData.saleId}.png`, { type: 'image/png' });

  const message = `🧾 ${shopConfig.shop_name}\nBill: ${saleData.saleId}\nTotal: ${shopConfig.currency}${saleData.total}`;

  // Try Web Share API first (native share sheet)
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: message });
    return;
  }

  // Fallback: wa.me deep link (text only, no image attachment)
  const phone = saleData.customer_phone?.replace(/[^0-9]/g, '');
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
}

export function downloadReceipt(canvas, saleId) {
  const link = document.createElement('a');
  link.download = `receipt_${saleId}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
```

### 4.4 Dashboard Module (`modules/dashboard.js`)

#### Real-time Summary Listener

```javascript
import { db } from '../lib/firebase-init.js';
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID } from '../shop.config.js';

export function initDashboard() {
  const summaryRef = doc(db, 'shops', SHOP_ID, 'summary');

  // Real-time listener — fires immediately from cache, then updates from server
  onSnapshot(summaryRef, { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const fromCache = snapshot.metadata.fromCache;

    renderSummaryCards(data);
    renderBarChart(data.last_7_days || []);
    updateSyncStatus(fromCache);
  });
}

function renderSummaryCards(data) {
  document.getElementById('today-count').textContent = data.today_count || 0;
  document.getElementById('today-revenue').textContent = data.today_revenue || 0;
  document.getElementById('week-count').textContent = data.week_count || 0;
  document.getElementById('week-revenue').textContent = data.week_revenue || 0;
  document.getElementById('month-count').textContent = data.month_count || 0;
  document.getElementById('month-revenue').textContent = data.month_revenue || 0;
}

function updateSyncStatus(fromCache) {
  const el = document.getElementById('sync-status');
  if (fromCache) {
    el.textContent = '⏳ Offline — showing cached data';
    el.className = 'sync-offline';
  } else {
    el.textContent = `✓ Synced ${new Date().toLocaleTimeString('en-IN')}`;
    el.className = 'sync-online';
  }
}
```

#### CSS Bar Chart (Zero JS Dependencies)

```html
<!-- 7-day revenue chart — rendered via CSS only -->
<div class="chart" id="bar-chart">
  <!-- JS sets --height custom property on each bar -->
  <div class="chart-bar" style="--height: 80%"><span>Mon</span></div>
  <div class="chart-bar" style="--height: 45%"><span>Tue</span></div>
  <div class="chart-bar" style="--height: 100%"><span>Wed</span></div>
  <!-- ... 7 bars total -->
</div>
```

```css
.chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 160px;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}

.chart-bar {
  flex: 1;
  background: var(--theme-color, #2563eb);
  height: var(--height, 0%);
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 4px;
  transition: height 0.3s ease;
}

.chart-bar span {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #666;
}
```

```javascript
function renderBarChart(last7Days) {
  const container = document.getElementById('bar-chart');
  if (!last7Days.length) return;

  const max = Math.max(...last7Days.map((d) => d.revenue));
  container.innerHTML = last7Days
    .map((day) => {
      const pct = max > 0 ? Math.round((day.revenue / max) * 100) : 0;
      const label = new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
      return `<div class="chart-bar" style="--height: ${pct}%"><span>${label}</span></div>`;
    })
    .join('');
}
```

### 4.5 Export Module (`modules/export.js`)

#### Excel Export via SheetJS

```javascript
// Lazy-load SheetJS only when export is triggered
let XLSX = null;

async function loadSheetJS() {
  if (XLSX) return;
  const module = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs');
  XLSX = module;
}

export async function exportSales(period = 'month') {
  await loadSheetJS();

  const { collection, query, where, getDocs, orderBy } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );
  const { db } = await import('../lib/firebase-init.js');
  const { SHOP_ID, SHOP_NAME } = await import('../shop.config.js');

  // Build query based on period
  const salesRef = collection(db, 'shops', SHOP_ID, 'sales');
  let q;

  if (period === 'month') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    q = query(salesRef, where('timestamp', '>=', startOfMonth), orderBy('timestamp', 'desc'));
  } else {
    q = query(salesRef, orderBy('timestamp', 'desc'));
  }

  // Show progress for large exports
  showExportProgress(true);

  const snapshot = await getDocs(q);
  const rows = [];

  snapshot.forEach((doc) => {
    const sale = doc.data();
    rows.push({
      'Sale ID': doc.id,
      'Date/Time': sale.timestamp?.toDate?.()
        ? sale.timestamp.toDate().toLocaleString('en-IN')
        : 'Pending sync',
      'Items': sale.items.map((i) => i.name).join(', '),
      'Qty': sale.items.reduce((sum, i) => sum + i.qty, 0),
      'Subtotal': sale.subtotal,
      'Discount': sale.discount,
      'Total': sale.total,
      'Customer Phone': sale.customer_phone || ''
    });
  });

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key]).length))
  }));
  ws['!cols'] = colWidths;

  // Generate filename
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filename = `${SHOP_NAME.replace(/\s+/g, '_')}_sales_${monthKey}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
  showExportProgress(false);
}

export async function exportInventory() {
  await loadSheetJS();

  const { collection, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );
  const { db } = await import('../lib/firebase-init.js');
  const { SHOP_ID, SHOP_NAME } = await import('../shop.config.js');

  const snapshot = await getDocs(collection(db, 'shops', SHOP_ID, 'inventory'));
  const rows = [];

  snapshot.forEach((doc) => {
    const item = doc.data();
    rows.push({
      'Item ID': doc.id,
      'Name': item.name,
      'Unit': item.unit,
      'Price': item.price,
      'Current Stock': item.stock,
      'Low Stock Threshold': item.low_stock_threshold,
      'Status': item.stock <= item.low_stock_threshold ? '⚠ LOW' : 'OK'
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

  const today = new Date().toISOString().slice(0, 10);
  const filename = `${SHOP_NAME.replace(/\s+/g, '_')}_inventory_${today}.xlsx`;

  XLSX.writeFile(wb, filename);
}

function showExportProgress(show) {
  const el = document.getElementById('export-progress');
  if (el) el.style.display = show ? 'block' : 'none';
}
```

**Export Design Notes:**
- SheetJS is loaded lazily (only when the user clicks Export) — saves ~90KB on
  initial load
- Queries run against Firestore cache first (instant), then fetch from server
  if online — so export works offline
- `getDocs()` is used (one-time fetch) rather than `onSnapshot()` since export
  is a point-in-time operation
- Column auto-sizing ensures readable Excel output

### 4.6 Inventory Module (`modules/inventory.js`)

```javascript
import { db } from '../lib/firebase-init.js';
import {
  collection, doc, onSnapshot, addDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID } from '../shop.config.js';

const inventoryRef = collection(db, 'shops', SHOP_ID, 'inventory');

export function initInventory() {
  // Real-time listener — updates UI when stock changes (e.g., after a sale)
  onSnapshot(inventoryRef, (snapshot) => {
    const items = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
    renderInventoryList(items);
  });
}

export async function addItem(name, unit, price, stock, lowStockThreshold) {
  await addDoc(inventoryRef, {
    name,
    unit,
    price: Number(price),
    stock: Number(stock),
    low_stock_threshold: Number(lowStockThreshold)
  });
}

export async function updateItem(itemId, updates) {
  const itemRef = doc(db, 'shops', SHOP_ID, 'inventory', itemId);
  await updateDoc(itemRef, updates);
}

function renderInventoryList(items) {
  const container = document.getElementById('inventory-list');
  container.innerHTML = items
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const isLow = item.stock <= item.low_stock_threshold;
      return `
        <div class="inventory-item ${isLow ? 'low-stock' : ''}">
          <div class="item-name">${item.name}</div>
          <div class="item-stock">${item.stock} ${item.unit}</div>
          <div class="item-price">₹${item.price}/${item.unit}</div>
          ${isLow ? '<span class="badge-low">Low Stock</span>' : ''}
        </div>
      `;
    })
    .join('');
}
```

### 4.7 Settings Module (`modules/settings.js`)

```javascript
import { auth, db } from '../lib/firebase-init.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID } from '../shop.config.js';

const configRef = doc(db, 'shops', SHOP_ID, 'config');

export async function addStaffPhone(phoneNumber) {
  // Validate format: must start with + and country code
  if (!/^\+\d{10,15}$/.test(phoneNumber)) {
    throw new Error('Invalid phone format. Use +91XXXXXXXXXX');
  }
  await updateDoc(configRef, {
    authorized_phones: arrayUnion(phoneNumber)
  });
}

export async function removeStaffPhone(phoneNumber) {
  const config = await getDoc(configRef);
  const phones = config.data().authorized_phones;

  // Prevent removing the last authorized phone (owner lockout protection)
  if (phones.length <= 1) {
    throw new Error('Cannot remove the last authorized phone number');
  }

  await updateDoc(configRef, {
    authorized_phones: arrayRemove(phoneNumber)
  });
}

export async function handleSignOut() {
  await signOut(auth);
  window.location.hash = '#/login';
}
```

---

## 5. Service Worker & PWA

### 5.1 Service Worker (`sw.js`)

```javascript
const CACHE_NAME = 'vikretha-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/shop.config.js',
  '/styles.css',
  '/manifest.json',
  '/modules/auth.js',
  '/modules/billing.js',
  '/modules/receipt.js',
  '/modules/dashboard.js',
  '/modules/inventory.js',
  '/modules/export.js',
  '/modules/settings.js',
  '/lib/firebase-init.js'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first for Firebase
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Let Firebase SDK handle its own requests (auth, firestore)
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // Don't intercept — let browser/SDK handle caching
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

### 5.2 PWA Manifest (`manifest.json`)

```json
{
  "name": "Vikretha Shop Manager",
  "short_name": "Vikretha",
  "description": "Free shop billing & inventory management",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 6. Routing

### 6.1 Hash-Based Router

```javascript
// app.js
const routes = {
  '#/login': () => import('./modules/auth.js').then((m) => m.renderLogin()),
  '#/dashboard': () => import('./modules/dashboard.js').then((m) => m.initDashboard()),
  '#/sale': () => import('./modules/billing.js').then((m) => m.renderSaleForm()),
  '#/inventory': () => import('./modules/inventory.js').then((m) => m.initInventory()),
  '#/settings': () => import('./modules/settings.js').then((m) => m.renderSettings()),
};

function navigate() {
  const hash = window.location.hash || '#/dashboard';
  const route = routes[hash];
  if (route) {
    document.getElementById('app').innerHTML = ''; // Clear
    route();
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);
```

**Routing Notes:**
- Hash-based routing (`/#/route`) works on GitHub Pages without custom 404 pages
- Each module is lazy-loaded via dynamic `import()` — only downloaded when needed
- No framework, no router library — ~20 lines of code total

---

## 7. Configuration

### 7.1 Shop Configuration File (`shop.config.js`)

```javascript
// ─── Firebase Configuration ───────────────────────────────────────────
// Get these values from: Firebase Console → Project Settings → Web App
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSy_____________________YOUR_KEY_HERE',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef123456'
};

// ─── Shop Configuration ───────────────────────────────────────────────
export const SHOP_ID = 'my-kirana-store';  // Firestore document path
export const SHOP_NAME = 'My Kirana Store';
export const CURRENCY = '₹';
export const THEME_COLOR = '#2563eb';
export const WHATSAPP_NUMBER = '919876543210'; // Without +
export const LOGO_URL = '/icons/logo.png'; // Optional
```

**Configuration Notes:**
- Firebase API keys are NOT secrets — they identify the project but don't grant
  access (Security Rules + Auth handle authorization)
- `SHOP_ID` is the Firestore document path — must match what's in the Security
  Rules and the `config` document
- All configuration is in one file — easy for shop owners to edit

---

## 8. Summary Reset Logic

The `summary` document stores running totals that need resetting at day/week/month
boundaries.

```javascript
// Called before reading/updating summary — checks if reset is needed
async function checkAndResetSummary() {
  const summaryRef = doc(db, 'shops', SHOP_ID, 'summary');
  const summaryDoc = await getDoc(summaryRef);

  if (!summaryDoc.exists()) {
    // First-time setup
    await setDoc(summaryRef, {
      today_count: 0, today_revenue: 0, today_date: todayStr(),
      week_count: 0, week_revenue: 0, week_start: weekStartStr(),
      month_count: 0, month_revenue: 0, month_key: monthKey(),
      last_7_days: []
    });
    return;
  }

  const data = summaryDoc.data();
  const updates = {};

  // Daily reset
  if (data.today_date !== todayStr()) {
    // Archive yesterday's revenue into last_7_days before resetting
    const last7 = data.last_7_days || [];
    last7.push({ date: data.today_date, revenue: data.today_revenue });
    if (last7.length > 7) last7.shift(); // Keep only 7 days

    updates.today_count = 0;
    updates.today_revenue = 0;
    updates.today_date = todayStr();
    updates.last_7_days = last7;
  }

  // Weekly reset (Monday)
  if (data.week_start !== weekStartStr()) {
    updates.week_count = 0;
    updates.week_revenue = 0;
    updates.week_start = weekStartStr();
  }

  // Monthly reset
  if (data.month_key !== monthKey()) {
    updates.month_count = 0;
    updates.month_revenue = 0;
    updates.month_key = monthKey();
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(summaryRef, updates);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(now.setDate(diff)).toISOString().slice(0, 10);
}

function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
```

---

## 9. Security Implementation

### 9.1 Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://www.gstatic.com https://cdn.sheetjs.com https://www.google.com;
  style-src 'self' 'unsafe-inline';
  connect-src https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com;
  img-src 'self' data: blob:;
  frame-src https://*.firebaseapp.com https://www.google.com;
">
```

**CSP Notes:**
- `frame-src` allows `firebaseapp.com` for reCAPTCHA invisible widget
- `connect-src` allows Firestore and Auth API endpoints
- `img-src blob:` allows Canvas-generated receipt images
- `script-src` allows Firebase CDN and SheetJS CDN
- No `eval()`, no inline scripts (other than style for chart bars)

### 9.2 Input Validation

```javascript
// All user inputs are validated before writing to Firestore
function validateSaleItem(item) {
  if (typeof item.name !== 'string' || item.name.length > 100) return false;
  if (typeof item.qty !== 'number' || item.qty <= 0 || item.qty > 9999) return false;
  if (typeof item.price !== 'number' || item.price < 0 || item.price > 999999) return false;
  return true;
}

function sanitizePhoneNumber(phone) {
  // Strip everything except digits and leading +
  return phone.replace(/[^\d+]/g, '').slice(0, 15);
}
```

### 9.3 Rate Limiting Considerations

- Firebase Auth has built-in rate limiting for OTP sends (prevents abuse)
- Firestore has per-document write rate limits (1 write/second per document) —
  the `summary` document could be a bottleneck for very rapid sales, but at
  realistic human speeds (1 sale per minute max), this is fine
- No client-side rate limiting needed — Firebase handles it server-side

---

## 10. Deployment

### 10.1 GitHub Pages Setup

1. Repository must be **public** (or use GitHub Pro for private Pages)
2. Go to Settings → Pages → Source: `main` branch, `/` (root)
3. HTTPS is automatically enforced by GitHub Pages
4. Custom domain: optional (CNAME record → `username.github.io`)

### 10.2 Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project (free tier — no billing required)
3. **Authentication** → Sign-in method → Enable "Phone"
4. **Firestore Database** → Create database → Start in **production mode**
5. **Firestore** → Rules → Paste Security Rules from §3.3
6. **Project Settings** → Web App → Register app → Copy config object
7. Paste config into `shop.config.js`

### 10.3 Initial Data Setup

After first login, the shop owner needs to create the initial documents:

```javascript
// One-time setup script (run from browser console or a setup page)
import { db } from './lib/firebase-init.js';
import { doc, setDoc } from 'firebase/firestore';

const SHOP_ID = 'my-kirana-store';

// Create config document with owner's phone
await setDoc(doc(db, 'shops', SHOP_ID, 'config'), {
  shop_name: 'My Kirana Store',
  currency: '₹',
  whatsapp_number: '919876543210',
  authorized_phones: ['+919876543210'],  // Owner's phone
  created_at: new Date()
});

// Create summary document
await setDoc(doc(db, 'shops', SHOP_ID, 'summary'), {
  today_count: 0, today_revenue: 0, today_date: new Date().toISOString().slice(0, 10),
  week_count: 0, week_revenue: 0, week_start: '2026-05-26',
  month_count: 0, month_revenue: 0, month_key: '2026-05',
  last_7_days: []
});

// Create sales counter
await setDoc(doc(db, 'shops', SHOP_ID, 'counters', 'sales_counter'), {
  last_seq: 0
});
```

> **Note:** This will be wrapped in a first-run setup wizard in the UI (Phase 0
> of the roadmap).

### 10.4 File Structure (Final)

```
vikretha/
├── index.html
├── app.js
├── shop.config.js
├── styles.css
├── manifest.json
├── sw.js
├── firestore.rules          (reference — paste into Firebase Console)
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── modules/
│   ├── auth.js
│   ├── billing.js
│   ├── receipt.js
│   ├── dashboard.js
│   ├── inventory.js
│   ├── export.js
│   └── settings.js
├── lib/
│   └── firebase-init.js
└── docs/
    ├── prd/
    │   └── vikretha-prd.md
    └── trd/
        └── vikretha-trd.md
```

---

## 11. Testing Strategy

### 11.1 Manual Testing Checklist

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Fresh login | Open app → Enter phone → Enter OTP | Dashboard loads |
| Persistent session | Close tab → Reopen | Dashboard loads without login |
| Add sale (online) | New Sale → Add items → Submit | Receipt shown, dashboard updates |
| Add sale (offline) | Disable WiFi → Submit sale | Receipt shown, ⏳ badge |
| Offline sync | Re-enable WiFi | ⏳ badge disappears |
| Export sales | Dashboard → Export → Sales (This Month) | .xlsx downloads |
| Export inventory | Dashboard → Export → Inventory | .xlsx downloads |
| Add inventory item | Inventory → Add → Fill form → Save | Item appears in list |
| Low stock flag | Set stock below threshold | Red badge appears |
| WhatsApp share | After sale → Share | WhatsApp opens with message |
| Sign out | Settings → Sign Out | Login screen appears |
| Unauthorized access | Sign in with non-authorized phone | Cannot read any data |

### 11.2 Offline Testing

1. Open app and complete login
2. In Chrome DevTools → Application → Service Workers → Check "Offline"
3. Navigate between routes — all should load from cache
4. Submit a sale — should succeed (Firestore offline write)
5. Check IndexedDB — sale should be in pending writes
6. Uncheck "Offline" — sale should sync to server

---

## 12. Monitoring & Observability

Since there's no custom server, monitoring is limited to:

| What | How |
|------|-----|
| Firestore usage | Firebase Console → Usage tab (reads/writes/storage) |
| Auth usage | Firebase Console → Authentication → Usage |
| App errors | `window.onerror` + optional write to a `logs` collection (uses writes quota) |
| Uptime | GitHub Pages has 99.9% uptime; Firebase has 99.95% SLA |

> **Recommendation:** For MVP, rely on Firebase Console dashboards. Add error
> logging only if debugging becomes necessary.

---

## 13. Migration Path (Future)

If the app outgrows Firebase free tier (very unlikely for a single shop):

| Trigger | Action |
|---------|--------|
| >20K writes/day | Upgrade to Firebase Blaze (pay-as-you-go, ~$0.18/100K writes) |
| >50K reads/day | Add client-side caching layer + reduce listener scope |
| >1GB storage | Archive old sales to JSON exports |
| Multi-shop platform | Migrate to Supabase/PlanetScale with proper backend |

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Firestore** | Google's NoSQL document database (part of Firebase) |
| **Spark plan** | Firebase's free-forever tier |
| **OTP** | One-Time Password (sent via SMS) |
| **Batch write** | Atomic write operation — all succeed or all fail |
| **Offline persistence** | Firestore SDK stores data in IndexedDB for offline access |
| **onSnapshot** | Real-time listener that fires when data changes |
| **increment()** | Atomic field increment (no read-before-write needed) |
| **Security Rules** | Server-side access control for Firestore documents |
| **PWA** | Progressive Web App — installable, offline-capable web app |
| **SheetJS** | JavaScript library for reading/writing Excel files |
| **Canvas 2D** | Browser API for programmatic image drawing |
