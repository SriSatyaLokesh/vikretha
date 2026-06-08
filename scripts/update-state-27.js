const fs = require('fs');

// Update ROADMAP.md — mark 27-01 and 27-02 plans as done
{
  const file = '.planning/ROADMAP.md';
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(
    '- [ ] 27-01-PLAN.md — Inventory form: Brand below Name, Type/Brand autocomplete, Has Colors + variant row UI',
    '- [x] 27-01-PLAN.md — Inventory form: Brand below Name, Type/Brand autocomplete, Has Colors + variant row UI'
  );
  src = src.replace(
    '- [ ] 27-02-PLAN.md — Has Sizes sub-rows, Firestore save/load, list badge, billing picker, export rows',
    '- [x] 27-02-PLAN.md — Has Sizes sub-rows, Firestore save/load, list badge, billing picker, export rows'
  );
  fs.writeFileSync(file, src, 'utf8');
  console.log('ROADMAP.md updated. Size:', fs.statSync(file).size);
}

// Update STATE.md — mark Phase 27 as In Progress (checkpoint pending)
{
  const file = '.planning/STATE.md';
  let src = fs.readFileSync(file, 'utf8');

  // Update current status
  src = src.replace(
    '- **Phase:** 22 or 24 (next to plan)\n- **Next action:** Run `/gsd-plan-phase 22` or `/gsd-plan-phase 24`\n- **Last session:** 2026-06-08 — Phase 27 added: Inventory Variant System (Colors & Sizes) — Has Colors checkbox, Has Sizes sub-rows, Type/Brand autocomplete, Brand moved below Name. Ready to plan.',
    '- **Phase:** 27 (implementation done, checkpoint pending)\n- **Next action:** UAT checkpoint for Phase 27\n- **Last session:** 2026-06-09 — Phase 27 execution complete: inventory.js rewritten, billing.js + export.js updated. Pending human UAT checkpoint.'
  );

  // Update phase table row
  src = src.replace(
    '| 27 | Inventory Variant System (Colors & Sizes) | 🔲 Not Started |',
    '| 27 | Inventory Variant System (Colors & Sizes) | 🔄 In Progress (checkpoint pending) |'
  );

  fs.writeFileSync(file, src, 'utf8');
  console.log('STATE.md updated. Size:', fs.statSync(file).size);
}
