// scripts/copy-pdf-worker.js
const fs = require('fs');
const path = require('path');

try {
  // resolución del worker dentro de node_modules
  const src = require.resolve('pdfjs-dist/build/pdf.worker.min.js');
  const destDir = path.join(__dirname, '..', 'public', 'assets');

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const dest = path.join(destDir, 'pdf.worker.min.js');
  fs.copyFileSync(src, dest);
  console.log('pdf.worker copied to', dest);
} catch (err) {
  console.error('Error copying pdf.worker:', err && err.message ? err.message : err);
  process.exit(1);
}
