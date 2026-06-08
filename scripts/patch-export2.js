const fs = require('fs');
const filePath = 'modules/export.js';
const src = fs.readFileSync(filePath, 'utf8');

// File uses CRLF
const CR = '\r';
const EOL = '\r\n';

// Build old block using actual CRLF
const oldLines = [
  "    const rows = [",
  "      ['ID', 'Name', 'Type', 'brand', 'Color', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']",
  "    ];",
  "    const dataRows = [];",
  "    snap.forEach(docSnap => {",
  "      const d = docSnap.data();",
  "      const threshold = d.threshold ?? 5;",
  "      const status    = d.stock < threshold ? 'Low Stock' : 'OK';",
  "      dataRows.push([",
  "        _safeStr(docSnap.id),",
  "        _safeStr(d.name   || ''),",
  "        _safeStr(d.type   || ''),",
  "        _safeStr(d.brand || ''),",
  "        _safeStr(d.color  || ''),",
  "        _safeStr(d.unit   || ''),",
  "        d.price  || 0,",
  "        d.stock  || 0,",
  "        threshold,",
  "        status",
  "      ]);",
  "    });"
];

const newLines = [
  "    const rows = [",
  "      ['ID', 'Name', 'Type', 'Brand', 'Color', 'Size', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']",
  "    ];",
  "    const dataRows = [];",
  "    snap.forEach(docSnap => {",
  "      const d = docSnap.data();",
  "      const threshold = d.threshold ?? 5;",
  "",
  "      if (d.has_colors && Array.isArray(d.variants) && d.variants.length > 0) {",
  "        // Phase-27: one row per colour/size variant",
  "        d.variants.forEach(v => {",
  "          const variantStock = v.qty ?? 0;",
  "          const vStatus = variantStock < threshold ? 'Low Stock' : 'OK';",
  "          dataRows.push([",
  "            _safeStr(docSnap.id),",
  "            _safeStr(d.name  || ''),",
  "            _safeStr(d.type  || ''),",
  "            _safeStr(d.brand || ''),",
  "            _safeStr(v.color || ''),",
  "            _safeStr(v.size  || ''),",
  "            _safeStr(d.unit  || ''),",
  "            d.price || 0,",
  "            variantStock,",
  "            threshold,",
  "            vStatus",
  "          ]);",
  "        });",
  "      } else if (d.hasSizes && d.sizes && typeof d.sizes === 'object') {",
  "        // Phase-13: one row per size entry",
  "        Object.entries(d.sizes).forEach(([sizeKey, sv]) => {",
  "          const sizeStock = sv.stock ?? 0;",
  "          const sStatus = sizeStock < threshold ? 'Low Stock' : 'OK';",
  "          dataRows.push([",
  "            _safeStr(docSnap.id),",
  "            _safeStr(d.name  || ''),",
  "            _safeStr(d.type  || ''),",
  "            _safeStr(d.brand || ''),",
  "            _safeStr(d.color || ''),",
  "            _safeStr(sv.label || sizeKey || ''),",
  "            _safeStr(d.unit  || ''),",
  "            d.price || 0,",
  "            sizeStock,",
  "            threshold,",
  "            sStatus",
  "          ]);",
  "        });",
  "      } else {",
  "        // Flat item — single row, empty Size column",
  "        const stock = Number(d.stock ?? 0);",
  "        const fStatus = stock < threshold ? 'Low Stock' : 'OK';",
  "        dataRows.push([",
  "          _safeStr(docSnap.id),",
  "          _safeStr(d.name  || ''),",
  "          _safeStr(d.type  || ''),",
  "          _safeStr(d.brand || ''),",
  "          _safeStr(d.color || ''),",
  "          '',",
  "          _safeStr(d.unit  || ''),",
  "          d.price || 0,",
  "          stock,",
  "          threshold,",
  "          fStatus",
  "        ]);",
  "      }",
  "    });"
];

const OLD = oldLines.join(EOL);
const NEW = newLines.join(EOL);

if (!src.includes(OLD)) {
  if (src.includes("'Size'") && src.includes('has_colors')) {
    console.log('ALREADY patched. Size:', fs.statSync(filePath).size);
    process.exit(0);
  }
  console.log('MISS - old pattern not found');
  // Debug: check if header line is present
  const headerLine = "      ['ID', 'Name', 'Type', 'brand', 'Color', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']";
  console.log('Header found (no CRLF):', src.includes(headerLine));
  console.log('Header found (with CRLF):', src.includes(headerLine + '\r'));
  process.exit(1);
}

const updated = src.replace(OLD, NEW);
fs.writeFileSync(filePath, updated, 'utf8');
console.log('PATCHED export.js. Size:', fs.statSync(filePath).size);
