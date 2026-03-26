const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE, 'utf8');
let changed = false;

// 1) Corriger la parenthèse en trop dans l'objet retourné
s = s.replace(
  /__renderItems:\s*\(Array\.isArray\(assigned\)\s*&&\s*assigned\.length>0\s*\?\s*assigned\s*:\s*user\)\)/g,
  '__renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user)'
) || s;

// 2) Par sécurité, si une variante d'espaces existe
s = s.replace(
  /__renderItems:\s*\(\s*Array\.isArray\s*\(\s*assigned\s*\)\s*&&\s*assigned\.length\s*>\s*0\s*\?\s*assigned\s*:\s*user\s*\)\)/g,
  '__renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user)'
) || s;

fs.writeFileSync(FILE, s);
console.log('Parenthèse corrigée dans le mapping des shops.');
