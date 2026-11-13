#!/usr/bin/env node
// Contrôle des photos générées : fichier lisible et non vide, taille raisonnable, 640x640, doublons exacts
// (même contenu) et quasi doublons (empreintes perceptuelles aHash et dHash 64 bits).
//
//   node scripts/menus-photos/controle.js <dossier-sortie> [options]
//
// Options :
//   --seuil N          distance de Hamming maximale d'un quasi doublon (défaut 6)
//   --regle et|ou      quasi doublon si dHash ET aHash <= seuil (défaut, peu de fausses alertes)
//                      ou si l'un des deux suffit (plus strict)
//   --existantes       compare aussi aux 344 photos livrées (assets/menus), exige sharp
//   --dimension N      côté attendu (défaut 640) ; --octets-min N (défaut 8000) ; --octets-max N (défaut 250000)
//   --liste f.json     liste à regénérer (défaut <sortie>/a-refaire.json), à passer à generer.js --refaire
//
// Dans une paire de quasi doublons, l'image gardée est la première par ordre d'identifiant ; l'autre est à refaire.
'use strict';
/* global __dirname */

const fs = require('fs');
const path = require('path');
const IMG = require('./images');

function lireArgs(argv) {
  const o = {
    sortie: null,
    seuil: 6,
    regle: 'et',
    existantes: false,
    dimension: 640,
    octetsMin: 8000,
    octetsMax: 250000,
    liste: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const suite = () => argv[++i];
    if (a === '--seuil') o.seuil = parseInt(suite(), 10);
    else if (a === '--regle') o.regle = suite() === 'ou' ? 'ou' : 'et';
    else if (a === '--existantes') o.existantes = true;
    else if (a === '--dimension') o.dimension = parseInt(suite(), 10);
    else if (a === '--octets-min') o.octetsMin = parseInt(suite(), 10);
    else if (a === '--octets-max') o.octetsMax = parseInt(suite(), 10);
    else if (a === '--liste') o.liste = suite();
    else if (a.startsWith('--')) throw new Error(`option inconnue : ${a}`);
    else o.sortie = a;
  }
  if (!o.sortie) throw new Error('usage : controle.js <dossier-sortie> [options]');
  return o;
}

/** Fichiers images d'un dossier de sortie : [{ id, type, fichier }]. */
function fichiersDe(sortie) {
  const out = [];
  for (const [sous, type] of [
    ['recettes', 'recette'],
    ['ingredients', 'ingredient'],
  ]) {
    const d = path.join(sortie, 'images', sous);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      const m = /^(.+)\.(webp|png)$/.exec(f);
      if (m) out.push({ id: m[1], type, fichier: path.join(d, f) });
    }
  }
  return out;
}

