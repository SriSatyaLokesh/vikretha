const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'modules', 'billing.js');
let src = fs.readFileSync(filePath, 'utf8');

const oldStr = '${item.color ? `';
const newStr = '${(!item.has_colors && item.color) ? `';

if (src.includes(oldStr)) {
  src = src.replace(oldStr, newStr);
  fs.writeFileSync(filePath, src, 'utf8');
  console.log('PATCHED color badge. Size:', fs.statSync(filePath).size);
} else if (src.includes(newStr)) {
  console.log('ALREADY patched. Size:', fs.statSync(filePath).size);
} else {
  console.log('MISS - color badge pattern not found');
  process.exit(1);
}
