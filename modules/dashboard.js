/**
 * modules/dashboard.js — Dashboard Home
 * New Sale hero CTA + bento stats grid (live data wired in Phase 5).
 * Exported: render(container) — called by app.js on #/dashboard route.
 */

export function render(container) {
  container.innerHTML = `
    <div id="dashboard-screen" style="display:flex;flex-direction:column;gap:14px;">

      <!-- ① New Sale — hero CTA card -->
      <div id="new-sale-card"
        role="button" tabindex="0"
        aria-label="Start a new sale"
        style="background:var(--theme-color);border-radius:16px;padding:20px;
               display:flex;align-items:center;justify-content:space-between;
               box-shadow:0 8px 24px rgba(37,99,235,0.30);cursor:pointer;
               transition:transform 0.1s ease, box-shadow 0.1s ease;
               -webkit-tap-highlight-color:transparent;">
        <div>
          <p style="color:rgba(255,255,255,0.75);font-size:0.8rem;
                    margin-bottom:5px;letter-spacing:0.02em;">
            Ready to record?
          </p>
          <p style="color:#fff;font-size:1.3rem;font-weight:700;line-height:1.2;">
            New Sale
          </p>
        </div>
        <!-- Plus icon in frosted circle -->
        <div style="width:52px;height:52px;background:rgba(255,255,255,0.18);
                    border-radius:50%;display:flex;align-items:center;
                    justify-content:center;flex-shrink:0;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="#fff" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </div>
      </div>

      <!-- ② Stats section label -->
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:0 2px;">
        <h2 style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);
                   text-transform:uppercase;letter-spacing:0.08em;">
          Summary
        </h2>
        <span style="font-size:0.7rem;color:var(--text-muted);">
          Live data in next update
        </span>
      </div>

      <!-- ③ Bento stats grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

        <!-- Today — full width, blue accent gradient -->
        <div class="card"
             style="grid-column:1/-1;
                    background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);
                    border:1px solid #bfdbfe;padding:18px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <p style="font-size:0.7rem;font-weight:600;color:#1d4ed8;
                        text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">
                Today
              </p>
              <p style="font-size:1.75rem;font-weight:800;color:#1e40af;
                        font-variant-numeric:tabular-nums;line-height:1;">
                ₹ —
              </p>
              <p style="font-size:0.8rem;color:#3b82f6;margin-top:5px;">
                0 sales
              </p>
            </div>
            <div style="width:40px;height:40px;background:rgba(37,99,235,0.12);
                        border-radius:10px;display:flex;align-items:center;
                        justify-content:center;flex-shrink:0;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                   stroke="#2563eb" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <path d="M8 12h8M8 16h5"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- This Week — green accent -->
        <div class="card" style="padding:16px;">
          <div style="width:34px;height:34px;background:#f0fdf4;border-radius:9px;
                      display:flex;align-items:center;justify-content:center;
                      margin-bottom:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#16a34a" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <p style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:5px;">
            This Week
          </p>
          <p style="font-size:1.25rem;font-weight:700;color:var(--text-primary);
                    font-variant-numeric:tabular-nums;line-height:1.1;">
            ₹ —
          </p>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">
            0 sales
          </p>
        </div>

        <!-- This Month — purple accent -->
        <div class="card" style="padding:16px;">
          <div style="width:34px;height:34px;background:#faf5ff;border-radius:9px;
                      display:flex;align-items:center;justify-content:center;
                      margin-bottom:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="#9333ea" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <p style="font-size:0.7rem;color:var(--text-secondary);margin-bottom:5px;">
            This Month
          </p>
          <p style="font-size:1.25rem;font-weight:700;color:var(--text-primary);
                    font-variant-numeric:tabular-nums;line-height:1.1;">
            ₹ —
          </p>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">
            0 sales
          </p>
        </div>

      </div>
    </div>`;

  // New Sale card — click + keyboard (Enter/Space) navigation
  const card = container.querySelector('#new-sale-card');
  const goToSale = () => { window.location.hash = '#/billing'; };
  card.addEventListener('click', goToSale);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToSale(); }
  });
  card.addEventListener('pointerdown', () => {
    card.style.transform = 'scale(0.97)';
    card.style.boxShadow = '0 4px 12px rgba(37,99,235,0.20)';
  });
  card.addEventListener('pointerup', () => {
    card.style.transform = '';
    card.style.boxShadow = '0 8px 24px rgba(37,99,235,0.30)';
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '0 8px 24px rgba(37,99,235,0.30)';
  });
}
