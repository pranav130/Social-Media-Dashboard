const fetch = global.fetch;

async function inspectRow2() {
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

  const row1 = p[0];
  const row2 = p[1];
  const row3 = p[2];

  console.log('Row 1 (Header) length:', row1.length);
  console.log('Row 2 length:', row2 ? row2.length : 0);
  console.log('Row 2 non-empty values:', row2 ? row2.filter(c => c.trim() !== '') : 'none');
  console.log('Row 3 sample:', row3 ? row3.slice(0, 10) : 'none');
}

inspectRow2().catch(console.error);
