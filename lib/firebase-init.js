/**
 * firebase-init.js
 * Initializes Firebase and enables Firestore offline persistence.
 * Import { auth, db } from this module — never call initializeApp elsewhere.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  enableIndexedDbPersistence,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { FIREBASE_CONFIG, SHOP_ID, COLOR_THEME } from '../shop.config.js';

// ── Config validation ───────────────────────────────────────────────
function _isConfigValid(cfg) {
  return cfg && cfg.apiKey && cfg.projectId && cfg.appId &&
    !cfg.apiKey.includes('YOUR') && !cfg.projectId.includes('your-') &&
    cfg.apiKey.length > 10;
}

if (!_isConfigValid(FIREBASE_CONFIG)) {
  document.documentElement.innerHTML = `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Vikretha — Setup Required</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px}
      .setup-panel{max-width:480px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:36px 32px}
      h1{font-size:1.4rem;color:#1e293b;margin-bottom:8px}
      p{color:#475569;font-size:.9rem;line-height:1.6;margin-bottom:16px}
      code{background:#f1f5f9;border-radius:4px;padding:2px 6px;font-size:.85rem;color:#0f172a}
      ol{padding-left:20px;color:#475569;font-size:.9rem;line-height:2}
      a{color:#2563eb}
    </style>
    <body>
      <div class="setup-panel">
        <h1>⚙️ Setup Required</h1>
        <p>Your Firebase configuration is missing or incomplete. Open <code>shop.config.js</code> and fill in your Firebase credentials.</p>
        <ol>
          <li>Go to <a href="https://console.firebase.google.com/" target="_blank">Firebase Console</a> → Project Settings → Your apps</li>
          <li>Copy the <code>firebaseConfig</code> object</li>
          <li>Paste the values into <code>FIREBASE_CONFIG</code> in <code>shop.config.js</code></li>
          <li>Set <code>SHOP_NAME</code> and <code>SHOP_ID</code> to your shop values</li>
          <li>Commit and push — the app will reload automatically on GitHub Pages</li>
        </ol>
        <p style="margin-top:16px">See <a href="README.md">README.md</a> for full setup instructions.</p>
      </div>
    </body>`;
  throw new Error('[Vikretha] Firebase config missing — see Setup Required panel');
}

const app = initializeApp(FIREBASE_CONFIG);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence — queues writes in IndexedDB when offline
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence only available in one tab at a time
    console.warn('[Vikretha] Firestore offline persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB (very rare)
    console.warn('[Vikretha] Firestore offline persistence not supported in this browser');
  }
});

export { app };

// ── Theme utilities ───────────────────────────────────────────────

/**
 * Apply a palette + dark mode to the <html> element instantly.
 * themeId: palette id from THEME_PALETTES (e.g. 'emerald'). Pass 'orange' or '' for default.
 * dark: boolean — true applies [data-dark="true"] attribute.
 */
export function applyTheme(themeId, dark) {
  const html = document.documentElement;
  if (themeId && themeId !== 'orange') {
    html.setAttribute('data-theme', themeId);
  } else {
    html.removeAttribute('data-theme');
  }
  if (dark) {
    html.setAttribute('data-dark', 'true');
  } else {
    html.removeAttribute('data-dark');
  }
}

/**
 * Load dark mode preference from Firestore config/main and apply.
 * Color palette is set by COLOR_THEME in shop.config.js (not stored per-user).
 * Call after authentication succeeds. Falls back silently on error.
 */
export async function loadThemeFromFirestore() {
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const theme = snap.data().theme || COLOR_THEME;
      const dark  = localStorage.getItem('vk_dark') === 'true';
      localStorage.setItem('vk_theme', theme); // cache so _applyCachedTheme works on next reload
      applyTheme(theme, dark);
    }
  } catch (err) {
    // Non-fatal — cached dark mode already applied on load
    console.warn('[Vikretha] Could not sync dark mode from Firestore:', err);
  }
}


/**
 * Read the shop's config/main Firestore document.
 * Returns the document data object, or {} if it doesn't exist or on error.
 * Used by receipt.js to read receiptLogoUrl and receiptFooter at render time.
 */
export async function getShopConfig() {
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const snap = await getDoc(configRef);
    return snap.exists() ? snap.data() : {};
  } catch (err) {
    console.warn('[Vikretha] Could not read shop config:', err);
    return {};
  }
}

// Apply theme immediately (synchronous, no auth required).
// Palette is always COLOR_THEME from config; dark mode is user preference in localStorage.
(function _applyCachedTheme() {
  const dark    = localStorage.getItem('vk_dark') === 'true';
  // Use cached palette (set when Firestore theme last loaded) so page
  // doesn't flash back to the static COLOR_THEME default on reload.
  const palette = localStorage.getItem('vk_theme') || COLOR_THEME;
  applyTheme(palette, dark);
}());
