const fs = require('fs');

const SPREADSHEET_ID = '10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY';
const gids = [
  '598922870',
  '1577546662',
  '433560792',
  '958127386',
  '225403350',
  '491149208'
];

async function checkGids() {
  for (const gid of gids) {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        console.log(`\n=== GID: ${gid} ===`);
        console.log(`Total non-empty lines: ${lines.length}`);
        console.log(`Row 1: ${lines[0] ? lines[0].substring(0, 150) : '(empty)'}`);
        if (lines.length > 1) {
          console.log(`Row 2: ${lines[1].substring(0, 150)}`);
        }
        if (lines.length > 2) {
          console.log(`Row 3: ${lines[2].substring(0, 150)}`);
        }
        // Save first few lines to a file for examination
        fs.writeFileSync(`scripts/gid_${gid}.csv`, lines.slice(0, 50).join('\n'));
      } else {
        console.log(`GID: ${gid} returned HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`Error for GID ${gid}:`, e.message);
    }
  }
}

checkGids().catch(console.error);
