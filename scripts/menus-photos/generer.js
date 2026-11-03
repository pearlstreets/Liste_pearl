#!/usr/bin/env node
// Génère une photo IA par recette sans photo (ou par ingrédient), dans un dossier HORS du dépôt.
//
//   node scripts/menus-photos/generer.js <dossier-sortie> [options]
//
// Options :
//   --a-blanc            n'appelle pas l'API : écrit les prompts dans <sortie>/prompts-a-blanc.json
//                        (forcé tant que la variable OPENAI_API_KEY est absente)
//   --ingredients        les 317 ingrédients au lieu des recettes ; --tout : recettes puis ingrédients
//   --echantillon N      N éléments répartis sur toute la liste (toutes les familles)
//   --ids a,b,c          seulement ces identifiants
//   --refaire f.json     liste produite par controle.js : ancienne image rangée dans <sortie>/rejetees,
//                        prompt décalé (autre variation), puis regénération
//   --parallele N        requêtes simultanées (défaut 6)
//   --budget D           arrêt propre avant de dépasser D dollars sur ce lancement
//   --prix P             prix d'une image en dollars (défaut 0.011, gpt-image-1-mini medium 1024)
//   --modele M --qualite Q --taille T   (défauts gpt-image-1-mini, medium, 1024x1024)
//
// Reprise : une image déjà présente (<sortie>/images/<recettes|ingredients>/<id>.webp, non vide) est sautée.
// Arrêt propre : Ctrl+C, ou créer le fichier <sortie>/STOP ; les requêtes en cours se terminent, l'état
// est enregistré (<sortie>/etat.json). Un second Ctrl+C quitte aussitôt.
'use strict';
/* global Buffer */

const fs = require('fs');
const os = require('os');
const path = require('path');
const donnees = require('./donnees');
const P = require('./prompts');
const IMG = require('./images');

const API = 'https://api.openai.com/v1/images/generations';
const DUREE_IMAGE_S = 20; // gpt-image-1-mini, qualité medium : 15 à 25 s par image constatées en général

/* ------------------------------------------------------------------ arguments */

function lireArgs(argv) {
  const o = {
    sortie: null,
    aBlanc: false,
    quoi: 'recettes',
    echantillon: 0,
    ids: null,
    refaire: null,
    parallele: 6,
    budget: Infinity,
    prix: 0.011,
    modele: 'gpt-image-1-mini',
    qualite: 'medium',
    taille: '1024x1024',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const suite = () => {
      if (i + 1 >= argv.length) throw new Error(`valeur manquante après ${a}`);
      return argv[++i];
    };
    if (a === '--a-blanc') o.aBlanc = true;
    else if (a === '--ingredients') o.quoi = 'ingredients';
    else if (a === '--tout') o.quoi = 'tout';
    else if (a === '--echantillon') o.echantillon = Math.max(0, parseInt(suite(), 10) || 0);
    else if (a === '--ids')
      o.ids = suite()
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === '--refaire') o.refaire = suite();
    else if (a === '--parallele')
      o.parallele = Math.max(1, Math.min(32, parseInt(suite(), 10) || 6));
    else if (a === '--budget') o.budget = Number(suite());
    else if (a === '--prix') o.prix = Number(suite());
    else if (a === '--modele') o.modele = suite();
    else if (a === '--qualite') o.qualite = suite();
    else if (a === '--taille') o.taille = suite();
    else if (a.startsWith('--')) throw new Error(`option inconnue : ${a}`);
    else if (!o.sortie) o.sortie = a;
    else throw new Error(`argument en trop : ${a}`);
  }
  return o;
}

/* ------------------------------------------------------------------ liste de travail */

function echantillonner(liste, n) {
  if (!n || n >= liste.length) return liste;
  const out = [];
  for (let i = 0; i < n; i++) out.push(liste[Math.floor((i * liste.length) / n)]);
  return out;
}

const dossierImages = (sortie, type) =>
  path.join(sortie, 'images', type === 'ingredient' ? 'ingredients' : 'recettes');
