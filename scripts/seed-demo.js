/**
 * scripts/seed-demo.js
 * Seeds demo data into Firestore: 12 inventory items + 30 days of sales.
 *
 * Uses the Firebase REST API (same pattern as seed-inventory.js).
 * Authenticates with your existing Firebase Email/Password account,
 * then writes documents to /shops/shop_001/.
 *
 * Usage:
 *   node scripts/seed-demo.js <email> <password>
 *
 * Example:
 *   node scripts/seed-demo.js owner@example.com mypassword
 *
 * Requires Node 18+ (built-in fetch). No npm install required.
 */

// ── Firebase project config (from shop.config.js) ──────────────────────────
const API_KEY    = 'AIzaSyCoCUb_y1EOaZ87rS6idIsCCwsFUdXIVAY';
const PROJECT_ID = 'vikretha-8978b';
const SHOP_ID    = 'shop_001';

// ── Inventory items ─────────────────────────────────────────────────────────
const ITEMS = [
  { name: 'Rice',          price: 60,   stock: 50, unit: 'kg',  lowStockThreshold: 5 },
  { name: 'Wheat Flour',   price: 45,   stock: 30, unit: 'kg',  lowStockThreshold: 5 },
  { name: 'Sugar',         price: 50,   stock: 20, unit: 'kg',  lowStockThreshold: 3 },
  { name: 'Cooking Oil',   price: 130,  stock: 15, unit: 'ltr', lowStockThreshold: 2 },
  { name: 'Salt',          price: 20,   stock: 40, unit: 'kg',  lowStockThreshold: 5 },
  { name: 'Toor Dal',      price: 110,  stock: 10, unit: 'kg',  lowStockThreshold: 2 },
  { name: 'Chana Dal',     price: 90,   stock: 8,  unit: 'kg',  lowStockThreshold: 2 },
  { name: 'Turmeric',      price: 160,  stock: 5,  unit: 'kg',  lowStockThreshold: 1 },
  { name: 'Red Chilli',    price: 200,  stock: 4,  unit: 'kg',  lowStockThreshold: 1 },
  { name: 'Mustard Seeds', price: 80,   stock: 6,  unit: 'kg',  lowStockThreshold: 1 },
  { name: 'Coconut Oil',   price: 180,  stock: 10, unit: 'ltr', lowStockThreshold: 2 },
  { name: 'Green Tea',     price: 250,  stock: 12, unit: 'pkt', lowStockThreshold: 2 },
];

