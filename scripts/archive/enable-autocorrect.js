const fs = require('fs');
const file = 'App.js';
let s = fs.readFileSync(file,'utf8');

const start = s.indexOf('function ListScreen');
if (start < 0) { console.error('ListScreen not found'); process.exit(1); }
let end = s.indexOf('\nfunction ', start + 1);
if (end < 0) end = s.length;

let region = s.slice(start, end);
if (!/autoCorrect=/.test(region)) {
  region = region.replace('<TextInput', '<TextInput autoCorrect={true} spellCheck={true} autoCapitalize="none"');
  s = s.slice(0, start) + region + s.slice(end);
  fs.writeFileSync(file, s);
  console.log('Auto-correct enabled on ListScreen TextInput');
} else {
  console.log('Auto-correct already enabled, no changes made');
}
