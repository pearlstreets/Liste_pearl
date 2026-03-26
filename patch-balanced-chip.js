const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE,'utf8');
let changed = false;

// Remplace onPress du chip "balanced" pour appeler aussi setStrategy('balanced')
const re = /<Chip\s+label=\{t\('productsScreen\.strategies\.balanced'\)\}[^>]*onPress=\{\(\)\s*=>\s*\{\s*setOptimized\(\s*false\s*\);\s*\}\}\s*\/>/;
if (re.test(s)) {
  s = s.replace(re, `<Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>{ setOptimized(false); setStrategy('balanced'); }} />`);
  changed = true;
} else {
  // Variante avec espaces différents
  const re2 = /<Chip\s+label=\{t\('productsScreen\.strategies\.balanced'\)\}[\s\S]*?onPress=\{\(\)\s*=>\s*\{\s*setOptimized\(\s*false\s*\);\s*\}\}\s*\/>/m;
  if (re2.test(s)) {
    s = s.replace(re2, `<Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>{ setOptimized(false); setStrategy('balanced'); }} />`);
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Chip Équilibré corrigé: setStrategy("balanced") ajouté.');
} else {
  console.log('Chip Équilibré déjà correct ou pattern différent.');
}
