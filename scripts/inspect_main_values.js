const fs = require('fs');

async function inspectMainSheetDistricts() {
  const url = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=598922870';
  const res = await fetch(url);
  const text = await res.text();
  const rows = text.split('\n').map(r => r.split(','));

  const headers = rows[0].map(h => h.trim());
  const distIdx = headers.findIndex(h => h.toLowerCase() === 'district');
  const discomIdx = headers.findIndex(h => h.toLowerCase() === 'discom');
  const zoneIdx = headers.findIndex(h => h.toLowerCase() === 'zone');
  const pickedIdx = headers.findIndex(h => h.toLowerCase().includes('picked'));
  const typeIdx = headers.findIndex(h => h.toLowerCase().includes('complaint type'));
  const headIdx = headers.findIndex(h => h.toLowerCase() === 'head');
  const untaggedIdx = headers.findIndex(h => h.toLowerCase().includes('untagged'));

  console.log('Column indices:', { distIdx, discomIdx, zoneIdx, pickedIdx, typeIdx, headIdx, untaggedIdx });

  const distCounts = {};
  const pickedCounts = {};
  const typeCounts = {};
  const headCounts = {};
  const untaggedCounts = {};

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;
    const dist = (r[distIdx] || '').trim();
    const picked = (r[pickedIdx] || '').trim();
    const type = (r[typeIdx] || '').trim();
    const head = (r[headIdx] || '').trim();
    const untagged = (r[untaggedIdx] || '').trim();

    distCounts[dist] = (distCounts[dist] || 0) + 1;
    pickedCounts[picked] = (pickedCounts[picked] || 0) + 1;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    headCounts[head] = (headCounts[head] || 0) + 1;
    untaggedCounts[untagged] = (untaggedCounts[untagged] || 0) + 1;
  }

  console.log('\nTop 15 Districts in main sheet:', Object.entries(distCounts).sort((a,b) => b[1] - a[1]).slice(0, 15));
  console.log('Picked Status counts:', pickedCounts);
  console.log('Head counts:', headCounts);
  console.log('Untagged counts:', untaggedCounts);
  console.log('Complaint Type counts (top 10):', Object.entries(typeCounts).sort((a,b) => b[1] - a[1]).slice(0, 10));
}

inspectMainSheetDistricts().catch(console.error);
