const fetch = global.fetch;

async function checkAllDates() {
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

  const headers = p[0];
  let dateColIdx = headers.findIndex(h => String(h).trim().toLowerCase() === 'date');
  let urlColIdx = headers.findIndex(h => String(h).trim().toLowerCase().includes('url'));

  const anomalies = [];
  for (let i = 1; i < p.length; i++) {
    const d = (p[i][dateColIdx] || '').trim();
    if (!/^\d{2}-\d{2}-\d{4}$/.test(d)) {
      anomalies.push({
        row: i + 1,
        dateVal: d,
        url: p[i][urlColIdx],
        postText: (p[i][16] || '').substring(0, 30)
      });
    }
  }

  console.log('Total non-standard dates found:', anomalies.length);
  console.log('Anomalies:', anomalies);
}

checkAllDates().catch(console.error);
