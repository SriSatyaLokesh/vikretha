/**
 * modules/settings.js — Settings Screen
 * Phase 2: Sign-out only.
 * Phase 8 will add: staff management (authorized_phones), shop profile editing.
 */
import { auth } from '../lib/firebase-init.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { SHOP_NAME, SHOP_ID } from '../shop.config.js';

export function render(container) {
  const user = auth.currentUser;
  const phone = user?.phoneNumber || '—';

  container.innerHTML = `
    <div style="padding-bottom:16px;">
      <div class="card" style="margin-bottom:16px;">
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">SIGNED IN AS</p>
        <p style="font-weight:600;">${phone}</p>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px;">Shop ID: ${SHOP_ID}</p>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;
                  text-transform:uppercase;letter-spacing:0.05em;">Account</p>
        <button id="sign-out-btn" class="btn btn-full"
                style="justify-content:flex-start;color:var(--danger);border:1px solid var(--border);">
          Sign Out
        </button>
      </div>

      <div class="card">
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;
                  text-transform:uppercase;letter-spacing:0.05em;">Coming Soon</p>
        <p style="font-size:0.875rem;color:var(--text-secondary);">
          Staff management, shop profile editing, and more in a future update.
        </p>
      </div>
    </div>
  `;

  document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
}

async function handleSignOut() {
  const btn = document.getElementById('sign-out-btn');
  btn.disabled = true;
  btn.textContent = 'Signing out…';
  try {
    await signOut(auth);
    // onAuthStateChanged in app.js fires with null → showLoginScreen()
    // No manual navigation needed
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Sign Out';
    console.error('[Vikretha] Sign out failed:', err);
  }
}