async function controler(o) {
  const sharp = IMG.chargerSharp();
  let etat = {};
  try {
    etat = JSON.parse(fs.readFileSync(path.join(o.sortie, 'etat.json'), 'utf8')).images || {};
  } catch (_e) {
    etat = {};
  }
  const fichiers = fichiersDe(o.sortie);
  const raisons = {}; // id -> [raison]
  const ajouter = (id, r) => (raisons[id] = raisons[id] || []).push(r);
  const valides = [];
  let sansEmpreinte = 0;

  for (const el of fichiers) {
    let buf;
    try {
      buf = fs.readFileSync(el.fichier);
    } catch (e) {
      ajouter(el.id, `illisible (${e.code || e.message})`);
      continue;
    }
    if (!buf.length) {
      ajouter(el.id, 'fichier vide');
      continue;
    }
    if (buf.length < o.octetsMin) ajouter(el.id, `trop petit (${buf.length} octets)`);
    if (buf.length > o.octetsMax) ajouter(el.id, `trop lourd (${buf.length} octets)`);
    const dim = IMG.dimensions(buf);
    if (!dim) {
      ajouter(el.id, 'format non reconnu');
      continue;
    }
    if (dim.largeur !== dim.hauteur || (dim.largeur !== o.dimension && dim.largeur !== 768))
      ajouter(
        el.id,
        `dimensions ${dim.largeur}x${dim.hauteur} au lieu de ${o.dimension}x${o.dimension}`
      );
    let emp = null;
    try {
      emp = await IMG.empreintes(buf, sharp);
    } catch (e) {
      ajouter(el.id, `image corrompue (${String(e.message).slice(0, 80)})`);
      continue;
    }
    if (!emp && etat[el.id] && etat[el.id].dhash)
      emp = { ahash: etat[el.id].ahash, dhash: etat[el.id].dhash };
    if (!emp) sansEmpreinte++;
    valides.push({ ...el, sha1: IMG.sha1(buf), emp });
  }

  // Doublons exacts
  const parSha = new Map();
  for (const v of valides) {
    const premier = parSha.get(v.sha1);
    if (premier) ajouter(v.id, `doublon exact de ${premier.id}`);
    else parSha.set(v.sha1, v);
  }

  // Quasi doublons (paires i<j, la seconde est à refaire)
  const avec = valides.filter((v) => v.emp);
  const A = avec.map((v) => IMG.versMots(v.emp.ahash));
  const D = avec.map((v) => IMG.versMots(v.emp.dhash));
  const paires = [];
  const proche = (da, dd) =>
    o.regle === 'ou' ? da <= o.seuil || dd <= o.seuil : da <= o.seuil && dd <= o.seuil;
  for (let i = 0; i < avec.length; i++) {
    for (let j = i + 1; j < avec.length; j++) {
      const dd = IMG.hamming(D[i], D[j]);
      if (o.regle === 'et' && dd > o.seuil) continue;
      const da = IMG.hamming(A[i], A[j]);
      if (!proche(da, dd)) continue;
      if (avec[i].sha1 === avec[j].sha1) continue; // déjà compté en doublon exact
      paires.push([avec[i].id, avec[j].id, da, dd]);
      ajouter(avec[j].id, `quasi doublon de ${avec[i].id} (aHash ${da}, dHash ${dd})`);
    }
  }

  // Comparaison aux photos livrées avec l'application
  let existantes = 0;
  if (o.existantes) {
    if (!sharp) throw new Error('--existantes exige sharp (npm i --no-save sharp)');
    const dir = path.resolve(__dirname, '..', '..', 'assets', 'menus');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.webp'))) {
      const e = await IMG.empreintes(fs.readFileSync(path.join(dir, f)), sharp);
      existantes++;
      const a = IMG.versMots(e.ahash);
      const d = IMG.versMots(e.dhash);
      for (let i = 0; i < avec.length; i++) {
        const dd = IMG.hamming(d, D[i]);
        const da = IMG.hamming(a, A[i]);
        if (proche(da, dd))
          ajouter(avec[i].id, `quasi doublon de la photo livrée ${f} (aHash ${da}, dHash ${dd})`);
      }
    }
  }

  const ids = Object.keys(raisons).sort();
  const essais = {};
  for (const id of ids) essais[id] = ((etat[id] && etat[id].essai) || 0) + 1;
  return {
    date: new Date().toISOString(),
    controles: fichiers.length,
    valides: fichiers.length - ids.length,
    sansEmpreinte,
    comparesExistantes: existantes,
    seuil: o.seuil,
    regle: o.regle,
    ids,
    essais,
    raisons,
    paires,
  };
}

async function main() {
  const o = lireArgs(process.argv.slice(2));
  const r = await controler(o);
  const f = o.liste || path.join(o.sortie, 'a-refaire.json');
  fs.writeFileSync(f, JSON.stringify(r, null, 1));
  console.log(
    `${r.controles} fichiers contrôlés, ${r.ids.length} à refaire, ${r.paires.length} paires de quasi doublons, ${r.sansEmpreinte} sans empreinte${r.sansEmpreinte ? ' (installez sharp pour les WebP)' : ''}.`
  );
  for (const id of r.ids.slice(0, 20)) console.log(`  ${id} : ${r.raisons[id].join(' ; ')}`);
  if (r.ids.length > 20) console.log(`  … ${r.ids.length - 20} autres`);
  console.log(`Liste : ${f} (node scripts/menus-photos/generer.js ${o.sortie} --refaire ${f})`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`Erreur : ${e.message}`);
    process.exitCode = 1;
  });
}

module.exports = { controler, fichiersDe, lireArgs };
