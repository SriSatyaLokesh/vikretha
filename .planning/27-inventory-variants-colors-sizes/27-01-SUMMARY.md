# Phase 27 — Plan 01 SUMMARY
## Inventory Form Restructure + CSS

### Objective
Restructure inventory form to support colour variants (with optional per-colour sizes), add datalist autocomplete for brand/type, wire the `syncColorVariantMode()` state machine.

### Artifacts Created / Modified
- `modules/inventory.js` — full rewrite
- `styles/main.css` — Phase-27 CSS appended

### Key Implementation Details

**Form field order:**
Name → Brand (datalist) → Unit → Has Colors → Has Sizes (nested, disabled) → Color Variant Section → Has sizes? (Phase-13) → Qty → Sizes → Price → Threshold → Type (datalist) → Color (flat, hidden when Has Colors)

**State machine — `syncColorVariantMode()`:**
- When Has Colors = ON: show color variant section, disable Has Sizes (flat), hide flat color/qty/phase-13 sizes
- When Has Colors = OFF: hide color variant section, re-enable Has Sizes (flat), show flat fields

**Color variant section:**
- `_appendColorRow(colorRowsList, {color, qty, sizes}, showSizes)` — builds one color row with optional size sub-rows
- `_appendSizeSubRow(list, {size, qty})` — builds one size sub-row
- "Add Color" button, "Add Size" (per color), remove buttons

**Datalist autocomplete:**
- Brand: `<datalist id="brand-list">` populated from `_items.map(i => i.brand)`
- Type: `<datalist id="type-list">` populated from `_items.map(i => i.type)`

**Save handler:**
- Collects `has_colors`, `has_sizes`, `variants[]` (each: `{color, qty, size?}`)
- `stock = sum(variants[].qty)` when `has_colors = true`

**Pre-fill / edit:**
- Restores color rows from `item.variants` (groups by color when `item.has_sizes`)

**List badges:**
- Table + mobile: `variantBadge` shows "N colors" or "N colors × M sizes"
- Flat color badge only shown when `!item.has_colors`

**CSS added:**
```css
.inv-color-row { background, border, border-radius, padding, margin-bottom }
.inv-color-sizes-sub { padding-left, border-left, margin }
.inv-size-sub-row { display: flex, gap, align-items, margin-bottom }
```

### Commit
`45e1dd9` — feat(27): inventory variant system — colors, sizes, billing picker, export