const fichierImage = (sortie, el) => path.join(dossierImages(sortie, el.type), `${el.id}.webp`);

function dejaFaite(f) {
  try {
    return fs.statSync(f).size > 0;
  } catch (_e) {
    return false;
  }
}

/** Liste complète (rangs de famille calculés sur TOUT le catalogue, pour des variations stables). */
function listeTravail(o) {
  const ctx = P.contexte(donnees);
  let elems = [];
  if (o.quoi !== 'ingredients') elems = elems.concat(donnees.recettesSansPhoto());
  if (o.quoi !== 'recettes') elems = elems.concat(donnees.ingredientsTous());
  const essais = {};
  if (o.refaire) {
    const r = JSON.parse(fs.readFileSync(o.refaire, 'utf8'));
    for (const id of r.ids || []) essais[id] = (r.essais && r.essais[id]) || 1;
  }
  const prompts = P.construirePrompts(elems, ctx, essais);
  for (const p of prompts) p.essai = essais[p.id] || 0;
  let travail = prompts;
  if (o.refaire) travail = travail.filter((p) => essais[p.id]);
  if (o.ids) {
    const s = new Set(o.ids);
    travail = travail.filter((p) => s.has(p.id));
  }
  travail = echantillonner(travail, o.echantillon);
  return { tous: prompts, travail, essais };
}

/* ------------------------------------------------------------------ état */

function lireEtat(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_e) {
    return { version: 1, images: {}, erreurs: {}, coutTotal: 0 };
  }
}
function ecrireEtat(f, etat) {
  fs.writeFileSync(`${f}.tmp`, JSON.stringify(etat));
  fs.renameSync(`${f}.tmp`, f);
}

/* ------------------------------------------------------------------ appel API */

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function delaiRetry(h) {
  const ms = Number(h.get('retry-after-ms'));
  if (ms > 0) return ms;
  const s = Number(h.get('retry-after'));
  if (s > 0) return s * 1000;
  const reset = h.get('x-ratelimit-reset-requests') || h.get('x-ratelimit-reset-tokens');
  const m = reset && /^(?:(\d+)m)?(?:([\d.]+)s)?(?:(\d+)ms)?$/.exec(reset);
  if (m) return ((+m[1] || 0) * 60 + (+m[2] || 0)) * 1000 + (+m[3] || 0) || 10000;
  return 10000;
}

class ErreurDefinitive extends Error {}
class ErreurArret extends Error {}

/** Une image : renvoie { octets (Buffer de l'API), usage }. Respecte 429 (pause partagée) et 5xx. */
async function appeler(o, cle, prompt, partage) {
  for (let essai = 1; essai <= 8; essai++) {
    const pause = partage.pauseJusqua - Date.now();
    if (pause > 0) await attendre(pause);
    if (partage.arret === 'immediat') throw new ErreurArret('arrêt');
    let rep;
    try {
      rep = await fetch(API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: o.modele,
          prompt,
          size: o.taille,
          quality: o.qualite,
          n: 1,
          output_format: 'webp',
          output_compression: 95,
        }),
        signal: AbortSignal.timeout(180000),
      });
    } catch (_e) {
      await attendre(Math.min(60000, 2000 * 2 ** essai));
      continue; // réseau, délai dépassé
    }
    if (rep.status === 429) {
      const ms = delaiRetry(rep.headers);
      const corps = await rep.text();
      if (/insufficient_quota|billing/i.test(corps))
        throw new ErreurArret(`quota épuisé : ${corps.slice(0, 200)}`);
      partage.pauseJusqua = Math.max(partage.pauseJusqua, Date.now() + ms);
      partage.n429++;
      continue;
    }
    if (rep.status === 401 || rep.status === 403)
      throw new ErreurArret(`accès refusé (${rep.status})`);
    if (rep.status >= 500) {
      await attendre(Math.min(60000, 2000 * 2 ** essai));
      continue;
    }
    const corps = await rep.json().catch(() => null);
    if (!rep.ok) throw new ErreurDefinitive(`${rep.status} ${JSON.stringify(corps).slice(0, 300)}`);
    const b64 = corps && corps.data && corps.data[0] && corps.data[0].b64_json;
    if (!b64) throw new ErreurDefinitive('réponse sans image');
    return { octets: Buffer.from(b64, 'base64'), usage: corps.usage || null };
  }
  throw new ErreurDefinitive('8 essais sans succès');
}

