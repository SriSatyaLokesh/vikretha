/**
 * scripts/backfill-summaries.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: reads all existing sales and populates
 * daily_summary/{YYYY-MM-DD} and monthly_summary/{YYYY-MM} documents.
 *
 * HOW TO RUN:
 *   1. Open the app in Chrome and sign in as owner.
 *   2. Open DevTools Console (F12 → Console tab).
 *   3. Paste the entire content of this file and press Enter.
 *   4. Watch console output — it will print progress and "✓ Backfill complete!"
 *
 * SAFE TO RE-RUN:
 *   Uses setDoc (overwrite), so running multiple times produces the same result.
 *   Does NOT use increment() — computes totals from scratch each run.
 *
 * EXPECTED OUTPUT:
 *   Fetching all sales...
 *   Processed 127 sales → 42 daily docs, 4 monthly docs
 *   Writing daily summaries...
 *   Writing monthly summaries...
 *   ✓ Backfill complete!
 * ─────────────────────────────────────────────────────────────────────────────
 */

(async () => {
  const { db }          = await import('./lib/firebase-init.js');
  const { collection, getDocs, doc, setDoc }
                        = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { SHOP_ID }     = await import('./shop.config.js');

  console.log('Fetching all sales...');
  const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'sales'));

  const daily   = {};
  const monthly = {};

  snap.forEach(s => {
    const d = s.data();
    if (!d.timestamp) return;

    const ts       = d.timestamp.toDate();
    const dayKey   = ts.toISOString().slice(0, 10);   // "YYYY-MM-DD"
    const monthKey = dayKey.slice(0, 7);               // "YYYY-MM"
    const total    = d.total || 0;

    if (!daily[dayKey])   daily[dayKey]   = { date: dayKey,     count: 0, revenue: 0 };
    if (!monthly[monthKey]) monthly[monthKey] = { month: monthKey, count: 0, revenue: 0 };

    daily[dayKey].count    += 1;
    daily[dayKey].revenue  += total;
    monthly[monthKey].count   += 1;
    monthly[monthKey].revenue += total;
  });

  const dailyCount   = Object.keys(daily).length;
  const monthlyCount = Object.keys(monthly).length;
  console.log(`Processed ${snap.size} sales → ${dailyCount} daily docs, ${monthlyCount} monthly docs`);

  console.log('Writing daily summaries...');
  for (const [key, data] of Object.entries(daily)) {
    // Round revenue to 2 decimal places to avoid floating point drift
    data.revenue = +data.revenue.toFixed(2);
    await setDoc(doc(db, 'shops', SHOP_ID, 'daily_summary', key), data);
  }

  console.log('Writing monthly summaries...');
  for (const [key, data] of Object.entries(monthly)) {
    data.revenue = +data.revenue.toFixed(2);
    await setDoc(doc(db, 'shops', SHOP_ID, 'monthly_summary', key), data);
  }

  console.log('✓ Backfill complete!');
  console.log(`  daily_summary:   ${dailyCount} documents written`);
  console.log(`  monthly_summary: ${monthlyCount} documents written`);
  console.log('Refresh the dashboard to see historical stats in the bar chart.');
})();
