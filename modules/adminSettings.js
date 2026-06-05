/**
 * modules/adminSettings.js — Owner-only Admin Configuration Panel
 * Route: #/adminSettings
 * Access: staff_roles[email] === 'owner' only
 */
import { auth, db, applyTheme } from '../lib/firebase-init.js';
import {
  doc, getDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, SHOP_NAME, LOGO_URL, RECEIPT_FOOTER, COLOR_THEME, THEME_PALETTES } from '../shop.config.js';
import { toast } from '../lib/toast.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export async function render(container) {
  const user = auth.currentUser;
  if (!user?.email) {
    container.innerHTML = `<div class="admin-denied"><p>Not signed in.</p></div>`;
    return;
  }

  const currentEmail = user.email;
  container.innerHTML = `<div style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>`;

  // ── Load config + check role ──────────────────────────────────────────────
  let cfg = {};
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const snap = await getDoc(configRef);
    cfg = snap.exists() ? snap.data() : {};
  } catch (err) {
    container.innerHTML = `<div class="admin-denied"><p>Could not load configuration: ${escapeHtml(err.message)}</p></div>`;
    return;
  }

  const role = cfg.staff_roles?.[currentEmail];
  if (role !== 'owner') {
    container.innerHTML = `
      <div class="admin-denied">
        <div class="admin-denied-icon">🔒</div>
        <h2>Owner access required</h2>
        <p>Admin Settings can only be accessed by the shop owner. Your current role is <strong>${escapeHtml(role || 'unknown')}</strong>.</p>
      </div>`;
    return;
  }

  // ── Render admin panel ────────────────────────────────────────────────────
  const currentShopName = cfg.shopName        || SHOP_NAME;
  const currentLogoUrl  = cfg.receiptLogoUrl  || LOGO_URL  || '';
  const currentFooter   = cfg.receiptFooter   || RECEIPT_FOOTER || '';
  const currentTheme    = cfg.theme           || COLOR_THEME;

  container.innerHTML = `
    <div class="admin-settings-wrap">

      <!-- Shop Identity -->
      <div class="card settings-card">
        <p class="settings-section-label">Shop Identity</p>
        <p class="settings-section-hint">Displayed in the sidebar, header, and on receipts.</p>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-shop-name">Shop Name</label>
          <input id="admin-shop-name" type="text" class="admin-input"
                 value="${escapeHtml(currentShopName)}"
                 placeholder="My Kirana Store"
                 maxlength="60" autocomplete="off" />
        </div>
        <button id="save-shop-identity" class="btn btn-primary admin-save-btn">Save</button>
      </div>

      <!-- Receipt Branding -->
      <div class="card settings-card">
        <p class="settings-section-label">Receipt Branding</p>
        <p class="settings-section-hint">Logo and footer text printed on every receipt.</p>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-logo-url">Logo URL</label>
          <input id="admin-logo-url" type="url" class="admin-input"
                 value="${escapeHtml(currentLogoUrl)}"
                 placeholder="https://example.com/logo.png"
                 autocomplete="off" />
          <p class="admin-field-hint">Leave empty to use shop name as wordmark on receipts.</p>
        </div>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-receipt-footer">Receipt Footer</label>
          <textarea id="admin-receipt-footer" class="admin-textarea" rows="2"
                    placeholder="Thank you for shopping with us!"
                    maxlength="120">${escapeHtml(currentFooter)}</textarea>
          <p class="admin-field-hint">Leave empty for the default "THANK YOU FOR SHOPPING!"</p>
        </div>
        <button id="save-receipt-branding" class="btn btn-primary admin-save-btn">Save</button>
      </div>

      <!-- Theme -->
      <div class="card settings-card">
        <p class="settings-section-label">Theme</p>
        <p class="settings-section-hint">Changes app-wide colour palette for all users.</p>
        <div class="theme-swatch-grid" id="admin-theme-swatch-grid" role="radiogroup" aria-label="Color theme">
          ${THEME_PALETTES.map(p => `
            <button class="theme-swatch" data-theme-id="${p.id}" role="radio"
                    aria-label="${p.label}" title="${p.label}"
                    style="--swatch-light:${p.lightBg};--swatch-dark:${p.darkBg};--swatch-accent:${p.primary}">
              <span class="theme-swatch-chip">
                <span class="theme-swatch-half theme-swatch-light"></span>
                <span class="theme-swatch-half theme-swatch-dark"></span>
                <span class="theme-swatch-accent-dot"></span>
              </span>
              <span class="theme-swatch-label">${p.label}</span>
            </button>
          `).join('')}
        </div>
      </div>

    </div>
  `;

  // ── Mark active theme swatch ──────────────────────────────────────────────
  function _renderThemePicker() {
    const active = document.documentElement.dataset.theme || currentTheme;
    container.querySelectorAll('.theme-swatch').forEach(btn => {
      const isActive = btn.dataset.themeId === active;
      btn.classList.toggle('theme-swatch--active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  }
  _renderThemePicker();

  // ── Save: Shop Identity ───────────────────────────────────────────────────
  container.querySelector('#save-shop-identity').addEventListener('click', async (e) => {
    const btn     = e.currentTarget;
    const nameVal = container.querySelector('#admin-shop-name').value.trim();
    if (!nameVal) { toast.error('Shop name cannot be empty'); return; }

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { shopName: nameVal }, { merge: true });
      // Live DOM update — sidebar brand + page title
      const brandEl = document.querySelector('.sidebar-brand-wordmark, .sidebar-brand-name');
      if (brandEl) brandEl.textContent = nameVal;
      const titleEl = document.getElementById('page-title');
      if (titleEl && titleEl.textContent !== 'Admin Settings') titleEl.textContent = nameVal;
      toast.success('Shop name saved');
    } catch (err) {
      toast.error('Could not save: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });

  // ── Save: Receipt Branding ────────────────────────────────────────────────
  container.querySelector('#save-receipt-branding').addEventListener('click', async (e) => {
    const btn      = e.currentTarget;
    const logoUrl  = container.querySelector('#admin-logo-url').value.trim();
    const footer   = container.querySelector('#admin-receipt-footer').value.trim();

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { receiptLogoUrl: logoUrl, receiptFooter: footer }, { merge: true });
      toast.success('Receipt branding saved');
    } catch (err) {
      toast.error('Could not save: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });

  // ── Theme swatch click ────────────────────────────────────────────────────
  container.querySelector('#admin-theme-swatch-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('.theme-swatch');
    if (!btn) return;
    const themeId = btn.dataset.themeId;
    const isDark  = document.documentElement.dataset.dark === 'true';
    applyTheme(themeId, isDark);
    _renderThemePicker();
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { theme: themeId }, { merge: true });
    } catch (err) {
      console.error('[Vikretha] Could not save theme:', err);
    }
  });
}
