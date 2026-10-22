const fs = require('fs');

const content = fs.readFileSync('google_apps_script/Code.gs', 'utf8');
const lines = content.split('\n');

function findOccurrences(term) {
  console.log('\n=== Matches for: ' + term + ' ===');
  lines.forEach((l, idx) => {
    if (l.toLowerCase().includes(term.toLowerCase())) {
      console.log('L' + (idx + 1) + ': ' + l.trim().substring(0, 110));
    }
  });
}

findOccurrences('runCloudSyncCycle');
findOccurrences('classifyTweetInScript');
findOccurrences('syncFromWorkingSheet');
findOccurrences('onEdit');
findOccurrences('installed');
findOccurrences('trigger');
findOccurrences('validation');
findOccurrences('setDataValidation');
findOccurrences('District');
findOccurrences('DISCOM');
findOccurrences('Zone');
findOccurrences('appendRow');
findOccurrences('setValues');
