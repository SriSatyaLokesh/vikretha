/**
 * app.js — Vikretha Application Entry Point
 * Hash router + Firebase auth guard + lazy module loader
 */
import { auth } from './lib/firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { SHOP_NAME, THEME_COLOR } from './shop.config.js';

// ----- App Shell -----
function mountAppShell() {
  const root = document.getElementById('app');
  if (root.querySelector('.app-shell')) return; // already mounted
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header" style="background: ${THEME_COLOR}">
        <h1 id="page-title">${SHOP_NAME}</h1>
        <div id="header-actions"></div>
      </header>
      <main class="app-content" id="app-content"></main>
      <nav class="app-nav" id="app-nav">
        <a href="#/dashboard" data-route="dashboard" aria-label="Dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Dashboard
        </a>
        <a href="#/billing" data-route="billing" aria-label="New Sale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Sale
        </a>
        <a href="#/inventory" data-route="inventory" aria-label="Inventory">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Stock
        </a>
        <a href="#/reports" data-route="reports" aria-label="Reports">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Reports
        </a>
        <a href="#/settings" data-route="settings" aria-label="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </a>
      </nav>
    </div>
  `;
}

// ----- Auth Guard + Router -----
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user) {
    // Not authenticated — show login, hide app shell nav
    showLoginScreen();
  } else {
    // Authenticated — mount shell and route
    mountAppShell();
    handleRoute();
  }
});

function showLoginScreen() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div id="login-screen" style="display:flex;align-items:center;justify-content:center;min-height:100dvh;background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;text-align:center;">
        <h1 style="font-size:1.5rem;margin-bottom:8px;">${SHOP_NAME}</h1>
        <p style="color:var(--text-secondary);margin-bottom:24px;">Loading authentication...</p>
        <div class="spinner" style="margin:0 auto;"></div>
      </div>
    </div>
  `;
  // Load auth module to handle actual OTP flow (Phase 2)
  import('./modules/auth.js').then(m => m.render(document.getElementById('login-screen'))).catch(() => {
    // Auth module not yet built (Phase 1) — show placeholder
    document.querySelector('#login-screen p').textContent = 'Sign-in module coming in Phase 2';
  });
}

// ----- Route Handler -----
const PROTECTED_ROUTES = ['dashboard', 'billing', 'inventory', 'reports', 'settings'];

async function handleRoute() {
  const hash = window.location.hash || '#/login';
  const route = hash.replace('#/', '') || 'login';

  // If unauthenticated and trying to access protected route → redirect
  if (!currentUser && PROTECTED_ROUTES.includes(route)) {
    window.location.hash = '#/login';
    return;
  }

  // Update active nav link
  document.querySelectorAll('.app-nav a[data-route]').forEach(link => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    const titles = { dashboard: SHOP_NAME, billing: 'New Sale', inventory: 'Inventory', reports: 'Reports', settings: 'Settings' };
    titleEl.textContent = titles[route] || SHOP_NAME;
  }

  // Lazy load and render the route module
  const content = document.getElementById('app-content');
  if (!content) return;
  content.innerHTML = '<div style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>';

  try {
    const module = await import(`./modules/${route}.js`);
    module.render(content);
  } catch (_) {
    content.innerHTML = `
      <div class="empty-state">
        <p style="font-size:1.5rem;margin-bottom:8px;">🚧</p>
        <p><strong>${route}</strong> coming soon</p>
        <p style="margin-top:8px;font-size:0.8rem;">Phase implementation pending</p>
      </div>
    `;
  }
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
  if (currentUser) handleRoute();
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
