/**
 * modules/receipt.js — Receipt Page
 * Fetch sale from Firestore, draw Canvas 2D receipt, download PNG, WhatsApp share.
 */
import { db }          from '../lib/firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  SHOP_NAME, SHOP_ID, CURRENCY, LOCALE, LOGO_URL, WHATSAPP_NUMBER, THEME_COLOR
} from '../shop.config.js';

// ── Canvas receipt drawing ────────────────────────────────────────────────────

async function _drawReceipt(sale) {
  const BRAND = THEME_COLOR;
  const BG    = '#ffffff';
  const TEXT  = '#1a1a1a';
  const MUTED = '#6b7280';
  const LINE  = '#e5e7eb';

  const WIDTH  = 400;
  const PADX   = 16;
  const ROW_H  = 30;

  // ── Measure total canvas height ──────────────────────────────────────────
  const itemCount     = sale.items ? sale.items.length : 0;
  const hasDiscount   = sale.discount > 0;
  const hasLogo       = LOGO_URL && LOGO_URL.trim() !== '';
  const hasPhone      = sale.customer_phone;

  const logoH         = hasLogo ? 60 : 0;    // 48px image + 12px gap
  const headerH       = logoH + 120;          // shop name + date + bill # + rule
  const columnRowH    = 28;
  const itemsH        = columnRowH + (itemCount * ROW_H) + 12; // header + items + gap
  const discountRowH  = hasDiscount ? 24 : 0;
  const totalsH       = 24 + discountRowH + 8 + 36 + 16;       // subtotal + discount + rule + total + gap
  const footerH       = hasPhone ? 56 : 40;                     // thank-you + optional phone + padding
  const TOTAL_H       = headerH + itemsH + totalsH + footerH;

  // ── Create canvas ────────────────────────────────────────────────────────
  const canvas  = document.createElement('canvas');
  canvas.width  = WIDTH;
  canvas.height = TOTAL_H;
  const ctx     = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, TOTAL_H);

  let y = 24;

  // ── Logo (optional) ─────────────────────────────────────────────────────
  if (hasLogo) {
    await new Promise(res => {
      const img    = new Image();
      img.onload   = () => {
        const logoSize = 48;
        ctx.drawImage(img, (WIDTH - logoSize) / 2, y, logoSize, logoSize);
        res();
      };
      img.onerror  = res; // skip logo if it fails to load
      img.src      = LOGO_URL;
    });
    y += 60;
  }

  // ── Shop name ────────────────────────────────────────────────────────────
  ctx.font      = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'center';
  ctx.fillText(SHOP_NAME, WIDTH / 2, y);
  y += 28;

  // ── Date ─────────────────────────────────────────────────────────────────
  const dateStr = new Date(sale.timestamp?.toDate?.() ?? Date.now()).toLocaleString(LOCALE);
  ctx.font      = '13px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.fillText(dateStr, WIDTH / 2, y);
  y += 20;

  // ── Sale ID ───────────────────────────────────────────────────────────────
  ctx.font      = 'bold 14px monospace';
  ctx.fillStyle = BRAND;
  ctx.fillText(`Bill #${sale.saleId}`, WIDTH / 2, y);
  y += 20;

  // ── Header rule ──────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = LINE;
  ctx.lineWidth   = 1;
  ctx.moveTo(PADX, y);
  ctx.lineTo(WIDTH - PADX, y);
  ctx.stroke();
  y += 16;

  // ── Column headers ───────────────────────────────────────────────────────
  ctx.font      = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('ITEM',  PADX, y);
  ctx.textAlign = 'right';
  ctx.fillText('QTY',   220, y);
  ctx.fillText('PRICE', 300, y);
  ctx.fillText('TOTAL', 390, y);
  y += 16;

  // ── Item rows ─────────────────────────────────────────────────────────────
  const items = sale.items || [];
  items.forEach((item, idx) => {
    // Alternate row background
    if (idx % 2 === 0) {
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(PADX, y - 16, WIDTH - PADX * 2, ROW_H);
    }

    // Item name (truncate to 24 chars)
    const name = item.name.length > 24 ? item.name.slice(0, 23) + '…' : item.name;
    ctx.font      = '14px system-ui, sans-serif';
    ctx.fillStyle = TEXT;
    ctx.textAlign = 'left';
    ctx.fillText(name, PADX, y);

    ctx.textAlign = 'right';
    ctx.fillText(String(item.qty),                                         220, y);
    ctx.fillText(`${CURRENCY}${item.price.toFixed(2)}`,                    300, y);
    ctx.fillText(`${CURRENCY}${item.line_total.toFixed(2)}`,               390, y);
    y += ROW_H;
  });

  // ── Rule after items ─────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = LINE;
  ctx.lineWidth   = 1;
  ctx.moveTo(PADX, y);
  ctx.lineTo(WIDTH - PADX, y);
  ctx.stroke();
  y += 16;

  // ── Subtotal ─────────────────────────────────────────────────────────────
  ctx.font      = '13px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('Subtotal', 220, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${sale.subtotal.toFixed(2)}`, 390, y);
  y += 24;

  // ── Discount (only if > 0) ────────────────────────────────────────────────
  if (hasDiscount) {
    ctx.font      = '13px system-ui, sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'left';
    ctx.fillText('Discount', 220, y);
    ctx.textAlign = 'right';
    ctx.fillText(`−${CURRENCY}${sale.discount.toFixed(2)}`, 390, y);
    y += 24;
  }

  // ── Thick rule before total ───────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = TEXT;
  ctx.lineWidth   = 2;
  ctx.moveTo(PADX, y);
  ctx.lineTo(WIDTH - PADX, y);
  ctx.stroke();
  y += 12;

  // ── Grand total ───────────────────────────────────────────────────────────
  ctx.font      = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', 220, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${sale.total.toFixed(2)}`, 390, y);
  y += 24;

  // ── Footer rule ───────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.strokeStyle = LINE;
  ctx.lineWidth   = 1;
  ctx.moveTo(PADX, y);
  ctx.lineTo(WIDTH - PADX, y);
  ctx.stroke();
  y += 14;

  // ── Footer text ───────────────────────────────────────────────────────────
  ctx.font      = '12px system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(`Thank you for shopping at ${SHOP_NAME}!`, WIDTH / 2, y);

  if (hasPhone) {
    y += 16;
    ctx.fillText(`Customer: ${sale.customer_phone}`, WIDTH / 2, y);
  }

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
