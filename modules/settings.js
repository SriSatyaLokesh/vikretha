/**
 * modules/settings.js — Settings Screen
 * Phase 8: Full staff email management (authorized_emails in /shops/{SHOP_ID}/config).
 */
import { auth, db } from '../lib/firebase-init.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID } from '../shop.config.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function _isValidEmail(email) {
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
}

export function render(container) {
  const user = auth.currentUser;
  const currentEmail = user?.email || '';

  container.innerHTML = `
    <div class="settings-wrap">

      <!-- Signed in as -->
      <div class="card settings-card">
        <p class="settings-section-label">Signed in as</p>
        <p class="settings-email-display">${escapeHtml(currentEmail || '—')}</p>
      </div>

      <!-- Staff Access -->
      <div class="card settings-card" id="settings-staff-card">
        <p class="settings-section-label">Staff Access</p>
        <p class="settings-section-hint">
          These email addresses can log in and access this shop's data.
        </p>
        <div id="staff-list" class="staff-email-list">
          <p class="settings-loading">Loading…</p>
        </div>
        <form id="add-email-form" class="settings-add-form" novalidate>
          <input id="add-email-input" type="email" class="settings-add-input"
                 placeholder="staff@example.com" autocomplete="off" />
          <button type="submit" class="settings-add-btn">Add</button>
        </form>
        <p id="add-email-error" class="settings-error" style="display:none;"></p>
      </div>

      <!-- Sign out -->
      <div class="card settings-card">
        <button id="sign-out-btn" class="btn btn-full settings-signout-btn">
          Sign Out
        </button>
      </div>

    </div>
  `;

  // ── Load staff list ──────────────────────────────────────────
  async function _loadStaff() {
    const staffList = container.querySelector('#staff-list');
    staffList.innerHTML = '<p class="settings-loading">Loading…</p>';
    try {
      const configRef = doc(db, 'shops', SHOP_ID, 'config');
      const snap = await getDoc(configRef);
      const emails = snap.exists() ? (snap.data().authorized_emails || []) : [];

      if (emails.length === 0) {
        staffList.innerHTML = '<p class="settings-empty">No staff added yet.</p>';
        return;
      }

      staffList.innerHTML = emails.map(email => `
        <div class="staff-email-item">
          <span class="staff-email-text">${escapeHtml(email)}</span>
          <button class="staff-remove-btn" data-email="${escapeHtml(email)}"
            ${email === currentEmail ? 'disabled title="Cannot remove your own account"' : ''}>
            Remove
          </button>
        </div>
      `).join('');
    } catch (err) {
      console.error('[Vikretha] Could not load staff list:', err);
      container.querySelector('#staff-list').innerHTML =
        '<p class="settings-error">Could not load staff list.</p>';
    }
  }

  _loadStaff();

  // ── Remove email (delegated) ─────────────────────────────────
  container.querySelector('#staff-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.staff-remove-btn');
    if (!btn || btn.disabled) return;

    const emailToRemove = btn.dataset.email;
    if (!confirm('Remove access for ' + emailToRemove + '?')) return;

    btn.disabled = true;
    btn.textContent = '...';
    try {
      await updateDoc(doc(db, 'shops', SHOP_ID, 'config'), {
        authorized_emails: arrayRemove(emailToRemove)
      });
      await _loadStaff();
    } catch (err) {
      console.error('[Vikretha] Could not remove email:', err);
      btn.disabled = false;
      btn.textContent = 'Remove';
      alert('Could not remove: ' + err.message);
    }
  });

  // ── Add email ────────────────────────────────────────────────
  container.querySelector('#add-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = container.querySelector('#add-email-input');
    const errorEl = container.querySelector('#add-email-error');
    const submitBtn = container.querySelector('.settings-add-btn');
    const email = input.value.trim().toLowerCase();

    errorEl.style.display = 'none';

    if (!_isValidEmail(email)) {
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';
    try {
      await updateDoc(doc(db, 'shops', SHOP_ID, 'config'), {
        authorized_emails: arrayUnion(email)
      });
      input.value = '';
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

  // ── Sign out ─────────────────────────────────────────────────
  container.querySelector('#sign-out-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#sign-out-btn');
    btn.disabled = true;
    btn.textContent = 'Signing out...';
    try {
      await signOut(auth);
      // onAuthStateChanged in app.js fires with null -> showLoginScreen()
    } catch (err) {
      console.error('[Vikretha] Sign out failed:', err);
      btn.disabled = false;
      btn.textContent = 'Sign Out';
    }
  });
}
