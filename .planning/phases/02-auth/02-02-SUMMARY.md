# Plan 02-02 Summary — Firestore Security Rules + Settings Module

## Status: Complete

## Artifacts Created

- `firestore.rules` — Firestore Security Rules with deny-all default + per-shop authorization
- `modules/settings.js` — 58 lines, exports `render(container)` with sign-out functionality

## What Was Built

### firestore.rules
- **Deny-all base rule** — `match /{document=**} { allow read, write: if false; }`
- **`isAuthorized(shopId)`** — reads `/shops/{shopId}/config.authorized_phones`, checks `request.auth.token.phone_number` membership
- **Shop data rule** — `match /shops/{shopId}/{document=**}` allows read+write if `isAuthorized`
- **Bootstrap rule** — `allow create` on `/shops/{shopId}/config` for authenticated users who include their own phone in `request.resource.data.authorized_phones` (prevents spoofing)
- Setup comments guide shop owner through copy-paste deployment to Firebase Console

### modules/settings.js
- Displays current user phone and Shop ID
- Sign Out button calls `signOut(auth)` from Firebase Auth
- Button disabled immediately on click (prevents double-tap)
- Relies on `onAuthStateChanged(null)` in `app.js` for navigation back to login
- "Coming soon" placeholder for Phase 8 staff management

## Bootstrap Rule Rationale

The chicken-and-egg problem: deny-all blocks the first write, but the first write needs to create `authorized_phones`. Solved by a separate `allow create` rule that only permits creating the config doc with your own authenticated phone number. Once created, `isAuthorized` takes over for all subsequent access.

## Verification

All 7 firestore.rules checks and 5 settings.js checks passed.
