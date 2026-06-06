/**
 * modules/settings.js — Combined Settings Screen (Phase 24 revised)
 *
 * Role-aware rendering:
 *   owner  → Shop Identity + Receipt Branding + Theme + Staff Access
 *   admin  → Staff Access only
 *   member → redirect to dashboard (nothing to configure)
 */
import { auth, db, applyTheme } from '../lib/firebase-init.js';
import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove,
  FieldPath, deleteField
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, SHOP_NAME, LOGO_URL, RECEIPT_FOOTER, COLOR_THEME, THEME_PALETTES } from '../shop.config.js';
import { toast } from '../lib/toast.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _isValidEmail(email) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function render(container) {
  const user = auth.currentUser;
  if (!user?.email) return;

  const currentEmail = user.email;
  container.innerHTML = `<div style="padding:32px;text-align:center;"><div class="spinner" style="margin:0 auto;"></div></div>`;

  let cfg = {};
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const snap = await getDoc(configRef);
    cfg = snap.exists() ? snap.data() : {};
  } catch (err) {
    container.innerHTML = `<div class="admin-denied"><p>Could not load settings: ${escapeHtml(err.message)}</p></div>`;
    return;
  }

  const role = cfg.staff_roles?.[currentEmail];

  if (role === 'owner') {
    _renderOwnerSettings(container, cfg, currentEmail);
  } else if (role === 'admin') {
    _renderAdminSettings(container, currentEmail);
  } else {
    // Members have no settings — redirect to dashboard
    window.location.hash = '#/dashboard';
  }
}

