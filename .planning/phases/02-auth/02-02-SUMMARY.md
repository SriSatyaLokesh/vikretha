# Phase 02-auth — Plan 02 Summary

## What Was Built

`firestore.rules` — Firestore Security Rules with deny-all default and per-shop email authorization.  
`modules/settings.js` — Settings screen with sign-out functionality.

## Artifacts Created

| File | Lines | Status |
|------|-------|--------|
| firestore.rules | 54 | ✅ Created |
| modules/settings.js | 61 | ✅ Created |

## Implementation Details

### firestore.rules

- **Deny-all base rule:** `allow read, write: if false` on `/{document=**}`
- **`isAuthorized(shopId)` function:** reads `/shops/{shopId}/config` via `get()`, checks `request.auth.token.email in config.data.authorized_emails`
- **Shop data rule:** all subcollections under `/shops/{shopId}/` gated by `isAuthorized(shopId)` for both read and write
- **Bootstrap create rule:** allows authenticated user to `create` `/shops/{shopId}/config` only if `request.auth.token.email in request.resource.data.authorized_emails` (user can only bootstrap with own email)
- Comprehensive inline comments with setup instructions and staff-adding guide for shop owner

### modules/settings.js

- `render(container)` — exported entry point, called by app.js on `#/settings` route
- Displays signed-in user email (`auth.currentUser?.email`) and `SHOP_ID`
- Sign Out button calls `signOut(auth)`; button disabled immediately on click (prevents double-tap)
- `escapeHtml()` sanitizes email and SHOP_ID before innerHTML injection
- "Coming soon" placeholder for Phase 8 staff management features

## Security

- **Cross-shop isolation:** `isAuthorized(shopId)` reads the specific shop's config — authorized in `shop_A` cannot access `shop_B`
- **Bootstrap elevation prevention:** bootstrap `allow create` requires `request.auth.token.email in request.resource.data.authorized_emails`
- **XSS:** `escapeHtml()` on email and SHOP_ID in settings screen
- **Double-tap signOut:** button disabled immediately on click

## Verification

```
PASS: firestore.rules valid
PASS: modules/settings.js valid (61 lines)
```
All checks passed.

## Git Commit

`feat(02-02): create firestore.rules + modules/settings.js - security rules + sign-out`

## Deployment Note

`firestore.rules` is a copy-paste template — must be published in Firebase Console → Firestore → Rules tab before auth will work end-to-end. Instructions included in file comments.
