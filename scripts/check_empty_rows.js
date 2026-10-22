const fetch = global.fetch;

async function checkEmptyRows() {
  const url = 'https://docs.google.com/spreadsheets/d/10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY/export?format=csv&gid=598922870';
  const res = await fetch(url);
  const text = await res.text();
  
  // parse csv
  let p = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      p.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') p.push(row);

  console.log('Total parsed rows:', p.length);
  const headers = p[0];
  let dateColIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'date');

  p.forEach((r, idx) => {
    if (idx > 0 && (!r[dateColIdx] || !r[dateColIdx].trim())) {
      console.log(`Sheet Row ${idx + 1}:`, r.slice(0, 10));
    }
  });
}

checkEmptyRows().catch(console.error);
