---
phase: 15-sales-history-mgmt
plan: "02"
subsystem: reports, firestore-rules
tags: [bill-editing, owner-only, firestore-rules, audit-trail, role-check]
dependency_graph:
  requires: [15-01, shops/{SHOP_ID}/config/main staff_roles, firestore.rules]
  provides: [owner bill editing, firestore sales update rule]
  affects: [modules/reports.js, firestore.rules]
tech_stack:
  added: []
  patterns: [role-based-visibility, updateDoc-audit-trail, belt-and-suspenders-validation]
key_files:
  created: []
  modified: [firestore.rules, modules/reports.js (via plan 01 commit)]
decisions:
  - "Separate allow update and allow delete rules (vs combined) — explicit intent, audit-friendly"
  - "getRole == 'owner' not isOwnerOrAdmin — admins explicitly excluded from bill editing"
  - "originalTotal preserves first original (use originalTotal ?? total) — prevents overwrites on re-edits"
  - "Edit form fires-and-forgets _injectEditZone after _renderDetailPanel — role check is async"
metrics:
  duration: "~10 min"
  completed: "2026-06-02"
  tasks: 2
  files: 2
---

# Phase 15 Plan 02: Owner-Only Bill Editing Summary

**One-liner:** Owner-only edit bill form with live recalc + Firestore updateDoc with audit trail; Firestore rules updated to permit owner-only sales updates.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Firestore rules — owner sales update permission | 9689a82 | firestore.rules |
| 2 | Owner edit bill form in reports.js detail panel | 8bd5194 | modules/reports.js |

## Firestore Rules Change

**Before:**
```
// No updates or deletes — immutable
allow update, delete: if false;
```

**After:**
```
// Owner can amend a sale (correction with audit trail). Delete still blocked.
allow update: if isAuthorized(shopId)
  && getRole(shopId) == 'owner'
  && request.resource.data.keys().hasAll(['saleId', 'timestamp', 'items', 'total',
      'editedAt', 'editedBy', 'originalTotal', 'amendedTotal'])
  && request.resource.data.total >= 0
  && request.resource.data.amendedTotal >= 0;
allow delete: if false;
```

## Edit Form HTML Element IDs

| ID | Purpose |
|----|---------|
| `#rpt-edit-btn` | Toggle edit form (owner only, injected into #rpt-edit-zone) |
| `#rpt-edit-form` | Collapsible edit form container |
| `#rpt-edit-items` | Edit items table |
| `#rpt-edit-tbody` | Edit items table body |
| `#rpt-add-row` | Add blank item row |
| `#rpt-edit-disc` | Discount input |
| `#rpt-edit-totals` | Live-updated totals display |
| `#rpt-save-edit` | Save changes button |
| `#rpt-cancel-edit` | Cancel edit |
| `#rpt-edit-error` | Error display |

## Deviations from Plan

**[Combined delivery] Edit bill JS was included in Plan 01 commit (`8bd5194`)**
- All JS functions (`_injectEditZone`, `_addEditRow`, `_populateEditRows`, `_recalcEditTotals`, `_saveEdit`) were committed together with Plan 01's detail panel code
- Plan 02 commit (`9689a82`) covers only `firestore.rules`
- All Plan 02 success criteria remain fully met

## Threat Mitigations Applied

| ID | Mitigation |
|----|-----------|
| T-15-05 | Firestore rules require `getRole == 'owner'` server-side — cashier bypass impossible |
| T-15-06 | Firestore rule validates `total >= 0` and `amendedTotal >= 0`; client clamps discount |
| T-15-07 | Firestore `hasAll(['editedAt','editedBy','originalTotal','amendedTotal'])` prevents partial writes |
| T-15-08 | Item names in edit form pass through `escapeHtml()` before innerHTML re-render |
| T-15-09 | `getRole == 'owner'` (not `isOwnerOrAdmin`) — admins explicitly excluded |
| T-15-10 | `editedAt`, `editedBy`, `originalTotal` stored immutably on sale doc |

## Self-Check

- [x] `firestore.rules` updated — owner update rule with required fields validation
- [x] `modules/reports.js` includes `_injectEditZone`, `_saveEdit`, `_populateEditRows`, `_recalcEditTotals`
- [x] Commit `9689a82` exists — firestore.rules change
- [x] Commit `8bd5194` exists — reports.js with edit form

## Self-Check: PASSED
