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

import { FIREBASE_CONFIG, SHOP_ID } from '../shop.config.js';

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
 * Load theme + dark mode from Firestore config/main and apply.
 * Call after authentication succeeds. Falls back silently on error.
 * Also caches in localStorage for instant apply on next load.
 */
export async function loadThemeFromFirestore() {
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data();
      const themeId = data.theme || 'orange';
      const dark    = data.darkMode === true;
      applyTheme(themeId, dark);
      localStorage.setItem('vk_theme', themeId);
      localStorage.setItem('vk_dark', String(dark));
    }
  } catch (err) {
    // Non-fatal — cached theme already applied on load
    console.warn('[Vikretha] Could not sync theme from Firestore:', err);
  }
}

// Apply cached theme immediately (synchronous, no auth required)
// This ensures the correct palette renders before Firebase Auth resolves.
(function _applyCachedTheme() {
  const themeId = localStorage.getItem('vk_theme') || 'orange';
  const dark    = localStorage.getItem('vk_dark') === 'true';
  applyTheme(themeId, dark);
}());
