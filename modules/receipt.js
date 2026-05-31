/**
 * modules/receipt.js — Receipt Page
 * Fetch sale from Firestore, draw Canvas 2D receipt, download PNG, WhatsApp share.
 */
import { db }          from '../lib/firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  SHOP_NAME, SHOP_ID, CURRENCY, LOCALE, LOGO_URL, WHATSAPP_NUMBER
} from '../shop.config.js';

// ── Canvas receipt drawing ────────────────────────────────────────────────────

async function _drawReceipt(sale) {
  const DPR    = 2;         // retina-quality output
  const WIDTH  = 400;       // logical px (thermal roll width)
  const PADX   = 24;
  const FONT   = '"Courier New", Courier, monospace';

  // Palette — warm thermal paper
  const PAPER  = '#fdf8ed';
  const INK    = '#111111';
  const MUTED  = '#7a7060';
  const FAINT  = '#c5b99a';
  const ACCENT = '#f97316'; // orange for grand total
  const ERR    = '#c0392b'; // discount red

  // Column right-edges (logical px, monospace-aligned)
  const C_NAME = PADX;       // left-aligned
  const C_QTY  = 200;        // qty right-edge
  const C_RATE = 298;        // unit price right-edge
  const C_AMT  = WIDTH - PADX; // line total right-edge

  const items    = sale.items || [];
  const hasDisc  = (sale.discount ?? 0) > 0;
  const hasLogo  = !!(LOGO_URL?.trim());
  const hasPhone = !!sale.customer_phone;

  // ── Height calculation ───────────────────────────────────────────────────
  const EDGE_H  = 14;  // torn-edge height top + bottom
  const LH      = 22;  // standard line height
  const SEP_H   = 16;  // separator total height (line + gap)

  let bodyH = 0;
  bodyH += 18;                        // top inner padding
  if (hasLogo) bodyH += 64;
  bodyH += 32;                        // shop name
  bodyH += LH;                        // "* RECEIPT *" deco
  bodyH += LH;                        // bill #
  bodyH += LH;                        // date
  bodyH += SEP_H;                     // sep
  bodyH += LH;                        // column headers
  bodyH += SEP_H;                     // sep
  bodyH += items.length * LH;         // item rows
  bodyH += SEP_H;                     // sep
  bodyH += LH;                        // subtotal
  if (hasDisc) bodyH += LH;           // discount
  bodyH += SEP_H;                     // solid rule
  bodyH += 30;                        // TOTAL (bigger)
  bodyH += SEP_H;                     // sep
  bodyH += LH;                        // thank you
  bodyH += LH;                        // shop name repeat
  if (hasPhone) bodyH += LH;          // customer
  bodyH += LH;                        // star line
  bodyH += 14;                        // bottom inner padding

  const CANVAS_H = EDGE_H + bodyH + EDGE_H;

  // ── Create canvas ────────────────────────────────────────────────────────
  const canvas  = document.createElement('canvas');
  canvas.width  = WIDTH  * DPR;
  canvas.height = CANVAS_H * DPR;
  const ctx     = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── Outer background (surface behind paper) ──────────────────────────────
  ctx.fillStyle = '#e6e0d4';
  ctx.fillRect(0, 0, WIDTH, CANVAS_H);

  // ── Paper shape with torn top + bottom edges ─────────────────────────────
  const TEETH = Math.ceil(WIDTH / 12);
  const TW    = WIDTH / TEETH;   // tooth width

  ctx.beginPath();
  // Top torn edge — zigzag from left→right
  ctx.moveTo(0, EDGE_H);
  for (let i = 0; i < TEETH; i++) {
    const x = i * TW;
    ctx.lineTo(x + TW * 0.5, 3);          // peak (upward)
    ctx.lineTo(x + TW,       EDGE_H);     // valley
  }
  // Right side straight down
  ctx.lineTo(WIDTH, CANVAS_H - EDGE_H);
  // Bottom torn edge — zigzag right→left
  for (let i = TEETH; i > 0; i--) {
    const x = i * TW;
    ctx.lineTo(x - TW * 0.5, CANVAS_H - 3);    // peak (downward)
    ctx.lineTo(x - TW,       CANVAS_H - EDGE_H); // valley
  }
  ctx.lineTo(0, EDGE_H);
  ctx.closePath();

  // Drop shadow behind paper
  ctx.shadowColor   = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur    = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = PAPER;
  ctx.fill();
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // ── Subtle horizontal grain lines (thermal paper texture) ────────────────
  for (let gy = EDGE_H; gy < CANVAS_H - EDGE_H; gy += 4) {
    ctx.strokeStyle = 'rgba(0,0,0,0.018)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0,     gy);
    ctx.lineTo(WIDTH, gy);
    ctx.stroke();
  }

  // ── Drawing helpers ──────────────────────────────────────────────────────
  let y = EDGE_H + 18;

  const dSep = () => {
    ctx.save();
    ctx.strokeStyle = FAINT;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PADX, y);
    ctx.lineTo(WIDTH - PADX, y);
    ctx.stroke();
    ctx.restore();
    y += SEP_H;
  };

  const sSep = () => {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(PADX, y);
    ctx.lineTo(WIDTH - PADX, y);
    ctx.stroke();
    ctx.restore();
    y += SEP_H;
  };

  // ── Logo ─────────────────────────────────────────────────────────────────
  if (hasLogo) {
    await new Promise(res => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, (WIDTH - 48) / 2, y, 48, 48); res(); };
      img.onerror = res;
      img.src     = LOGO_URL;
    });
    y += 60;
  }

  // ── Shop name ─────────────────────────────────────────────────────────────
  ctx.font      = `bold 20px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(SHOP_NAME.toUpperCase(), WIDTH / 2, y);
  y += 32;

  // ── Deco row ──────────────────────────────────────────────────────────────
  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('* * * * * * RECEIPT * * * * * *', WIDTH / 2, y);
  y += LH;

  // ── Bill # and date ───────────────────────────────────────────────────────
  const dateStr = new Date(sale.timestamp?.toDate?.() ?? Date.now())
    .toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
  ctx.font      = `12px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText(`BILL #  ${String(sale.saleId ?? '').padStart(8, '0')}`, PADX, y);
  y += LH;
  ctx.fillText(`DATE    ${dateStr}`, PADX, y);
  y += LH;

  dSep();

  // ── Column headers ────────────────────────────────────────────────────────
  ctx.font      = `bold 11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('ITEM',  C_NAME, y);
  ctx.textAlign = 'right';
  ctx.fillText('QTY',  C_QTY,  y);
  ctx.fillText('RATE', C_RATE, y);
  ctx.fillText('AMT',  C_AMT,  y);
  y += LH;

  dSep();

  // ── Item rows ─────────────────────────────────────────────────────────────
  items.forEach((item, idx) => {
    // Alternating very faint row tint
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.03)';
      ctx.fillRect(PADX, y - LH + 4, WIDTH - PADX * 2, LH);
    }
    const name = item.name.length > 18 ? item.name.slice(0, 17) + '\u2026' : item.name;
    ctx.font      = `13px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase(), C_NAME, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(item.qty),                             C_QTY,  y);
    ctx.fillText(`${CURRENCY}${item.price.toFixed(2)}`,        C_RATE, y);
    ctx.fillStyle = INK;
    ctx.fillText(`${CURRENCY}${item.line_total.toFixed(2)}`,   C_AMT,  y);
    y += LH;
  });

  dSep();

  // ── Subtotal ──────────────────────────────────────────────────────────────
  ctx.font      = `12px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('SUBTOTAL', C_RATE - 68, y);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${(sale.subtotal ?? sale.total).toFixed(2)}`, C_AMT, y);
  y += LH;

  // ── Discount ──────────────────────────────────────────────────────────────
  if (hasDisc) {
    ctx.font      = `12px ${FONT}`;
    ctx.fillStyle = ERR;
    ctx.textAlign = 'left';
    ctx.fillText('DISCOUNT', C_RATE - 68, y);
    ctx.textAlign = 'right';
    ctx.fillText(`- ${CURRENCY}${sale.discount.toFixed(2)}`, C_AMT, y);
    y += LH;
  }

  sSep();

  // ── Grand total ───────────────────────────────────────────────────────────
  ctx.font      = `bold 17px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', C_RATE - 68, y + 12);
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${sale.total.toFixed(2)}`, C_AMT, y + 12);
  y += 30;

  dSep();

  // ── Footer ────────────────────────────────────────────────────────────────
  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('THANK YOU FOR SHOPPING!', WIDTH / 2, y);
  y += LH;
  ctx.font      = `bold 11px ${FONT}`;
  ctx.fillText(SHOP_NAME.toUpperCase(), WIDTH / 2, y);
  y += LH;

  if (hasPhone) {
    ctx.font      = `11px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(`CUSTOMER : ${sale.customer_phone}`, WIDTH / 2, y);
    y += LH;
  }

  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = FAINT;
  ctx.fillText('* * * * * * * * * * * * * * *', WIDTH / 2, y);

  return canvas;
}

// ── Main render ───────────────────────────────────────────────────────────────

export async function render(container, saleId) {
  // Guard — no sale ID
  if (!saleId) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No receipt ID provided.</p>
        <a href="#/dashboard">← Back to Dashboard</a>
      </div>`;
    return;
  }

  // Loading spinner
  container.innerHTML = `
    <div style="padding:32px;text-align:center;">
      <div class="spinner" style="margin:0 auto;"></div>
    </div>`;

  // Fetch sale
  const saleRef = doc(db, 'shops', SHOP_ID, 'sales', saleId);
  const snap    = await getDoc(saleRef);

  if (!snap.exists()) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Receipt not found.</p>
        <a href="#/dashboard">← Back to Dashboard</a>
      </div>`;
    return;
  }

  const sale = snap.data();

  // Build page structure
  container.innerHTML = `
    <div class="receipt-page">
      <div class="receipt-preview">
        <img id="receipt-img" alt="Receipt" style="width:100%;display:block;" />
      </div>
      <div class="receipt-actions">
        <button id="btn-download" class="btn btn-primary btn-full">↓ Download Receipt</button>
        <button id="btn-whatsapp" class="btn btn-whatsapp btn-full">Share via WhatsApp</button>
        <a href="#/dashboard" style="display:block;text-align:center;margin-top:8px;color:var(--text-secondary);font-size:0.875rem;">
          ← Back to Dashboard
        </a>
      </div>
    </div>`;

  // Draw receipt canvas
  const canvas  = await _drawReceipt(sale);
  const dataUrl = canvas.toDataURL('image/png');
  document.getElementById('receipt-img').src = dataUrl;

  // Download button
  document.getElementById('btn-download').addEventListener('click', () => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `receipt-${saleId}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  // WhatsApp share button — Web Share API with wa.me fallback
  document.getElementById('btn-whatsapp').addEventListener('click', async () => {
    const message = `Receipt from ${SHOP_NAME}\nBill #${saleId}\nTotal: ${CURRENCY}${sale.total.toFixed(2)}`;

    if (navigator.canShare) {
      try {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const file = new File([blob], `receipt-${saleId}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Receipt — ${SHOP_NAME}`, text: message });
          return;
        }
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled — don't fall through to wa.me
      }
    }

    // Fallback: wa.me deep link
    const phone = (sale.customer_phone || WHATSAPP_NUMBER || '').replace(/\D/g, '');
    const text  = encodeURIComponent(message);
    const url   = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}
