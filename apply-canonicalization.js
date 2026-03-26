const fs = require("fs");
const file = "App.js";
let s = fs.readFileSync(file, "utf8");

if (!s.includes('utils/spellcheck')) {
  s = 'import { autocorrectName } from "./utils/spellcheck";\n' + s;
}

const start = s.indexOf("function parseMulti(input)");
if (start < 0) {
  console.error("parseMulti not found");
  process.exit(1);
}
let end = s.indexOf("\nfunction ", start + 1);
if (end < 0) end = s.length;

const newFunc = `function parseMulti(input){
  const str = (input || "").trim();
  if (!str) return [];
  const parts = str.split(/[\\n,;]+/).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    let m, name = null, qty = 1;
    if (m = part.match(/^(\\d+)\\s+(.+)$/)) { name = m[2].trim(); qty = Math.max(1, parseInt(m[1], 10)); }
    else if (m = part.match(/^(.+?)\\s*[xX]\\s*(\\d+)$/)) { name = m[1].trim(); qty = Math.max(1, parseInt(m[2], 10)); }
    else if (m = part.match(/^(.+?)\\s*(\\d+)\\s*[xX]?$/)) { const n = m[1].trim(); const q = parseInt(m[2], 10); if (n) { name = n; qty = Math.max(1, q); } }
    else { name = part; qty = 1; }
    name = autocorrectName(name);
    out.push({ name, qty });
  }
  return out;
}
`;

s = s.slice(0, start) + newFunc + s.slice(end);
fs.writeFileSync(file, s);
console.log("Canonicalization enabled in parseMulti");
