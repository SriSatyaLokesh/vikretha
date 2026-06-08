# Phase 27 — Plan 02 SUMMARY
## Save/Load + Billing Picker + Export

### Objective
Wire variant save/load to Firestore, add `_showVariantPicker` bottom-sheet to billing, expand inventory export to one row per variant.

### Artifacts Modified
- `modules/billing.js`
- `modules/export.js`

### Key Implementation Details

**billing.js — `_showVariantPicker(container, inv)`:**
- Shows colour-only or colour+size bottom-sheet for `inv.has_colors` items
- Cart key format: `inv.id + '__' + color` (colours only) or `inv.id + '__' + color + '__' + size`
- Inserted before `_showSizePicker` branch in `handleGridClick`

**billing.js — `_renderGrid` fixes:**
- `inCartCheck`: checks `item.id + '__'` prefix for `has_colors` items
- `cartItem`: sums all matching cart entries for `has_colors || hasSizes`
- `stock`: sums `variants[].qty` for `has_colors` items
- Color badge: `(!item.has_colors && item.color)` — hidden for variant items

**export.js — `_exportInventory`:**
- New `Size` column added (index 5)
- `has_colors && variants[]`: one row per variant; `v.color`, `v.size`, `v.qty`
- `hasSizes && sizes{}`: one row per size; `sv.label || sizeKey`, `sv.stock`
- Flat items: empty Size column, `d.stock`
- Sort by Name preserved

### Commit
`45e1dd9` — feat(27): inventory variant system — colors, sizes, billing picker, export