// ── Sale item templates (cycled deterministically by saleIndex % 5) ─────────
const SALE_TEMPLATES = [
  [{ name: 'Rice', qty: 2, price: 60 }, { name: 'Sugar', qty: 1, price: 50 }],
  [{ name: 'Cooking Oil', qty: 1, price: 130 }],
  [{ name: 'Wheat Flour', qty: 2, price: 45 }, { name: 'Toor Dal', qty: 1, price: 110 }],
  [{ name: 'Salt', qty: 1, price: 20 }, { name: 'Rice', qty: 1, price: 60 }, { name: 'Turmeric', qty: 1, price: 80 }],
  [{ name: 'Green Tea', qty: 1, price: 250 }],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function toDateString(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

async function patchDoc(base, docId, fields, idToken) {
  const fieldPaths = Object.keys(fields);
  const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${base}/${docId}?${maskParams}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  return res;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [,, email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node scripts/seed-demo.js <email> <password>');
  process.exit(1);
}

async function run() {
  // Step 1: Authenticate
  console.log(`Signing in as ${email}...`);
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const authData = await authRes.json();
  if (!authRes.ok) {
    console.error('Auth failed:', authData.error?.message ?? JSON.stringify(authData));
    process.exit(1);
  }
  const idToken = authData.idToken;
  console.log('Signed in successfully.\n');

  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/shops/${SHOP_ID}`;

  // ── A. Seed inventory ────────────────────────────────────────
  console.log('Seeding inventory...');
  for (const item of ITEMS) {
    const docId = item.name.toLowerCase().replace(/\s+/g, '_');
    try {
      await patchDoc(`${base}/inventory`, docId, {
        name:              { stringValue: item.name },
        price:             { integerValue: String(item.price) },
        stock:             { integerValue: String(item.stock) },
        unit:              { stringValue: item.unit },
        lowStockThreshold: { integerValue: String(item.lowStockThreshold) },
      }, idToken);
      console.log(`  ✓ ${item.name}`);
    } catch (err) {
      console.error(`  ✗ ${item.name}: ${err.message}`);
    }
  }
  console.log('Inventory ✓\n');

  // ── B. Seed sales (30 days) ──────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalSales = 0;
  let globalSaleIndex = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);

    const dateStr  = toDateString(day);
    const salesPerDay = (dayOffset % 4) + 3; // 3 to 6 sales

    console.log(`Seeding sales for ${dateStr} (${salesPerDay} sales)...`);

    for (let n = 1; n <= salesPerDay; n++) {
      const saleId = `${dateStr}-${pad(n, 3)}`;
      const template = SALE_TEMPLATES[globalSaleIndex % 5];

      const items = template.map(t => ({
        mapValue: {
          fields: {
            name:      { stringValue: t.name },
            qty:       { integerValue: String(t.qty) },
            price:     { integerValue: String(t.price) },
            lineTotal: { integerValue: String(t.qty * t.price) },
          }
        }
      }));

      const subtotal = template.reduce((sum, t) => sum + t.qty * t.price, 0);

      // Midday UTC timestamp for the sale day
      const ts = new Date(day);
      ts.setHours(8, 30, 0, 0);

      try {
        await patchDoc(`${base}/sales`, saleId, {
          saleId:    { stringValue: saleId },
          timestamp: { timestampValue: ts.toISOString() },
          items:     { arrayValue: { values: items } },
          subtotal:  { integerValue: String(subtotal) },
          discount:  { integerValue: '0' },
          total:     { integerValue: String(subtotal) },
          phone:     { stringValue: '' },
          shopId:    { stringValue: SHOP_ID },
        }, idToken);
        globalSaleIndex++;
        totalSales++;
      } catch (err) {
        console.error(`  ✗ Sale ${saleId}: ${err.message}`);
        globalSaleIndex++;
      }
    }
    console.log(`  ✓ ${dateStr}`);
  }
  console.log(`Sales ✓ (${totalSales} total)\n`);

  // ── C. Update summary/main ───────────────────────────────────
  console.log('Updating summary...');

  const now = new Date();
  const todayStr  = toDateString(now);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0,0,0,0);

  // Compute from generated sales (simple approximation based on templates)
  let todayCount = 0, todayRevenue = 0;
  let weekCount  = 0, weekRevenue  = 0;
  let monthCount = 0, monthRevenue = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - dayOffset);

    const salesPerDay = (dayOffset % 4) + 3;
    let dayRevenue = 0;
    let tempIdx = 0; // approximate — not tracking exact global index here

    for (let n = 0; n < salesPerDay; n++) {
      const tmpl = SALE_TEMPLATES[(dayOffset * salesPerDay + n) % 5];
      const subtotal = tmpl.reduce((s, t) => s + t.qty * t.price, 0);
      dayRevenue += subtotal;
    }

    // month: all 30 days
    monthCount   += salesPerDay;
    monthRevenue += dayRevenue;

    // week: last 7 days (dayOffset 0–6)
    if (dayOffset <= 6) {
      weekCount   += salesPerDay;
      weekRevenue += dayRevenue;
    }

    // today: dayOffset 0
    if (dayOffset === 0) {
      todayCount   = salesPerDay;
      todayRevenue = dayRevenue;
    }
  }

  try {
    await patchDoc(`${base}/summary`, 'main', {
      todayCount:   { integerValue: String(todayCount) },
      todayRevenue: { integerValue: String(todayRevenue) },
      weekCount:    { integerValue: String(weekCount) },
      weekRevenue:  { integerValue: String(weekRevenue) },
      monthCount:   { integerValue: String(monthCount) },
      monthRevenue: { integerValue: String(monthRevenue) },
      lastUpdated:  { timestampValue: new Date().toISOString() },
    }, idToken);
    console.log('Summary ✓\n');
  } catch (err) {
    console.error(`Summary update failed: ${err.message}`);
  }

  console.log(`Done! Seeded ${ITEMS.length} inventory items and ${totalSales} sales.`);
}

run().catch(err => { console.error(err); process.exit(1); });
