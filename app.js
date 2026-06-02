/**
 * app.js — Vikretha Application Entry Point
 * Hash router + Firebase auth guard + lazy module loader
 */
import { auth } from './lib/firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { SHOP_NAME } from './shop.config.js';

// ----- App Shell -----
// ── SVG icons for nav ───────────────────────────────────────────────────────
const NAV_ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
  billing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>`,
  inventory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>`,
  reports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

const NAV_ITEMS = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'billing',   label: 'Sale' },
  { route: 'inventory', label: 'Inventory' },
  { route: 'reports',   label: 'Reports' },
  { route: 'settings',  label: 'Settings' },
];

const SHOP_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;

function buildNavItem(r, forSidebar) {
  const icon = NAV_ICONS[r.route] || '';
  if (forSidebar) {
    return `<a href="#/${r.route}" data-route="${r.route}" class="sidebar-nav-item" aria-label="${r.label}">${icon}${r.label}</a>`;
  }
  return `<a href="#/${r.route}" data-route="${r.route}" aria-label="${r.label}">${icon}${r.label}</a>`;
}

function mountAppShell() {
  const root = document.getElementById('app');
  if (root.querySelector('.app-shell')) return; // already mounted

  root.innerHTML = `
    <div class="app-shell">

      <!-- Desktop sidebar -->
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">${SHOP_ICON_SVG}</div>
          <span class="sidebar-brand-name">${SHOP_NAME}</span>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav-list">
          ${NAV_ITEMS.map(r => buildNavItem(r, true)).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-avatar" id="sidebar-avatar">?</div>
            <span class="sidebar-user-email" id="sidebar-email"></span>
          </div>
        </div>
      </aside>

      <!-- Main content area -->
      <div class="app-main">
        <header class="app-header">
          <h1 class="page-title" id="page-title">${SHOP_NAME}</h1>
          <div id="header-actions"></div>
        </header>
        <main class="app-content" id="app-content"></main>
      </div>

      <!-- Mobile bottom nav -->
      <nav class="app-nav" id="app-nav">
        ${NAV_ITEMS.map(r => buildNavItem(r, false)).join('')}
      </nav>

    </div>
  `;

  // Show current user email in sidebar
  import('./lib/firebase-init.js').then(({ auth }) => {
    const user = auth.currentUser;
    if (user?.email) {
      const emailEl = document.getElementById('sidebar-email');
      const avatarEl = document.getElementById('sidebar-avatar');
      if (emailEl) emailEl.textContent = user.email;
      if (avatarEl) avatarEl.textContent = user.email[0].toUpperCase();
    }
  }).catch(() => {});
}

// ----- Auth Guard + Router -----
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    // Unauthenticated — render auth screen fullscreen (no app shell)
    const root = document.getElementById('app');
    root.innerHTML = '';
    import('./modules/auth.js').then(m => m.render(root)).catch(console.error);
  } else {
    // Authenticated — mount shell, then route
    mountAppShell();
    const route = (window.location.hash.replace('#/', '') || '').split('/')[0];
    if (!route || route === 'login') {
      // Root or login page → send to dashboard (triggers hashchange → handleRoute)
      window.location.hash = '#/dashboard';
    } else {
      handleRoute();
    }
  }
});

// ----- Route Handler -----
const PROTECTED_ROUTES = ['dashboard', 'billing', 'inventory', 'reports', 'settings', 'receipt'];

async function handleRoute() {
  const hash = window.location.hash;
  const routeParts = (hash.replace('#/', '') || 'dashboard').split('/');
  const route      = routeParts[0] || 'dashboard';
  const routeParam = routeParts.length > 1
    ? decodeURIComponent(routeParts.slice(1).join('/'))
    : null;

  // If unauthenticated and trying to access protected route → show auth fullscreen
  if (!currentUser && PROTECTED_ROUTES.includes(route)) {
    const root = document.getElementById('app');
    root.innerHTML = '';
    import('./modules/auth.js').then(m => m.render(root)).catch(console.error);
    return;
  }

  // Logged-in user visiting / or login → dashboard
  if (currentUser && (!route || route === 'login')) {
    window.location.hash = '#/dashboard';
    return;
  }

  // Update active nav links (both bottom nav and sidebar)
  document.querySelectorAll('[data-route]').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    const titles = { dashboard: SHOP_NAME, billing: 'New Sale', inventory: 'Inventory', reports: 'Reports', settings: 'Settings', receipt: 'Receipt' };
    titleEl.textContent = titles[route] || SHOP_NAME;
  }

  // Lazy load and render the route module
  const content = document.getElementById('app-content');
  if (!content) return;
  content.innerHTML = '<div style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    const module = await import(`./modules/${route}.js`);
    module.render(content, routeParam);
  } catch (err) {
    const isNotFound = err?.message?.includes('Failed to fetch') ||
                       err?.message?.includes('dynamically imported') ||
                       err?.name   === 'TypeError';
    content.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;padding:24px;">
        <div style="
          background:var(--bg-surface);
          border:1px solid var(--border);
          border-radius:16px;
          padding:40px 32px;
          max-width:360px;
          width:100%;
          text-align:center;
          box-shadow:var(--shadow-md);
        ">
          <div style="
            width:64px;height:64px;
            background:var(--danger-bg);
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 20px;
            font-size:1.75rem;
          ">⚠️</div>
          <h2 style="
            font-size:1.125rem;
            font-weight:700;
            color:var(--text-primary);
            margin:0 0 8px;
          ">Unable to load page</h2>
          <p style="
            font-size:0.875rem;
            color:var(--text-secondary);
            margin:0 0 24px;
            line-height:1.5;
          ">${isNotFound
              ? 'The server did not respond. Check your internet connection and try again.'
              : 'Something went wrong while loading this page.'}
          </p>
          <button
            onclick="window.location.reload()"
            style="
              display:inline-flex;align-items:center;gap:8px;
              padding:10px 20px;
              background:var(--primary);
              color:var(--primary-text);
              border:none;
              border-radius:8px;
              font:600 0.875rem/1 inherit;
              cursor:pointer;
              transition:background 0.15s;
            "
            onmouseover="this.style.background='var(--primary-hover)'"
            onmouseout="this.style.background='var(--primary)'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
            Retry
          </button>
        </div>
      </div>
    `;
  }
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
  if (!currentUser) return;
  const route = (window.location.hash.replace('#/', '') || '').split('/')[0];
  if (!route || route === 'login') {
    window.location.hash = '#/dashboard';
    return;
  }
  handleRoute();
});

// ----- Navigation Helper -----
export function navigateTo(route) {
  window.location.hash = `#/${route}`;
}

// ----- Service Worker Registration -----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => {
      console.log('[Vikretha] Service worker registered');
    }).catch(err => {
      console.warn('[Vikretha] Service worker registration failed:', err);
    });
  });
}
