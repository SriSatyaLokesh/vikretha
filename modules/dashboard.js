/**
 * modules/dashboard.js - Dashboard Home
 * Live summary cards + 7-day SVG area chart + monthly report.
 * Exported: render(container) - called by app.js on #/dashboard route.
 */

import { db } from '../lib/firebase-init.js';
import {
  collection, doc, onSnapshot, getDocs, getDoc,
  query, where, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, CURRENCY, LOCALE } from '../shop.config.js';
import { attachExportMenu } from './export.js';
import { drawAreaChart } from '../lib/svg-chart.js';

let _unsubSummary = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _setSlot(container, id, text) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = text;
}

async function _fetchAndRenderStats(container) {
  const now = new Date();
  const fmt = v => CURRENCY + v.toLocaleString(LOCALE, { minimumFractionDigits: 2 });

  // -- Read 30 daily_summary docs (7 for weekly chart + 30 for trend chart) --
  const dayMap = {};
  let todayRev = 0, todayCt = 0, weekRev = 0, weekCt = 0;
  const todayKey = now.toISOString().slice(0, 10);

  const dayPromises = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap[key] = { revenue: 0, count: 0 };
    dayPromises.push(
      getDoc(doc(db, 'shops', SHOP_ID, 'daily_summary', key))
        .then(snap => {
          if (snap.exists()) {
            const data = snap.data();
            dayMap[key].revenue = data.revenue || 0;
            dayMap[key].count   = data.count || 0;
          }
        })
    );
  }
  await Promise.all(dayPromises);

  // Compute today + week totals (last 7 keys only)
  const allDayKeys = Object.keys(dayMap); // oldest first, insertion order
  for (const key of allDayKeys.slice(-7)) {
    weekRev += dayMap[key].revenue;
    weekCt  += dayMap[key].count;
    if (key === todayKey) {
      todayRev = dayMap[key].revenue;
      todayCt  = dayMap[key].count;
    }
  }

  // -- Read 1 monthly_summary doc --
  const monthKey = todayKey.slice(0, 7);
  let monthRev = 0, monthCt = 0;
  try {
    const monthSnap = await getDoc(doc(db, 'shops', SHOP_ID, 'monthly_summary', monthKey));
    if (monthSnap.exists()) {
      monthRev = monthSnap.data().revenue || 0;
      monthCt  = monthSnap.data().count || 0;
    }
  } catch (e) { console.warn('[Dashboard] monthly_summary read failed', e); }

  // -- Render stats --
  _setSlot(container, 'dash-today-rev',  fmt(todayRev));
  _setSlot(container, 'dash-today-ct',   todayCt + ' sale' + (todayCt !== 1 ? 's' : ''));
  _setSlot(container, 'dash-week-rev',   fmt(weekRev));
  _setSlot(container, 'dash-week-ct',    weekCt + ' sale' + (weekCt !== 1 ? 's' : ''));
  _setSlot(container, 'dash-month-rev',  fmt(monthRev));
  _setSlot(container, 'dash-month-ct',   monthCt + ' sale' + (monthCt !== 1 ? 's' : ''));

  // -- Render dual SVG area charts --
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cfmt = { currencyFormatter: v => CURRENCY + v.toLocaleString(LOCALE, { minimumFractionDigits: 2 }) };

  // 7-day chart: day names, today highlighted
  const chart7 = container.querySelector('#dash-chart-7d');
  if (chart7) {
    const data7 = allDayKeys.slice(-7).map(dateKey => ({
      label: DAY_LABELS[new Date(dateKey + 'T00:00:00').getDay()],
      value: dayMap[dateKey].revenue,
      count: dayMap[dateKey].count,
      isToday: dateKey === todayKey
    }));
    drawAreaChart(chart7, data7, cfmt);
  }

  // 30-day chart: show day-of-month label every 5th point + last point
  const chart30 = container.querySelector('#dash-chart-30d');
  if (chart30) {
    const data30 = allDayKeys.map((dateKey, i) => {
      const showLabel = i % 5 === 0 || i === allDayKeys.length - 1;
      return {
        label: showLabel ? String(new Date(dateKey + 'T00:00:00').getDate()) : '',
        value: dayMap[dateKey].revenue,
        count: dayMap[dateKey].count,
        isToday: dateKey === todayKey
      };
    });
    drawAreaChart(chart30, data30, cfmt);
  }
}
function _buildMonthOptions(select) {
  if (!select) return;
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.getFullYear() + '-' + d.getMonth();
    const label = d.toLocaleString(LOCALE, { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  }
}

async function _showMonthlyReport(container, year, month) {
  const revEl  = container.querySelector('#mr-revenue');
  const ctEl   = container.querySelector('#mr-count');
  const top5El = container.querySelector('#mr-top5');
  if (!revEl || !ctEl || !top5El) return;
  revEl.textContent = '...';
  ctEl.textContent  = '...';
  top5El.innerHTML  = '<li style="color:var(--text-muted);font-size:0.8rem;">Loading...</li>';
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const q = query(
    collection(db, 'shops', SHOP_ID, 'sales'),
    where('timestamp', '>=', Timestamp.fromDate(monthStart)),
    where('timestamp', '<=', Timestamp.fromDate(monthEnd))
  );
  const snap = await getDocs(q);
  let totalRev = 0, totalCt = 0;
  const productMap = {};
  snap.forEach(docSnap => {
    const d = docSnap.data();
    totalRev += d.total || 0;
    totalCt  += 1;
    (d.items || []).forEach(item => {
      if (!productMap[item.item_id]) {
        productMap[item.item_id] = { name: item.name || item.item_id, revenue: 0 };
      }
      productMap[item.item_id].revenue += item.line_total || 0;
    });
  });
  const fmt = v => CURRENCY + v.toLocaleString(LOCALE, { minimumFractionDigits: 2 });
  revEl.textContent = fmt(totalRev);
  ctEl.textContent  = String(totalCt);
  const top5 = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  if (top5.length === 0) {
    top5El.innerHTML = '<li style="color:var(--text-muted);font-size:0.8rem;list-style:none;">No sales this month.</li>';
    return;
  }
  top5El.innerHTML = '';
  top5.forEach(p => {
    const li = document.createElement('li');
    li.className = 'top-products-item';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'top-products-name';
    nameSpan.textContent = p.name;
    const revSpan = document.createElement('span');
    revSpan.className = 'top-products-rev';
    revSpan.textContent = fmt(p.revenue);
    li.appendChild(nameSpan);
    li.appendChild(revSpan);
    top5El.appendChild(li);
  });
}

export function render(container) {
  _unsubSummary?.();

  container.innerHTML = `
    <div id="dashboard-screen">

      <!-- New Sale CTA -->
      <div id="new-sale-card" class="new-sale-cta" role="button" tabindex="0" aria-label="Start a new sale">
        <div>
          <p class="new-sale-cta-text">Ready to record?</p>
          <p class="new-sale-cta-label">New Sale</p>
        </div>
        <div class="new-sale-cta-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
      </div>

      <!-- Stats row -->
      <div class="section-header" style="margin-bottom:10px;">
        <span class="section-title">Summary</span>
        <span id="dash-sync-badge" class="sync-badge">Loading...</span>
      </div>
      <div class="dashboard-stats" style="margin-bottom:20px;">
        <div class="stat-card">
          <div class="stat-card-icon stat-card-icon-orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 12h8M8 16h5"/></svg>
          </div>
          <div class="stat-card-label">Today</div>
          <div id="dash-today-rev" class="stat-card-value">--</div>
          <div id="dash-today-ct" class="stat-card-sub">--</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon stat-card-icon-green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div class="stat-card-label">This Week</div>
          <div id="dash-week-rev" class="stat-card-value">--</div>
          <div id="dash-week-ct" class="stat-card-sub">--</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon stat-card-icon-blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div class="stat-card-label">This Month</div>
          <div id="dash-month-rev" class="stat-card-value">--</div>
          <div id="dash-month-ct" class="stat-card-sub">--</div>
        </div>
      </div>

      <!-- Sales trend charts (7-day + 30-day) -->
      <div class="dash-charts-row">
        <div class="card">
          <div class="section-header" style="margin-bottom:10px;">
            <span class="section-title">Last 7 Days</span>
          </div>
          <div id="dash-chart-7d" class="svg-chart-wrap"></div>
        </div>
        <div class="card">
          <div class="section-header" style="margin-bottom:10px;">
            <span class="section-title">Last 30 Days</span>
          </div>
          <div id="dash-chart-30d" class="svg-chart-wrap"></div>
        </div>
      </div>

      <!-- Monthly Report -->
      <div id="monthly-report-card" class="card" style="margin-bottom:16px;">
        <div class="monthly-report-header">
          <h2 class="monthly-report-title">Monthly Report</h2>
          <select id="dash-month-picker" class="month-picker-select" aria-label="Select month"></select>
        </div>
        <div class="monthly-stats-row">
          <div class="monthly-stat-box">
            <p class="monthly-stat-label">Revenue</p>
            <p id="mr-revenue" class="monthly-stat-value">--</p>
          </div>
          <div class="monthly-stat-box">
            <p class="monthly-stat-label">Sales</p>
            <p id="mr-count" class="monthly-stat-value">--</p>
          </div>
        </div>
        <div class="section-header" style="margin-bottom:10px;">
          <span class="section-title" style="font-size:0.875rem;">Top 5 Products</span>
        </div>
        <div id="mr-top5" class="top-products-list"></div>
      </div>

      <!-- Export -->
      <div id="dash-export-anchor"></div>

    </div>`;

  // New Sale card interactions
  const card = container.querySelector('#new-sale-card');
  const goToSale = () => { window.location.hash = '#/billing'; };
  card.addEventListener('click', goToSale);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSale(); }
  });

  // Monthly report: build picker + load current month
  _buildMonthOptions(container.querySelector('#dash-month-picker'));
  const now = new Date();
  _showMonthlyReport(container, now.getFullYear(), now.getMonth());
  container.querySelector('#dash-month-picker')
    ?.addEventListener('change', e => {
      const [y, m] = e.target.value.split('-').map(Number);
      _showMonthlyReport(container, y, m);
    });

  // Firestore onSnapshot -- refresh stats when today's daily_summary doc changes
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyRef = doc(db, 'shops', SHOP_ID, 'daily_summary', todayKey);
  _unsubSummary = onSnapshot(dailyRef, snap => {
    const syncBadge = container.querySelector('#dash-sync-badge');
    if (syncBadge) {
      const fromCache = snap.metadata.fromCache;
      const ts = snap.data()?.last_updated;
      if (ts && ts.toDate) {
        const d = ts.toDate();
        syncBadge.textContent = (fromCache ? 'cached ' : 'synced ') +
          d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
      } else {
        syncBadge.textContent = fromCache ? 'cached...' : 'synced';
      }
      syncBadge.className = 'sync-badge ' + (fromCache ? 'sync-badge--pending' : 'sync-badge--synced');
    }

    // -- Live today counter fast-path (Phase 19) --
    // Read today rev/count directly from the snapshot -- instant update,
    // no extra Firestore reads. The full _fetchAndRenderStats below
    // will also update them, but only after 7 async getDoc calls.
    const snapData = snap.data() || {};
    const liveRev = snapData.revenue || 0;
    const liveCt  = snapData.count   || 0;
    const fmt = v => CURRENCY + v.toLocaleString(LOCALE, { minimumFractionDigits: 2 });
    _setSlot(container, 'dash-today-rev', fmt(liveRev));
    _setSlot(container, 'dash-today-ct',  liveCt + ' sale' + (liveCt !== 1 ? 's' : ''));
    // ---------------------------------------------

    _fetchAndRenderStats(container);
  }, { includeMetadataChanges: true });

  // Wire export menu (Phase 7)
  attachExportMenu(container);
}
