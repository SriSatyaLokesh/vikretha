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

// ----- Entry Point -----
export function render(container) {
  showSignInStep(container);
}

// ----- Step 1: Sign In -----
function showSignInStep(container, prefillEmail = '') {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;
                background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;">
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:4px;">${SHOP_NAME}</h1>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">
          Sign in to your shop
        </p>

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

        <div id="auth-error" style="display:none;color:var(--danger);font-size:0.8rem;
             margin-bottom:12px;padding:8px;background:#fef2f2;border-radius:6px;"></div>

        <button id="sign-in-btn" class="btn btn-primary btn-full">Sign In</button>

        <button id="forgot-btn" style="margin-top:12px;width:100%;color:var(--text-secondary);
                font-size:0.8rem;padding:8px;background:none;border:none;cursor:pointer;">
          Forgot password?
        </button>

        <hr style="margin:16px 0;border:none;border-top:1px solid var(--border);">

        <p style="text-align:center;font-size:0.875rem;color:var(--text-secondary);">
          New here?
          <button id="create-account-btn" style="color:var(--theme-color);background:none;
                  border:none;cursor:pointer;font-size:0.875rem;font-weight:500;">
            Create an account
          </button>
        </p>
      </div>
    </div>
  `;

  document.getElementById('sign-in-btn').addEventListener('click', () => handleSignIn(container));
  document.getElementById('forgot-btn').addEventListener('click', () => {
    const email = document.getElementById('email-input').value.trim();
    showForgotPasswordStep(container, email);
  });
  document.getElementById('create-account-btn').addEventListener('click', () => {
    showCreateAccountStep(container);
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
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;
                background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;">
        <button id="back-btn" style="display:flex;align-items:center;gap:6px;
                color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;
                padding:0;background:none;border:none;cursor:pointer;">
          ← Back to Sign In
        </button>

        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px;">Create Account</h2>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">
          Set up your shop access
        </p>

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

        <div id="create-error" style="display:none;color:var(--danger);font-size:0.8rem;
             margin-bottom:12px;padding:8px;background:#fef2f2;border-radius:6px;"></div>

        <button id="create-btn" class="btn btn-primary btn-full">Create Account</button>
      </div>
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => showSignInStep(container));
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
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;
                background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;">
        <button id="back-btn" style="display:flex;align-items:center;gap:6px;
                color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;
                padding:0;background:none;border:none;cursor:pointer;">
          ← Back to Sign In
        </button>

        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px;">Reset Password</h2>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">
          Enter your email — we'll send a reset link
        </p>

        <div class="form-group">
          <label class="form-label" for="reset-email-input">Email</label>
          <input id="reset-email-input" type="email" class="form-input"
            placeholder="you@example.com" autocomplete="email"
            value="${escapeHtml(prefillEmail)}">
        </div>

        <div id="reset-message" style="display:none;font-size:0.8rem;margin-bottom:12px;
             padding:8px;border-radius:6px;"></div>

        <button id="reset-btn" class="btn btn-primary btn-full">Send Reset Email</button>
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