/* ------------------------------------------------------------------ à blanc */

function statsPrompts(prompts) {
  const longueurs = prompts.map((p) => p.prompt.length);
  const somme = longueurs.reduce((a, b) => a + b, 0);
  return {
    nombre: prompts.length,
    uniques: new Set(prompts.map((p) => p.prompt)).size,
    longueurMoyenne: prompts.length ? Math.round(somme / prompts.length) : 0,
    longueurMin: prompts.length ? Math.min(...longueurs) : 0,
    longueurMax: prompts.length ? Math.max(...longueurs) : 0,
  };
}

function estimation(n, o) {
  const cout = n * o.prix;
  const heures = (n * DUREE_IMAGE_S) / o.parallele / 3600;
  return `${n} images x ${o.prix} $ = ${cout.toFixed(2)} $ ; durée ≈ ${heures.toFixed(1)} h à ${o.parallele} en parallèle (≈ ${DUREE_IMAGE_S} s par image, hors limites de débit du compte)`;
}

/* ------------------------------------------------------------------ principal */

async function main() {
  const o = lireArgs(process.argv.slice(2));
  const cle = process.env.OPENAI_API_KEY;
  if (!o.aBlanc && !cle) {
    console.log('OPENAI_API_KEY absente : passage à blanc (aucun appel à l’API).');
    o.aBlanc = true;
  }
  if (!o.sortie) {
    if (!o.aBlanc) throw new Error('dossier de sortie obligatoire (hors du dépôt)');
    o.sortie = path.join(os.tmpdir(), 'pearl-list-photos');
  }
  o.sortie = path.resolve(o.sortie);
  const rel = path.relative(donnees.RACINE, o.sortie);
  if (!rel.startsWith('..') && !path.isAbsolute(rel))
    throw new Error(`le dossier de sortie doit être HORS du dépôt (${o.sortie})`);
  fs.mkdirSync(o.sortie, { recursive: true });

  const { tous, travail } = listeTravail(o);
  const restants = travail.filter((p) => !dejaFaite(fichierImage(o.sortie, p)) || o.refaire);
  const nRec = travail.filter((p) => p.type === 'recette').length;
  const nIng = travail.length - nRec;
  console.log(
    `Liste : ${travail.length} (${nRec} recettes, ${nIng} ingrédients) ; déjà faites : ${travail.length - restants.length} ; à faire : ${restants.length}`
  );
  console.log(`Estimation : ${estimation(restants.length, o)}`);

  if (o.aBlanc) {
    const f = path.join(o.sortie, 'prompts-a-blanc.json');
    fs.writeFileSync(f, JSON.stringify(travail, null, 1));
    const st = statsPrompts(travail);
    const stTous = statsPrompts(tous);
    console.log(`À blanc : ${f}`);
    console.log(`  ce lancement : ${JSON.stringify(st)}`);
    console.log(`  catalogue complet : ${JSON.stringify(stTous)}`);
    const fam = {};
    for (const p of travail) fam[p.famille] = (fam[p.famille] || 0) + 1;
    console.log(`  familles : ${JSON.stringify(fam)}`);
    if (st.uniques !== st.nombre || stTous.uniques !== stTous.nombre) {
      console.error('ERREUR : prompts identiques détectés');
      process.exitCode = 1;
    }
    return;
  }

  const sharp = IMG.chargerSharp();
  if (!sharp)
    throw new Error(
      'sharp absent : installez-le sans toucher package.json (npm i --no-save sharp) ; sinon convertissez ensuite avec cwebp -q 80 -resize 640 640'
    );

  const fEtat = path.join(o.sortie, 'etat.json');
  const etat = lireEtat(fEtat);
  etat.modele = o.modele;
  etat.qualite = o.qualite;
  etat.taille = o.taille;
  for (const t of ['recette', 'ingredient'])
    fs.mkdirSync(dossierImages(o.sortie, t), { recursive: true });
  const fStop = path.join(o.sortie, 'STOP');

  const partage = { pauseJusqua: 0, arret: null, n429: 0 };
  let sigint = 0;
  const surSignal = () => {
    sigint++;
    partage.arret = sigint > 1 ? 'immediat' : 'propre';
    console.log(
      sigint > 1 ? '\nArrêt immédiat.' : '\nArrêt propre demandé : fin des requêtes en cours…'
    );
    if (sigint > 1) {
      ecrireEtat(fEtat, etat);
      process.exit(130);
    }
  };
  process.on('SIGINT', surSignal);
  process.on('SIGTERM', surSignal);

  let cout = 0;
  let faites = 0;
  let enCours = 0;
  let erreurs = 0;
  const debut = Date.now();
  let i = 0;

  const ouvrier = async () => {
    while (i < restants.length) {
      if (partage.arret) return;
      if (fs.existsSync(fStop)) {
        partage.arret = 'propre';
        return;
      }
      if (cout + (enCours + 1) * o.prix > o.budget) {
        partage.arret = 'propre';
        console.log(`Budget de ${o.budget} $ atteint.`);
        return;
      }
      const el = restants[i++];
      const f = fichierImage(o.sortie, el);
      if (o.refaire && dejaFaite(f)) {
        const rej = path.join(o.sortie, 'rejetees');
        fs.mkdirSync(rej, { recursive: true });
        fs.renameSync(f, path.join(rej, `${el.id}.${Date.now()}.webp`));
      } else if (dejaFaite(f)) continue;
      enCours++;
      try {
        const { octets, usage } = await appeler(o, cle, el.prompt, partage);
        const webp = await IMG.versWebp640(octets, sharp);
        const emp = await IMG.empreintes(webp, sharp);
        fs.writeFileSync(`${f}.part`, webp);
        fs.renameSync(`${f}.part`, f);
        cout += o.prix;
        etat.coutTotal = Math.round(((etat.coutTotal || 0) + o.prix) * 1000) / 1000;
        etat.images[el.id] = {
          type: el.type,
          octets: webp.length,
          ...emp,
          sha1: IMG.sha1(webp),
          prompt: el.prompt,
          essai: el.essai,
          usage,
          date: new Date().toISOString(),
        };
        delete etat.erreurs[el.id];
        faites++;
      } catch (e) {
        if (e instanceof ErreurArret) {
          partage.arret = 'propre';
          console.error(`Arrêt : ${e.message}`);
        } else {
          erreurs++;
          etat.erreurs[el.id] = {
            message: String(e.message).slice(0, 300),
            date: new Date().toISOString(),
          };
        }
      } finally {
        enCours--;
      }
      if ((faites + erreurs) % 20 === 0) {
        ecrireEtat(fEtat, etat);
        const ecoule = (Date.now() - debut) / 1000;
        const rythme = faites / Math.max(1, ecoule); // images par seconde
        const reste = restants.length - i;
        console.log(
          `${faites} faites, ${erreurs} erreurs, ${reste} restantes ; coût ${cout.toFixed(2)} $ (total ${etat.coutTotal} $) ; ${(rythme * 60).toFixed(1)} img/min ; fin ≈ ${rythme ? (reste / rythme / 3600).toFixed(1) : '?'} h ; 429 : ${partage.n429}`
        );
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(o.parallele, restants.length) }, ouvrier));
  ecrireEtat(fEtat, etat);
  console.log(
    `Fini${partage.arret ? ' (arrêt propre)' : ''} : ${faites} images, ${erreurs} erreurs, coût de ce lancement ${cout.toFixed(2)} $, total ${etat.coutTotal} $. État : ${fEtat}`
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error(`Erreur : ${e.message}`);
    process.exitCode = 1;
  });
}

module.exports = { lireArgs, listeTravail, echantillonner, delaiRetry, statsPrompts, estimation };
