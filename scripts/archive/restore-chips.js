const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE, 'utf8');

function revertChip(labelKey, handler) {
  const re = new RegExp(`(<Chip[^>]*label=\\{t\\('productsScreen\\.strategies\\.${labelKey}'\\)\\}[^>]*?)onPress=\\{[\\s\\S]*?\\}([^>]*\\/>)`, 'm');
  if (re.test(s)) {
    s = s.replace(re, `$1onPress={()=>${handler}}$2`);
  }
}

revertChip('balanced',   "setStrategy('balanced')");
revertChip('totalPrice', "setStrategy('eco')");
revertChip('time',       "setStrategy('fast')");
revertChip('singleShop', "setStrategy('single')");

fs.writeFileSync(FILE, s);
console.log('Chips reverted to original handlers.');
