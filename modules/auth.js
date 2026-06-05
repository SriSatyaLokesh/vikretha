/**
 * modules/auth.js — Email/Password Authentication
 * Three-step flow: sign-in ↔ create-account ↔ forgot-password
 * Exported: render(container) — called by app.js when user is unauthenticated.
 */
import { auth, db } from '../lib/firebase-init.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_NAME, SHOP_ID, WHATSAPP_NUMBER } from '../shop.config.js';

const SHOP_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;

// ----- Entry Point -----
export async function render(container) {
  // Load login branding config from Firestore (non-blocking — fallback to defaults)
  let loginCfg = {};
  try {
    const snap = await getDoc(doc(db, 'shops', SHOP_ID, 'config', 'main'));
    if (snap.exists()) loginCfg = snap.data();
  } catch (_) {}
  showSignInStep(container, '', loginCfg);
}

// ----- Brand panel (shared by sign-in + create-account steps) -----
function _buildBrandPanel(cfg = {}) {
  const tagline  = cfg.loginTagline    || 'Run your shop<br><span>for free.</span>';
  const desc     = cfg.loginDesc       || 'Everything your shop needs — billing, inventory, receipts, and reports — in one simple app.';
  const rawFeatures = cfg.loginFeatures
    ? cfg.loginFeatures.split('\n').map(f => f.trim()).filter(Boolean)
    : [
        'Instant billing &amp; WhatsApp receipts',
        'Inventory with low-stock alerts',
        'Daily &amp; monthly sales reports',
        'Multi-staff access management',
      ];
  const featuresHTML = rawFeatures
    .map(f => `<div class="auth-brand-feature"><div class="auth-brand-feature-dot"></div>${escHtml(f)}</div>`)
    .join('');
  const logoHtml = cfg.receiptLogoUrl
    ? `<img src="${escHtml(cfg.receiptLogoUrl)}" class="auth-brand-logo" alt="${escHtml(cfg.shopName || 'Logo')}">`
    : '';
  return `
    <div class="auth-brand-panel">
      ${logoHtml}
      <div class="auth-brand-tagline">${tagline}</div>
      <p class="auth-brand-desc">${escHtml(desc)}</p>
      <div class="auth-brand-features">${featuresHTML}</div>
      <p class="auth-brand-powered">Powered by <a class="auth-brand-powered-link" href="https://github.com/SriSatyaLokesh/vikretha" target="_blank" rel="noopener">Vikretha</a></p>
    </div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ----- Step 1: Sign In -----
function showSignInStep(container, prefillEmail = '', loginCfg = {}) {
  container.innerHTML = `
    <div class="auth-screen">
      ${_buildBrandPanel(loginCfg)}
      <div class="auth-form-panel">
        <div class="auth-card">
          <div class="auth-logo">${SHOP_ICON_SVG}</div>
          <h1 class="auth-title">Welcome back</h1>
          <p class="auth-subtitle">Sign in to ${SHOP_NAME}</p>

          <div class="form-group">
            <label class="form-label" for="email-input">Email</label>
            <input id="email-input" type="email" class="form-input"
              placeholder="you@example.com" autocomplete="email"
              value="${escapeHtml(prefillEmail)}">
          </div>
          <div class="form-group">
            <label class="form-label" for="password-input">Password</label>
            <input id="password-input" type="password" class="form-input"
              placeholder="••••••••" autocomplete="current-password">
          </div>

          <div id="auth-error" class="alert alert-error" style="display:none;margin-bottom:12px;"></div>

          <button id="sign-in-btn" class="btn btn-primary btn-full">Sign In</button>

          <button id="forgot-btn" class="auth-forgot-btn">Forgot password?</button>

          <p class="auth-link-row">
            New here?
            <button id="create-account-btn" class="auth-link">Create an account</button>
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('sign-in-btn').addEventListener('click', () => handleSignIn(container));
  document.getElementById('forgot-btn').addEventListener('click', () => {
    const email = document.getElementById('email-input').value.trim();
    showForgotPasswordStep(container, email);
  });
  document.getElementById('create-account-btn').addEventListener('click', () => {
    showCreateAccountStep(container, loginCfg);
  });

  // Submit on Enter in password field
  document.getElementById('password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sign-in-btn').click();
  });
}

async function handleSignIn(container) {
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  const errorEl = document.getElementById('auth-error');
  const btn = document.getElementById('sign-in-btn');

  if (!email || !password) {
    showError(errorEl, 'Enter your email and password');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>';
  errorEl.style.display = 'none';

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged in app.js fires → mountAppShell() → handleRoute()
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Sign In';
    showError(errorEl, friendlyAuthError(err.code));
  }
}