// ── Owner: full config + staff ────────────────────────────────────────────────
function _renderOwnerSettings(container, cfg, currentEmail) {
  const currentShopName    = cfg.shopName        || SHOP_NAME;
  const currentLogoUrl     = cfg.receiptLogoUrl  || LOGO_URL        || '';
  const currentFooter      = cfg.receiptFooter   || RECEIPT_FOOTER  || '';
  const currentTagline     = cfg.loginTagline    || '';
  const currentLoginDesc   = cfg.loginDesc       || '';
  const currentLoginFeats  = cfg.loginFeatures   || '';

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
                 placeholder="My Kirana Store" maxlength="60" autocomplete="off" />
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
                 placeholder="https://example.com/logo.png" autocomplete="off" />
          <p class="admin-field-hint">Leave empty to use shop name as wordmark on receipts.</p>
        </div>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-receipt-footer">Receipt Footer</label>
          <textarea id="admin-receipt-footer" class="admin-textarea" rows="2"
                    placeholder="Thank you for shopping with us!" maxlength="120">${escapeHtml(currentFooter)}</textarea>
          <p class="admin-field-hint">Leave empty for the default "THANK YOU FOR SHOPPING!"</p>
        </div>
        <button id="save-receipt-branding" class="btn btn-primary admin-save-btn">Save</button>
      </div>

      <!-- Login Screen -->
      <div class="card settings-card">
        <p class="settings-section-label">Login Screen</p>
        <p class="settings-section-hint">Customise what users see on the sign-in page. Leave fields empty to use the defaults.</p>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-login-tagline">Tagline</label>
          <input id="admin-login-tagline" type="text" class="admin-input"
                 value="${escapeHtml(currentTagline)}"
                 placeholder="Run your shop for free." maxlength="80" autocomplete="off" />
          <p class="admin-field-hint">Bold headline shown on the left panel.</p>
        </div>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-login-desc">Description</label>
          <textarea id="admin-login-desc" class="admin-textarea" rows="2"
                    placeholder="Everything your shop needs…" maxlength="200">${escapeHtml(currentLoginDesc)}</textarea>
          <p class="admin-field-hint">Short description below the tagline.</p>
        </div>
        <div class="admin-field-group">
          <label class="admin-field-label" for="admin-login-features">Feature Bullets</label>
          <textarea id="admin-login-features" class="admin-textarea" rows="4"
                    placeholder="Instant billing&#10;Inventory tracking&#10;Sales reports" maxlength="400">${escapeHtml(currentLoginFeats)}</textarea>
          <p class="admin-field-hint">One bullet point per line. Leave empty for defaults.</p>
        </div>
        <button id="save-login-branding" class="btn btn-primary admin-save-btn">Save</button>
      </div>

      <!-- Theme -->
      <div class="card settings-card">
        <p class="settings-section-label">Theme</p>
        <p class="settings-section-hint">Changes app-wide colour palette for all users.</p>
        <div class="theme-swatch-grid" id="settings-theme-grid" role="radiogroup" aria-label="Color theme">
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

      <!-- Staff Access -->
      ${_staffSectionHTML()}

    </div>
  `;

  _bindOwnerHandlers(container, currentEmail);
  _bindStaffHandlers(container, currentEmail);
}

// ── Admin: staff management only ─────────────────────────────────────────────
function _renderAdminSettings(container, currentEmail) {
  container.innerHTML = `
    <div class="admin-settings-wrap">
      ${_staffSectionHTML()}
    </div>
  `;
  _bindStaffHandlers(container, currentEmail);
}

// ── Shared staff section HTML ─────────────────────────────────────────────────
function _staffSectionHTML() {
  return `
    <div class="card settings-card" id="settings-staff-card">
      <p class="settings-section-label">Staff Access</p>
      <p class="settings-section-hint">Email addresses that can log in and access this shop's data.</p>
      <div id="staff-list" class="staff-email-list">
        <p class="settings-loading">Loading…</p>
      </div>
      <form id="add-email-form" class="settings-add-form" novalidate>
        <input id="add-email-input" type="email" class="settings-add-input"
               aria-label="Staff email address"
               placeholder="staff@example.com" autocomplete="off" />
        <select id="add-role-select" class="settings-role-select" aria-label="Staff role">
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" class="settings-add-btn">Add</button>
      </form>
      <p id="add-email-error" class="settings-error" style="display:none;"></p>
    </div>`;
}

// ── Owner-only: config section handlers ───────────────────────────────────────
function _bindOwnerHandlers(container, currentEmail) {
  // Theme picker active state
  function _renderThemePicker() {
    const active = document.documentElement.dataset.theme || 'orange';
    container.querySelectorAll('.theme-swatch').forEach(btn => {
      const isActive = btn.dataset.themeId === active;
      btn.classList.toggle('theme-swatch--active', isActive);
      btn.setAttribute('aria-checked', String(isActive));
    });
  }
  _renderThemePicker();

  container.querySelector('#settings-theme-grid').addEventListener('click', async (e) => {
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

  // Shop Identity save
  container.querySelector('#save-shop-identity').addEventListener('click', async (e) => {
    const btn     = e.currentTarget;
    const nameVal = container.querySelector('#admin-shop-name').value.trim();
    if (!nameVal) { toast.error('Shop name cannot be empty'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { shopName: nameVal }, { merge: true });
      const brandEl = document.querySelector('.sidebar-brand-wordmark, .sidebar-brand-name');
      if (brandEl) brandEl.textContent = nameVal;
      // Also update header wordmark
      const headerWordmark = document.querySelector('.header-brand-wordmark');
      if (headerWordmark) headerWordmark.textContent = nameVal;
      toast.success('Shop name saved');
    } catch (err) {
      toast.error('Could not save: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });

  // Receipt Branding save
  container.querySelector('#save-receipt-branding').addEventListener('click', async (e) => {
    const btn     = e.currentTarget;
    const logoUrl = container.querySelector('#admin-logo-url').value.trim();
    const footer  = container.querySelector('#admin-receipt-footer').value.trim();
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { receiptLogoUrl: logoUrl, receiptFooter: footer }, { merge: true });
      // Resolve current shop name for live-update
      const shopNameEl = document.querySelector('.sidebar-brand-wordmark, .sidebar-brand-name, .header-brand-wordmark');
      const liveShopName = shopNameEl ? shopNameEl.textContent.trim() : '';

      // Live-update desktop sidebar brand
      const brandEl = document.querySelector('.sidebar-brand');
      if (brandEl) {
        if (logoUrl) {
          brandEl.innerHTML = `<img src="${logoUrl}" class="sidebar-brand-logo" alt="${liveShopName || 'Shop logo'}">`;
        } else {
          brandEl.innerHTML = `<span class="sidebar-brand-wordmark">${liveShopName || document.title}</span>`;
        }
      }

      // Live-update mobile header brand
      const pageTitleEl = document.getElementById('page-title');
      if (pageTitleEl) {
        if (logoUrl) {
          pageTitleEl.innerHTML = `<img src="${logoUrl}" class="header-brand-logo" alt="${liveShopName || 'Shop logo'}">`;
        } else {
          pageTitleEl.innerHTML = `<span class="header-brand-wordmark">${liveShopName || document.title}</span>`;
        }
      }
      toast.success('Receipt branding saved');
    } catch (err) {
      toast.error('Could not save: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });

  // Login Screen branding save
  container.querySelector('#save-login-branding').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const tagline  = container.querySelector('#admin-login-tagline').value.trim();
    const desc     = container.querySelector('#admin-login-desc').value.trim();
    const features = container.querySelector('#admin-login-features').value.trim();
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { loginTagline: tagline, loginDesc: desc, loginFeatures: features }, { merge: true });
      toast.success('Login screen saved');
    } catch (err) {
      toast.error('Could not save: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Save';
    }
  });
}

// ── Shared: staff section handlers ───────────────────────────────────────────
function _bindStaffHandlers(container, currentEmail) {
  async function _loadStaff() {
    const staffList = container.querySelector('#staff-list');
    staffList.innerHTML = '<p class="settings-loading">Loading…</p>';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      const snap = await getDoc(configRef);
      const emails = snap.exists() ? (snap.data().authorized_emails || []) : [];
      const roles  = snap.exists() ? (snap.data().staff_roles || {}) : {};

      if (emails.length === 0) {
        staffList.innerHTML = '<p class="settings-empty">No staff added yet.</p>';
        return;
      }

      staffList.innerHTML = emails.map(email => {
        const role   = roles[email] || 'member';
        const isSelf = email === currentEmail;
        return `
          <div class="staff-email-item">
            <div class="staff-email-info">
              <span class="staff-email-text">${escapeHtml(email)}</span>
              <span class="staff-role-badge role-${role}">${role}</span>
            </div>
            <button class="staff-remove-btn"
              data-email="${escapeHtml(email)}"
              data-role="${role}"
              ${isSelf ? 'disabled title="Cannot remove your own account"' : ''}>
              Remove
            </button>
          </div>`;
      }).join('');
    } catch (err) {
      console.error('[Vikretha] Could not load staff list:', err);
      container.querySelector('#staff-list').innerHTML =
        '<p class="settings-error">Could not load staff list.</p>';
    }
  }

  _loadStaff();

  // Remove email
  container.querySelector('#staff-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.staff-remove-btn');
    if (!btn || btn.disabled) return;
    const emailToRemove = btn.dataset.email;
    toast.confirm('Remove access for ' + emailToRemove + '?', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
        await updateDoc(configRef,
          'authorized_emails', arrayRemove(emailToRemove),
          new FieldPath('staff_roles', emailToRemove), deleteField()
        );
        await _loadStaff();
      } catch (err) {
        console.error('[Vikretha] Could not remove email:', err);
        btn.disabled = false;
        btn.textContent = 'Remove';
        toast.error('Could not remove: ' + err.message);
      }
    });
  });

  // Add email
  container.querySelector('#add-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input      = container.querySelector('#add-email-input');
    const roleSelect = container.querySelector('#add-role-select');
    const errorEl    = container.querySelector('#add-email-error');
    const submitBtn  = container.querySelector('.settings-add-btn');
    const email      = input.value.trim().toLowerCase();
    const role       = roleSelect.value;

    errorEl.style.display = 'none';

    if (!_isValidEmail(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
      await setDoc(configRef, { authorized_emails: arrayUnion(email) }, { merge: true });
      await updateDoc(configRef, new FieldPath('staff_roles', email), role);
      input.value = '';
      roleSelect.value = 'member';
      await _loadStaff();
    } catch (err) {
      console.error('[Vikretha] Could not add email:', err);
      errorEl.textContent = 'Could not add: ' + err.message;
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Add';
    }
  });
}
