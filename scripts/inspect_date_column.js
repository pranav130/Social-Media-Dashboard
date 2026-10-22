const fetch = global.fetch;

async function inspectDateCol() {
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

  console.log('Total rows in sheet:', p.length);
  const headers = p[0];
  console.log('Headers:', headers.slice(0, 10));

  // Find DATE column index
  let dateColIdx = -1;
  headers.forEach((h, i) => {
    if (String(h).trim().toLowerCase() === 'date') dateColIdx = i;
  });
  console.log('DATE column index:', dateColIdx);

  const formatCounts = {};
  const sampleValues = [];
  const uniqueValues = new Map();
  
  for (let r = 1; r < p.length; r++) {
    const val = p[r][dateColIdx] !== undefined ? p[r][dateColIdx] : '';
    const trimmed = String(val).trim();
    let fmt = 'EMPTY';
    if (!trimmed) fmt = 'EMPTY';
    else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) fmt = 'YYYY-MM-DD';
    else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) fmt = 'DD-MM-YYYY or DD/MM/YYYY';
    else if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(trimmed)) fmt = 'D-M-YY variations';
    else if (/^\d{4,5}$/.test(trimmed)) fmt = 'EXCEL_SERIAL';
    else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed)) fmt = 'YYYY-MM-DD HH:mm';
    else fmt = 'OTHER: ' + trimmed.substring(0, 20);

    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
    uniqueValues.set(trimmed, (uniqueValues.get(trimmed) || 0) + 1);

    if (r <= 25 || r >= p.length - 25) {
      sampleValues.push({ row: r + 1, raw: val, trimmed, fmt });
    }
  }

  console.log('Format counts across all rows:', formatCounts);
  console.log('Unique date values count:', uniqueValues.size);
  console.log('Top 20 most frequent date values:', Array.from(uniqueValues.entries()).slice(0, 20));
  console.log('First 15 sample rows in sheet:');
  console.log(sampleValues.slice(0, 15));
  console.log('Last 15 sample rows in sheet:');
  console.log(sampleValues.slice(-15));
}

inspectDateCol().catch(console.error);
