const fs = require('fs');

function checkWrites(filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const lines = content.split('\n');
  console.log('\n=== Checking writes in ' + filename + ' ===');
  lines.forEach((l, idx) => {
    if (/update|post|append|write|patch|sheets\.spreadsheets/i.test(l)) {
      if (l.includes('sheets') || l.includes('google') || l.includes('sync')) {
        console.log('L' + (idx + 1) + ': ' + l.trim().substring(0, 110));
      }
    }
  });
}

checkWrites('google_sheets_service.js');
checkWrites('server.js');
checkWrites('sheets-sync.js');
