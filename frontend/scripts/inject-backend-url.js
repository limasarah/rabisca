const fs = require('fs');
const path = require('path');

const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://YOUR_BACKEND_URL_HERE';
const out = `window.__BACKEND_URL__ = "${backendUrl}";`;

const outPath = path.join(__dirname, '..', 'env.js');
fs.writeFileSync(outPath, out + '\n', 'utf8');
console.log('Generated', outPath, '->', backendUrl);
