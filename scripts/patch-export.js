const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'modules', 'export.js');
const src = fs.readFileSync(filePath, 'utf8');

// Old rows/dataRows block to replace
const OLD = `    const rows = [
      ['ID', 'Name', 'Type', 'brand', 'Color', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']
    ];
    const dataRows = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const threshold = d.threshold ?? 5;
      const status    = d.stock < threshold ? 'Low Stock' : 'OK';
      dataRows.push([
        _safeStr(docSnap.id),
        _safeStr(d.name   || ''),
        _safeStr(d.type   || ''),
        _safeStr(d.brand || ''),
        _safeStr(d.color  || ''),
        _safeStr(d.unit   || ''),
        d.price  || 0,
        d.stock  || 0,
        threshold,
        status
      ]);
    });`;

const NEW = `    const rows = [
      ['ID', 'Name', 'Type', 'Brand', 'Color', 'Size', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']
    ];
    const dataRows = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const threshold = d.threshold ?? 5;

      if (d.has_colors && Array.isArray(d.variants) && d.variants.length > 0) {
        // Phase-27: one row per colour/size variant
        d.variants.forEach(v => {
          const variantStock = v.qty ?? 0;
          const status = variantStock < threshold ? 'Low Stock' : 'OK';
          dataRows.push([
            _safeStr(docSnap.id),
            _safeStr(d.name  || ''),
            _safeStr(d.type  || ''),
            _safeStr(d.brand || ''),
            _safeStr(v.color || ''),
            _safeStr(v.size  || ''),
            _safeStr(d.unit  || ''),
            d.price || 0,
            variantStock,
            threshold,
            status
          ]);
        });
      } else if (d.hasSizes && d.sizes && typeof d.sizes === 'object') {
        // Phase-13: one row per size entry
        Object.entries(d.sizes).forEach(([sizeKey, sv]) => {
          const sizeStock = sv.stock ?? 0;
          const status = sizeStock < threshold ? 'Low Stock' : 'OK';
          dataRows.push([
            _safeStr(docSnap.id),
            _safeStr(d.name  || ''),
            _safeStr(d.type  || ''),
            _safeStr(d.brand || ''),
            _safeStr(d.color || ''),
            _safeStr(sv.label || sizeKey || ''),
            _safeStr(d.unit  || ''),
            d.price || 0,
            sizeStock,
            threshold,
            status
          ]);
        });
      } else {
        // Flat item — single row, empty Size column
        const stock = Number(d.stock ?? 0);
        const status = stock < threshold ? 'Low Stock' : 'OK';
        dataRows.push([
          _safeStr(docSnap.id),
          _safeStr(d.name  || ''),
          _safeStr(d.type  || ''),
          _safeStr(d.brand || ''),
          _safeStr(d.color || ''),
          '',
          _safeStr(d.unit  || ''),
          d.price || 0,
          stock,
          threshold,
          status
        ]);
      }
    });`;

if (!src.includes(OLD)) {
  if (src.includes("'Size'")) {
    console.log('ALREADY patched. Size:', fs.statSync(filePath).size);
  } else {
    console.log('MISS - old pattern not found');
    process.exit(1);
  }
} else {
  const updated = src.replace(OLD, NEW);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log('PATCHED export.js. Size:', fs.statSync(filePath).size);
}
