const fs = require('fs');

const text = fs.readFileSync('scripts/htmlview.html', 'utf8');

// Search for tab names and associated gids in htmlview
const matches = [...text.matchAll(/gid[=:]"?(\d+)"?[^>]*>([^<]+)</g)];
console.log('Matches with text:');
matches.forEach(m => console.log(`GID: ${m[1]} -> Text: ${m[2]}`));

// Also search for sheet tab elements or JSON in htmlview
const scriptMatches = [...text.matchAll(/item\s*=\s*\{[^}]+\}/g)];
console.log('Script item matches count:', scriptMatches.length);

const gids = ['598922870', '1577546662', '433560792', '958127386', '225403350', '491149208'];
for (const gid of gids) {
  const idx = text.indexOf(gid);
  if (idx !== -1) {
    console.log(`\nContext around GID ${gid}:`);
    console.log(text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 200)));
  }
}
