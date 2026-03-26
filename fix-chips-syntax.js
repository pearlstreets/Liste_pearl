const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE, 'utf8');
let changed = false;

function fix(labelKey, handler, activeExpr){
  const re = new RegExp(
    String.raw`<Chip\s+label=\{t\('productsScreen\.strategies\.` + labelKey + String.raw`'\)\}[\s\S]*?\/>`,
    'm'
  );
  const replacement =
    `<Chip label={t('productsScreen.strategies.${labelKey}')}  active={${activeExpr}} onPress={()=>setStrategy('${handler}')} />`;
  if (re.test(s)) {
    s = s.replace(re, replacement);
    changed = true;
  }
}

// Remet la syntaxe propre pour chaque Chip
fix('balanced',   'balanced',   `strategy==='balanced'`);
fix('totalPrice', 'eco',        `strategy==='eco'`);
fix('time',       'fast',       `strategy==='fast'`);
fix('singleShop', 'single',     `strategy==='single'`);

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Chip JSX fixed.');
} else {
  console.log('No changes (patterns not found).');
}
