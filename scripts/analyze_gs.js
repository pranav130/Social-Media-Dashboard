const fs = require('fs');

const content = fs.readFileSync('google_apps_script/Code.gs', 'utf8');
const lines = content.split('\n');
console.log('Total lines in Code.gs:', lines.length);

console.log('\n--- Functions matching onEdit, trigger, dropdown, district, validation, setup ---');
lines.forEach((l, idx) => {
  if (/function\s+\w+/i.test(l)) {
    console.log(`Line ${idx + 1}: ${l.trim()}`);
  }
});
