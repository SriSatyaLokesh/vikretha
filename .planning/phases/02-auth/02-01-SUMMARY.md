# Phase 02-auth — Plan 01 Summary

## What Was Built

`modules/auth.js` — Email/Password authentication module with three-step flow.

## Artifacts Created

| File | Lines | Status |
|------|-------|--------|
| modules/auth.js | 309 | ✅ Created |

## Implementation Details

**Three-step auth flow (all within one screen container):**
- `showSignInStep(container, prefillEmail)` — Email + password form, Forgot Password link, Create Account toggle
- `showCreateAccountStep(container)` — Email + password + confirm-password form, back navigation
- `showForgotPasswordStep(container, prefillEmail)` — Email form, sends reset email, success/error message

**Key functions:**
- `render(container)` — exported entry point, called by app.js when user is null
- `handleSignIn()` — calls `signInWithEmailAndPassword`, disables button with spinner, shows friendly errors
- `handleCreateAccount()` — validates passwords match + min 6 chars, calls `createUserWithEmailAndPassword`, then `bootstrapShopConfig`
- `handleForgotPassword()` — calls `sendPasswordResetEmail`, shows green success message
- `bootstrapShopConfig(user)` — creates `/shops/{SHOP_ID}/config` with `authorized_emails: [user.email]` on first sign-up (idempotent)
- `friendlyAuthError(code)` — maps 9 Firebase error codes to user messages; default fallback for unknown codes
- `escapeHtml(str)` — sanitizes `&`, `"`, `<` for XSS-safe innerHTML injection of prefill email values

**UX details:**
- Enter key submits last field in each step (password → sign in, confirm-password → create, email → reset)
- Loading spinner replaces button text during async operations; button re-enabled on error
- Inline error banner (red background) below inputs

## Security

- XSS: `escapeHtml()` used on all user-controlled values injected into innerHTML (prefillEmail, reset email display)
- No phone/OTP references — fully email-based
- `bootstrapShopConfig` only sets `authorized_emails` to `user.email` (Firebase-validated)
- Firebase SDK v9+ returns `auth/invalid-credential` for both wrong-password and user-not-found (prevents email enumeration)

## Verification

```
PASS: modules/auth.js valid (309 lines)
```
All 14 checks passed.

## Git Commit

`feat(02-01): create modules/auth.js - Email/Password auth flow`
