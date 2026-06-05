/**
 * modules/receipt.js — Receipt Page
 * Fetch sale from Firestore, draw Canvas 2D receipt, download PNG, WhatsApp share.
 */
import { db, getShopConfig } from '../lib/firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  SHOP_NAME, SHOP_ID, CURRENCY, LOCALE, LOGO_URL, RECEIPT_FOOTER, THEME_COLOR, WHATSAPP_NUMBER
} from '../shop.config.js';

// ── Canvas receipt drawing ────────────────────────────────────────────────────

async function _drawReceipt(sale, cfg = {}) {
  const DPR    = 2;
  const WIDTH  = 380;
  const PADX   = 22;
  const FONT   = '"Courier New", Courier, monospace';
  const _shopName  = (cfg.shopName || '').trim() || SHOP_NAME;
  const _logoUrl   = (cfg.receiptLogoUrl || '').trim() || (LOGO_URL?.trim() || '');
  const _footer    = (cfg.receiptFooter  || '').trim() || RECEIPT_FOOTER;

  // ── Palette — bright thermal paper ──────────────────────────────────────
  const PAPER    = '#FEFEF8';   // bright white with micro warmth
  const INK      = '#111111';   // near-black, crisp
  const MUTED    = '#7A7060';   // warm mid-gray
  const FAINT    = '#CDC5B8';   // very light for deco
  const SAVE     = '#B83A2A';   // discount red
  const SEP_CLR  = '#C4BDB0';   // separator lines

  // ── Column grid (all right-aligned except item name) ─────────────────────
  const C_AMT   = WIDTH - PADX;        // line total right edge
  const C_RATE  = C_AMT  - 80;         // unit rate right edge
  const C_QTY   = C_RATE - 48;         // qty right edge
  const NAME_W  = C_QTY  - PADX - 10;  // max width for item name column

  const LH      = 20;   // line height
  const SEP_H   = 14;   // separator height
  const EDGE_H  = 0;    // no edge decoration

  const items    = sale.items || [];
  const hasDisc  = (sale.discount ?? 0) > 0;
  const hasLogo  = !!_logoUrl;
  const hasCustName  = !!sale.customer_name;
  const hasCustPhone = !!sale.customer_phone;
  const hasCustomer  = hasCustName || hasCustPhone;

  // ── Pre-measure item name wrapping (temp canvas) ──────────────────────────
  const tmpCtx   = document.createElement('canvas').getContext('2d');
  const ITEM_FONT = `12px ${FONT}`;

  function wrapText(text, maxW) {
    tmpCtx.font = ITEM_FONT;
    if (tmpCtx.measureText(text).width <= maxW) return [text];
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && tmpCtx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [text];
  }

  const rows    = items.map(item => {
    const nameText  = item.name.toUpperCase();
    const nameLines = wrapText(nameText, NAME_W);
    const sizeText  = item.size_label ? item.size_label.toUpperCase() : null;
    const rowH      = nameLines.length * LH + (sizeText ? 12 : 0);
    return { ...item, lines: nameLines, sizeText, rowH };
  });
  const itemsH = rows.reduce((s, r) => s + r.rowH, 0);

  // ── Canvas height calculation ─────────────────────────────────────────────
  let bodyH = 22;
  bodyH += 72;                          // logo image OR script-font wordmark
  bodyH += 28;                           // shop name
  bodyH += 14;                           // gap + deco line 1
  bodyH += LH + 10;                      // deco RECEIPT + gap
  bodyH += LH;                           // BILL #
  bodyH += LH;                           // DATE
  bodyH += SEP_H;                        // ---
  bodyH += LH;                           // column headers
  bodyH += SEP_H;                        // ---
  bodyH += itemsH;                       // item rows (variable, wrapping)
  bodyH += SEP_H;                        // ---
  bodyH += LH;                           // SUBTOTAL
  if (hasDisc) bodyH += LH;             // DISCOUNT
  bodyH += SEP_H + 8;                    // === thick sep
  bodyH += 36;                           // TOTAL
  bodyH += SEP_H + 8;                    // === thick sep
  if (hasCustomer) {
    if (hasCustName)  bodyH += LH;
    if (hasCustPhone) bodyH += LH;
    bodyH += SEP_H;
  }
  bodyH += LH;                           // THANK YOU
  bodyH += LH;                           // shop name footer
  bodyH += 12;                           // gap
  bodyH += 26;                           // Code 39 barcode bars
  bodyH += 16;                           // sale ID text below barcode
  bodyH += 20;                           // bottom padding

  const CANVAS_H = EDGE_H + bodyH + EDGE_H;

  // ── Create canvas ─────────────────────────────────────────────────────────
  const canvas  = document.createElement('canvas');
  canvas.width  = WIDTH  * DPR;
  canvas.height = CANVAS_H * DPR;
  const ctx     = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  // ── Paper — plain white rectangle ────────────────────────────────────────
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, CANVAS_H);

  // ── Thermal paper grain ───────────────────────────────────────────────────
  for (let gy = EDGE_H; gy < CANVAS_H - EDGE_H; gy += 3) {
    ctx.strokeStyle = 'rgba(0,0,0,0.010)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WIDTH, gy); ctx.stroke();
  }

  let y = EDGE_H + 22;

  // ── Drawing helpers ───────────────────────────────────────────────────────
  const dSep = () => {
    ctx.save();
    ctx.strokeStyle = SEP_CLR; ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(PADX, y); ctx.lineTo(WIDTH - PADX, y); ctx.stroke();
    ctx.restore();
    y += SEP_H;
  };

  const thickSep = () => {
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(PADX, y); ctx.lineTo(WIDTH - PADX, y); ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(PADX, y + 4); ctx.lineTo(WIDTH - PADX, y + 4); ctx.stroke();
    ctx.restore();
    y += SEP_H + 8;
  };

  // ── Logo ──────────────────────────────────────────────────────────────────
  if (hasLogo) {
    await new Promise(res => {
      const img   = new Image();
      const timer = setTimeout(res, 2000);
      img.crossOrigin = 'anonymous';  // required to keep canvas untainted for toDataURL
      img.onload  = () => {
        clearTimeout(timer);
        // Fit logo inside 240×52 bounding box, preserving aspect ratio
        const MAX_W = 240; const MAX_H = 52;
        const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
        const dw = img.naturalWidth * ratio;
        const dh = img.naturalHeight * ratio;
        ctx.drawImage(img, (WIDTH - dw) / 2, y + (MAX_H - dh) / 2, dw, dh);
        res();
      };
      img.onerror = () => { clearTimeout(timer); res(); };  // fall through to wordmark
      img.src     = _logoUrl;  // MUST be set after crossOrigin
    });
  } else {
    // No logo — draw shop name in Dancing Script as branded wordmark
    await document.fonts.ready;
    ctx.save();
    ctx.font      = `700 30px 'Kaushan Script', cursive`;
    ctx.fillStyle = THEME_COLOR;
    ctx.textAlign = 'center';
    ctx.fillText(_shopName, WIDTH / 2, y + 44);
    ctx.restore();
  }
  y += 72;

  // ── Shop name ─────────────────────────────────────────────────────────────
  ctx.font      = `bold 20px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(_shopName.toUpperCase(), WIDTH / 2, y);
  y += 28;

  // ── Deco: faint dots + RECEIPT label ─────────────────────────────────────
  ctx.font = `9px ${FONT}`;
  ctx.fillStyle = FAINT;
  ctx.textAlign = 'center';
  ctx.fillText('. . . . . . . . . . . . . . . . . . . . . . . . .', WIDTH / 2, y);
  y += 14;
  ctx.font      = `bold 10px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText('* * * *  SALES  RECEIPT  * * * *', WIDTH / 2, y);
  y += LH + 10;

  // ── Bill # and Date ───────────────────────────────────────────────────────
  const dateStr = new Date(sale.timestamp?.toDate?.() ?? Date.now())
    .toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('BILL #', PADX, y);
  ctx.font      = `bold 11px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(String(sale.saleId ?? '').padStart(8, '0'), WIDTH - PADX, y);
  y += LH;

  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('DATE', PADX, y);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, WIDTH - PADX, y);
  y += LH;

  dSep();

  // ── Column headers ─────────────────────────────────────────────────────────
  ctx.font      = `bold 9.5px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('ITEM', PADX, y);
  ctx.textAlign = 'right';
  ctx.fillText('QTY',  C_QTY,  y);
  ctx.fillText('RATE', C_RATE, y);
  ctx.fillText('AMT',  C_AMT,  y);
  y += LH;

  dSep();

  // ── Item rows (wrapped names) ──────────────────────────────────────────────
  rows.forEach((item, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.024)';
      ctx.fillRect(PADX - 4, y - LH + 6, WIDTH - (PADX - 4) * 2, item.rowH);
    }
    // Name lines
    ctx.font      = `12px ${FONT}`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    item.lines.forEach((line, li) => {
      ctx.fillText(line, PADX, y + li * LH);
    });
    // QTY × RATE = AMT on the last name line
    const numY = y + (item.lines.length - 1) * LH;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText(`x${item.qty}`,                             C_QTY,  numY);
    ctx.fillText(`${CURRENCY}${item.price.toFixed(2)}`,      C_RATE, numY);
    ctx.fillStyle = INK;
    ctx.fillText(`${CURRENCY}${item.line_total.toFixed(2)}`, C_AMT,  numY);
    // Size sub-line
    if (item.sizeText) {
      ctx.font      = `10px ${FONT}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left';
      ctx.fillText(item.sizeText, PADX, numY + 12);
    }
    y += item.rowH;
  });

  dSep();

  // ── Subtotal ──────────────────────────────────────────────────────────────
  ctx.font      = `11px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText('SUBTOTAL', C_RATE - 82, y);
  ctx.fillStyle = INK;
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${(sale.subtotal ?? sale.total).toFixed(2)}`, C_AMT, y);
  y += LH;

  if (hasDisc) {
    ctx.fillStyle = SAVE;
    ctx.textAlign = 'left';
    ctx.fillText('DISCOUNT', C_RATE - 82, y);
    ctx.textAlign = 'right';
    ctx.fillText(`- ${CURRENCY}${sale.discount.toFixed(2)}`, C_AMT, y);
    y += LH;
  }

  thickSep();

  // ── Grand total ───────────────────────────────────────────────────────────
  ctx.font      = `bold 18px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL', PADX, y + 14);
  ctx.textAlign = 'right';
  ctx.fillText(`${CURRENCY}${sale.total.toFixed(2)}`, C_AMT, y + 14);
  y += 36;

  thickSep();

  // ── Customer info ──────────────────────────────────────────────────────────
  if (hasCustomer) {
    ctx.font      = `10.5px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    if (hasCustName) {
      ctx.fillText(`CUSTOMER : ${sale.customer_name.toUpperCase()}`, WIDTH / 2, y);
      y += LH;
    }
    if (hasCustPhone) {
      const lbl = hasCustName ? 'PHONE    :' : 'CUSTOMER :';
      ctx.fillText(`${lbl} ${sale.customer_phone}`, WIDTH / 2, y);
      y += LH;
    }
    dSep();
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  ctx.font      = `bold 10.5px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  const footerText = _footer?.trim()
    ? RECEIPT_FOOTER.trim().toUpperCase()
    : '* THANK YOU FOR SHOPPING! *';
  ctx.fillText(footerText, WIDTH / 2, y);
  y += LH;
  ctx.font      = `10px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(_shopName.toUpperCase(), WIDTH / 2, y);
  y += LH + 12;

  // ── Code 39 Barcode (encodes sale ID) ───────────────────────────────────────
  const CODE39 = {
    '0':'000110100','1':'100100001','2':'001100001','3':'101100000',
    '4':'000110001','5':'100110000','6':'001110000','7':'000100101',
    '8':'100100100','9':'001100100','A':'100001001','B':'001001001',
    'C':'101001000','D':'000011001','E':'100011000','F':'001011000',
    'G':'000001101','H':'100001100','I':'001001100','J':'000011100',
    'K':'100000011','L':'001000011','M':'101000010','N':'000010011',
    'O':'100010010','P':'001010010','Q':'000000111','R':'100000110',
    'S':'001000110','T':'000010110','U':'110000001','V':'011000001',
    'W':'111000000','X':'010010001','Y':'110010000','Z':'011010000',
    '-':'000101001','.':'100101000',' ':'001101000','*':'010010100'
  };
  const C39_N = 1, C39_W = 3, C39_GAP = 1;
  const saleIdStr = String(sale.saleId ?? '').padStart(8, '0').toUpperCase();
  const c39chars  = ('*' + saleIdStr + '*').split('');
  // Count total units for scaling
  let c39total = 0;
  c39chars.forEach((ch, ci) => {
    const p = CODE39[ch] ?? CODE39['0'];
    for (const b of p) c39total += b === '1' ? C39_W : C39_N;
    if (ci < c39chars.length - 1) c39total += C39_GAP;
  });
  const barH  = 24;
  const barX0 = PADX + 4;
  const barW  = WIDTH - (PADX + 4) * 2;
  const c39u  = barW / c39total;
  let bx      = barX0;
  ctx.fillStyle = INK;
  c39chars.forEach((ch, ci) => {
    const p = CODE39[ch] ?? CODE39['0'];
    p.split('').forEach((bit, i) => {
      const ew = (bit === '1' ? C39_W : C39_N) * c39u;
      if (i % 2 === 0) ctx.fillRect(bx, y, ew - 0.3, barH);  // bar (odd positions)
      bx += ew;
    });
    if (ci < c39chars.length - 1) bx += C39_GAP * c39u;      // inter-char gap
  });
  y += barH + 6;
  // Sale ID text below barcode (like reference image)
  ctx.font      = `9px ${FONT}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(`* ${saleIdStr} *`, WIDTH / 2, y);

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

  const sale    = snap.data();
  const cfg     = await getShopConfig();

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
  const canvas  = await _drawReceipt(sale, cfg);
  const dataUrl = canvas.toDataURL('image/png');
  document.getElementById('receipt-img').src = dataUrl;

  // Customer history link — only when sale has customer_phone
  if (sale.customer_phone) {
    const custHistBtn = document.getElementById('btn-cust-history');
    if (custHistBtn) {
      custHistBtn.addEventListener('click', e => {
        e.preventDefault();
        window.location.hash = '#/reports/customers/' + encodeURIComponent(sale.customer_phone);
      });
    }
  }

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
