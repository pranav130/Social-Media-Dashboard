const fs = require('fs');

async function inspectDiscomDistrictList() {
  const url = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=958127386';
  const res = await fetch(url);
  const text = await res.text();
  const rows = text.split('\n').map(r => r.split(',').map(c => c.trim())).filter(r => r.length >= 3 && r[0]);

  console.log('Headers:', rows[0]);
  const districts = [];
  const districtMap = {};

  for (let i = 1; i < rows.length; i++) {
    const discom = rows[i][0];
    const dist = rows[i][1];
    const zone = rows[i][2];
    districts.push(dist);
    districtMap[dist.toUpperCase()] = { discom, zone };
  }

  console.log('Total district rows:', districts.length);
  const uniqueDistricts = [...new Set(districts)];
  console.log('Unique districts:', uniqueDistricts.length);
  console.log('First 10 districts:', uniqueDistricts.slice(0, 10));
  console.log('Last 10 districts:', uniqueDistricts.slice(-10));
  
  // Check for any duplicate
  if (uniqueDistricts.length !== districts.length) {
    console.log('Duplicates found!');
  } else {
    console.log('All 75 districts are completely UNIQUE!');
  }
}

inspectDiscomDistrictList().catch(console.error);
