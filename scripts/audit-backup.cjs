const fs = require('fs');
const crypto = require('crypto');
const F = require('../src/phase0.js');
const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/audit-backup.cjs <archivo.json>');
  process.exitCode = 1;
} else {
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.length > F.MAX_BYTES) throw new Error('El archivo supera 10 MB.');
    const data = F.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
    console.log(JSON.stringify({sha256:crypto.createHash('sha256').update(bytes).digest('hex'),schemaVersion:data.schemaVersion,summary:F.summary(data)},null,2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
