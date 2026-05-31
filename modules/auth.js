/**
 * modules/auth.js — Phone OTP Authentication
 * Implements Firebase Phone Auth with invisible reCAPTCHA.
 * Exported: render(container) — called by app.js when user is unauthenticated.
 */
import { auth, db } from '../lib/firebase-init.js';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_NAME, SHOP_ID, THEME_COLOR, WHATSAPP_NUMBER } from '../shop.config.js';

let confirmationResult = null;
let recaptchaVerifier = null;

// ----- Entry Point -----
export function render(container) {
  showPhoneStep(container);
}

// ----- Step 1: Phone Number -----
function showPhoneStep(container) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;
                background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;">
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:4px;">${SHOP_NAME}</h1>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">
          Sign in to your shop
        </p>

        <div class="form-group">
          <label class="form-label" for="phone-input">Mobile Number</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="padding:10px 12px;background:var(--bg-primary);border:1px solid var(--border);
                         border-radius:8px;font-size:0.9rem;color:var(--text-secondary);">+91</span>
            <input
              id="phone-input"
              type="tel"
              class="form-input"
              style="flex:1;"
              placeholder="98765 43210"
              maxlength="10"
              inputmode="numeric"
              autocomplete="tel-national"
            >
          </div>
        </div>

        <div id="auth-error" style="display:none;color:var(--danger);font-size:0.8rem;
             margin-bottom:12px;padding:8px;background:#fef2f2;border-radius:6px;"></div>

        <button id="send-otp-btn" class="btn btn-primary btn-full">
          Send OTP
        </button>

        <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:16px;">
          You'll receive a 6-digit OTP via SMS
        </p>
      </div>
    </div>
  `;

  initRecaptcha();

  const sendBtn = document.getElementById('send-otp-btn');
  const phoneInput = document.getElementById('phone-input');

  // Allow digits only
  phoneInput.addEventListener('input', () => {
    phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
  });

  // Send on Enter key
  phoneInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });

  sendBtn.addEventListener('click', () => handleSendOTP(container));
}

// Initialize invisible reCAPTCHA — must be called after send-otp-btn is in DOM
function initRecaptcha() {
  try {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new RecaptchaVerifier(auth, 'send-otp-btn', {
      size: 'invisible',
      callback: () => { /* reCAPTCHA passed — OTP will be sent */ }
    });
  } catch (err) {
    console.warn('[Vikretha] RecaptchaVerifier init failed:', err);
  }
}

async function handleSendOTP(container) {
  const raw = document.getElementById('phone-input').value.trim();
  const errorEl = document.getElementById('auth-error');
  const sendBtn = document.getElementById('send-otp-btn');

  // Validate 10-digit Indian mobile
  if (!/^\d{10}$/.test(raw)) {
    showError(errorEl, 'Enter a valid 10-digit mobile number');
    return;
  }

  const phoneNumber = `+91${raw}`;

  sendBtn.disabled = true;
  sendBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>';
  errorEl.style.display = 'none';

  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    showOTPStep(container, phoneNumber);
  } catch (err) {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send OTP';
    // Reset reCAPTCHA on failure (required by Firebase)
    initRecaptcha();
    showError(errorEl, friendlyAuthError(err.code));
  }
}

// ----- Step 2: OTP Confirmation -----
function showOTPStep(container, phoneNumber) {
  const maskedPhone = phoneNumber.replace(/(\+91)(\d{2})\d{6}(\d{2})/, '$1 $2xxxxxx$3');

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh;
                background:var(--bg-primary);padding:24px;">
      <div class="card" style="width:100%;max-width:380px;">
        <button id="back-btn" style="display:flex;align-items:center;gap:6px;
                color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;padding:0;">
          ← Back
        </button>

        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:4px;">Enter OTP</h2>
        <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:24px;">
          Sent to ${maskedPhone}
        </p>

        <div class="form-group">
          <label class="form-label" for="otp-input">6-digit OTP</label>
          <input
            id="otp-input"
            type="tel"
            class="form-input"
            placeholder="• • • • • •"
            maxlength="6"
            inputmode="numeric"
            autocomplete="one-time-code"
            style="letter-spacing:0.25em;font-size:1.25rem;text-align:center;"
          >
        </div>

        <div id="otp-error" style="display:none;color:var(--danger);font-size:0.8rem;
             margin-bottom:12px;padding:8px;background:#fef2f2;border-radius:6px;"></div>

        <button id="verify-otp-btn" class="btn btn-primary btn-full">
          Verify &amp; Sign In
        </button>

        <button id="resend-btn" style="margin-top:12px;width:100%;color:var(--text-secondary);
                font-size:0.8rem;padding:8px;background:none;border:none;cursor:pointer;">
          Didn't receive OTP? Resend
        </button>
      </div>
    </div>
  `;

  const otpInput = document.getElementById('otp-input');
  const verifyBtn = document.getElementById('verify-otp-btn');

  otpInput.addEventListener('input', () => {
    otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 6);
    // Auto-submit when 6 digits entered
    if (otpInput.value.length === 6) verifyBtn.click();
  });

  otpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifyBtn.click();
  });

  // Auto-focus OTP input
  setTimeout(() => otpInput.focus(), 100);

  verifyBtn.addEventListener('click', handleVerifyOTP);
  document.getElementById('back-btn').addEventListener('click', () => showPhoneStep(container));
  document.getElementById('resend-btn').addEventListener('click', () => showPhoneStep(container));
}