// ----- Step 2: Create Account -----
function showCreateAccountStep(container) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-brand-panel">
        <div class="auth-brand-tagline">Run your shop<br><span>for free.</span></div>
        <p class="auth-brand-desc">Create your account and get started in less than a minute.</p>
        <div class="auth-brand-features">
          <div class="auth-brand-feature"><div class="auth-brand-feature-dot"></div>Free forever — no credit card needed</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-dot"></div>All data stored securely in the cloud</div>

      <div class="auth-form-panel">
        <div class="auth-card">
          <div class="auth-logo">${SHOP_ICON_SVG}</div>
          <h1 class="auth-title">Create account</h1>
          <p class="auth-subtitle">Set up your shop access</p>

          <div class="form-group">
            <label class="form-label" for="new-email-input">Email</label>
            <input id="new-email-input" type="email" class="form-input"
              placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="new-password-input">Password</label>
            <input id="new-password-input" type="password" class="form-input"
              placeholder="At least 6 characters" autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label" for="confirm-password-input">Confirm Password</label>
            <input id="confirm-password-input" type="password" class="form-input"
              placeholder="Repeat password" autocomplete="new-password">
          </div>

          <div id="create-error" class="alert alert-error" style="display:none;margin-bottom:12px;"></div>

          <button id="create-btn" class="btn btn-primary btn-full">Create Account</button>

          <p class="auth-link-row">
            Already have an account?
            <button id="back-btn" class="auth-link">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => showSignInStep(container, '', loginCfg));
  document.getElementById('create-btn').addEventListener('click', () => handleCreateAccount(container));
  document.getElementById('confirm-password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('create-btn').click();
  });
}

async function handleCreateAccount(container) {
  const email = document.getElementById('new-email-input').value.trim();
  const password = document.getElementById('new-password-input').value;
  const confirm = document.getElementById('confirm-password-input').value;
  const errorEl = document.getElementById('create-error');
  const btn = document.getElementById('create-btn');

  if (!email || !password) {
    showError(errorEl, 'Enter your email and password');
    return;
  }
  if (password !== confirm) {
    showError(errorEl, 'Passwords do not match');
    return;
  }
  if (password.length < 6) {
    showError(errorEl, 'Password must be at least 6 characters');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>';
  errorEl.style.display = 'none';

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await bootstrapShopConfig(credential.user);
    // onAuthStateChanged fires → app shell mounts
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    showError(errorEl, friendlyAuthError(err.code));
  }
}

// ----- Step 3: Forgot Password -----
function showForgotPasswordStep(container, prefillEmail = '') {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-brand-panel">
        <div class="auth-brand-tagline">Run your shop<br><span>for free.</span></div>
        <p class="auth-brand-desc">Don't worry — password reset is just one email away.</p>
      </div>
      <div class="auth-form-panel">
        <div class="auth-card">
          <div class="auth-logo">${SHOP_ICON_SVG}</div>
          <h1 class="auth-title">Reset password</h1>
          <p class="auth-subtitle">We'll send a reset link to your email</p>

          <div class="form-group">
            <label class="form-label" for="reset-email-input">Email</label>
            <input id="reset-email-input" type="email" class="form-input"
              placeholder="you@example.com" autocomplete="email"
              value="${escapeHtml(prefillEmail)}">
          </div>

          <div id="reset-message" style="display:none;margin-bottom:12px;"></div>

          <button id="reset-btn" class="btn btn-primary btn-full">Send Reset Email</button>

          <p class="auth-link-row">
            <button id="back-btn" class="auth-link">← Back to Sign In</button>
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    const email = document.getElementById('reset-email-input').value.trim();
    showSignInStep(container, email);
  });
  document.getElementById('reset-btn').addEventListener('click', handleForgotPassword);
  document.getElementById('reset-email-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('reset-btn').click();
  });
}

async function handleForgotPassword() {
  const email = document.getElementById('reset-email-input').value.trim();
  const msgEl = document.getElementById('reset-message');
  const btn = document.getElementById('reset-btn');

  if (!email) {
    msgEl.textContent = 'Enter your email address';
    msgEl.style.cssText = 'display:block;color:var(--danger);background:#fef2f2;';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>';
  msgEl.style.display = 'none';

  try {
    await sendPasswordResetEmail(auth, email);
    btn.disabled = false;
    btn.textContent = 'Resend Email';
    msgEl.textContent = `Reset link sent to ${email}. Check your inbox (and spam folder).`;
    msgEl.style.cssText = 'display:block;color:#15803d;background:#f0fdf4;';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Send Reset Email';
    msgEl.textContent = friendlyAuthError(err.code);
    msgEl.style.cssText = 'display:block;color:var(--danger);background:#fef2f2;';
  }
}

// ----- Bootstrap shop config on first sign-up -----
async function bootstrapShopConfig(user) {
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        shop_name: SHOP_NAME,
        authorized_emails: [user.email],
        whatsapp_number: WHATSAPP_NUMBER || '',
        staff_roles: { [user.email]: 'owner' },
        created_at: serverTimestamp()
      });
    }
  } catch (err) {
    // Non-fatal: if config already exists or rules block write, proceed normally
    console.warn('[Vikretha] bootstrapShopConfig error:', err.code);
  }
  window.location.hash = '#/dashboard';
}

// ----- Helpers -----
function showError(el, message) {
  el.textContent = message;
  el.style.display = 'block';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function friendlyAuthError(code) {
  const messages = {
    'auth/user-not-found':        'No account found for this email. Create one below.',
    'auth/wrong-password':        'Wrong password. Try again or use Forgot Password.',
    'auth/invalid-credential':    'Wrong email or password. Try again.',
    'auth/email-already-in-use':  'This email is already registered. Sign in instead.',
    'auth/weak-password':         'Password too weak. Use at least 6 characters.',
    'auth/invalid-email':         'Invalid email address.',
    'auth/too-many-requests':     'Too many failed attempts. Try again later.',
    'auth/network-request-failed':'No internet connection. Check your network.',
    'auth/user-disabled':         'This account has been disabled. Contact the shop owner.',
  };
  return messages[code] || `Sign-in error (${code}). Please try again.`;
}
