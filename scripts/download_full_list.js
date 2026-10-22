const fs = require('fs');

async function downloadFullDiscomDistrictList() {
  const url = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=958127386';
  const res = await fetch(url);
  const text = await res.text();
  fs.writeFileSync('scripts/gid_958127386.csv', text);
  console.log('Saved complete Discom_District_List, lines:', text.split('\n').filter(l => l.trim()).length);
}

downloadFullDiscomDistrictList().catch(console.error);