async function handleVerifyOTP() {
  const code = document.getElementById('otp-input').value.trim();
  const errorEl = document.getElementById('otp-error');
  const verifyBtn = document.getElementById('verify-otp-btn');

  if (code.length !== 6) {
    showError(errorEl, 'Enter the 6-digit OTP');
    return;
  }

  verifyBtn.disabled = true;
  verifyBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>';
  errorEl.style.display = 'none';

  try {
    const result = await confirmationResult.confirm(code);
    await bootstrapShopConfig(result.user);
    // onAuthStateChanged in app.js fires → app shell mounts → handleRoute()
  } catch (err) {
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify & Sign In';
    showError(errorEl, friendlyAuthError(err.code));
  }
}

// ----- Bootstrap shop config on first login -----
async function bootstrapShopConfig(user) {
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        shop_name: SHOP_NAME,
        authorized_phones: [user.phoneNumber],
        whatsapp_number: WHATSAPP_NUMBER || '',
        created_at: serverTimestamp()
      });
    }
  } catch (err) {
    // Non-fatal: Security Rules may block this if the user is not authorized.
    // If config doesn't exist, Security Rules will reject their reads anyway.
    console.warn('[Vikretha] bootstrapShopConfig error (expected if not first run):', err.code);
  }
  // Navigate to dashboard — onAuthStateChanged in app.js handles rendering
  window.location.hash = '#/dashboard';
}

// ----- Helpers -----
function showError(el, message) {
  el.textContent = message;
  el.style.display = 'block';
}

function friendlyAuthError(code) {
  const messages = {
    'auth/invalid-phone-number': 'Invalid phone number. Use 10-digit format.',
    'auth/too-many-requests': 'Too many attempts. Please try again after some time.',
    'auth/invalid-verification-code': 'Wrong OTP. Check the SMS and try again.',
    'auth/code-expired': 'OTP has expired. Please request a new one.',
    'auth/quota-exceeded': 'Daily OTP limit reached (10/day on free plan). Try tomorrow.',
    'auth/network-request-failed': 'No internet connection. Check your network.',
    'auth/missing-phone-number': 'Enter a phone number to continue.',
    'auth/captcha-check-failed': 'Security check failed. Reload the page and try again.',
  };
  return messages[code] || `Sign-in error (${code}). Please try again.`;
}
