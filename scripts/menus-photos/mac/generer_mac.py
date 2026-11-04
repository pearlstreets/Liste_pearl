#!/usr/bin/env python3
"""Photos des recettes et des ingrédients, générées GRATUITEMENT sur le Mac (Apple Silicon).

Modèle libre FLUX.1-schnell (Apache 2.0) via mflux (MLX), version 4 bits de mflux-community.
Aucun appel payant, aucune clé : tout tourne en local.

    ~/pearl-photos/venv/bin/python scripts/menus-photos/mac/generer_mac.py [options]

Options :
  --echantillon N        N images d'essai (recettes écrites à la main, ingrédients, familles variées)
  --ids a,b,c            seulement ces identifiants
  --prompts f.json       liste de prompts (défaut ~/pearl-photos/prompts.json, faite par prompts.sh)
  --refaire              l'image existante est rangée dans ~/pearl-photos/rejetees/ puis refaite
                         (avec --prompts ~/pearl-photos/prompts-refaire.json, voir refaire.sh)
  --taille 640|768       taille générée (défaut 640) ; 768 est réduite à 640
  --etapes N             étapes de débruitage (défaut 4)
  --modele CHEMIN        dossier du modèle (défaut ~/pearl-photos/modele/flux-1-schnell-mflux-q4)
  --envoyer-tous N       lance envoyer.sh en arrière-plan toutes les N nouvelles images (0 = jamais)
  --nice N               priorité basse (défaut 10)
  --avec-pc              travaille en même temps que le PC : les plats d'abord (recettes
                         générées en partant de la FIN), les ingrédients à la fin ; saute ce qui est en ligne
                         (manifeste CloudFront relu toutes les 20 images)
  --racine D             dossier de travail (défaut ~/pearl-photos)
  --preparer-refaire     ne génère rien : lit a-refaire.json (controle.js) et en-ligne.txt, écrit
                         refaire-liste.json (une image déjà en ligne n'est jamais remplacée : on refait
                         plutôt l'autre image de la paire si elle n'est pas en ligne)

Sortie : ~/pearl-photos/images/{recettes,ingredients}/<id>.webp (WebP 640x640 qualité 92).
Reprise : une image déjà présente est sautée. Arrêt propre : créer ~/pearl-photos/STOP, ou Ctrl+C
(l'image en cours se termine). Journal : ~/pearl-photos/journal.log ; état : ~/pearl-photos/etat.json.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from collections import OrderedDict, deque
from datetime import datetime, timezone
from pathlib import Path

ICI = Path(__file__).resolve().parent
COTE = 640
MODELE_DEFAUT = "~/pearl-photos/modele/flux-1-schnell-mflux-q4"

# --------------------------------------------------------------------------- prompts pour FLUX

RE_REFERENCE = re.compile(r"\s*Reference [^.]*\(internal identifier, never shown in the image\)\.\s*$")
RE_INTERDITS = re.compile(r"\s*No text, no letters,[^.]*\.")


def prompt_flux(prompt):
    """Adapte un prompt de prompts.js à FLUX.1-schnell.

    - La phrase « Reference <id> » est retirée : FLUX sait écrire du texte et pourrait l'imprimer dans
      l'image ; l'unicité vient de la seed propre à chaque identifiant.
    - La longue liste « No text, no letters… » est raccourcie : schnell n'a pas de prompt négatif et lit
      au plus 256 jetons ; la fin d'un prompt trop long serait coupée.
    """
    p = RE_REFERENCE.sub("", prompt)
    p = RE_INTERDITS.sub(" No text, no logos, no hands, no people.", p)
    return re.sub(r"\s+", " ", p).strip()


def seed_de(ident, essai=0):
    """Seed déterministe dérivée de l'identifiant (et du n° d'essai pour une image refaite)."""
    h = hashlib.sha256(f"pearl-list|{ident}|{essai}".encode("utf-8")).hexdigest()
    return int(h[:8], 16) % 2147483647


# --------------------------------------------------------------------------- ordre de travail


def est_main(p):
    return p["type"] == "recette" and not p["id"].startswith("g-")


def ordonner(prompts):
    """130 recettes écrites à la main, puis les ingrédients, puis les générées par famille entremêlée."""
    main = [p for p in prompts if est_main(p)]
    ingr = [p for p in prompts if p["type"] == "ingredient"]
    familles = OrderedDict()
    for p in prompts:
        if p["type"] == "recette" and p["id"].startswith("g-"):
            familles.setdefault(p["famille"], deque()).append(p)
    gen = []
    while familles:
        for f in list(familles):
            gen.append(familles[f].popleft())
            if not familles[f]:
                del familles[f]
    return main + ingr + gen


def ordre_avec_pc(ordre):
    """Le PC fait les recettes à la main puis les générées dans l'ordre, puis les ingrédients :
    le Mac fait les plats d'abord (générées depuis la fin), les ingrédients en dernier ;
    le Mac prend l'autre bout pour que les deux ne se croisent qu'à la fin."""
    main = [p for p in ordre if est_main(p)]
    ingr = [p for p in ordre if p["type"] == "ingredient"]
    gen = [p for p in ordre if p["type"] == "recette" and not est_main(p)]
    return gen[::-1] + main + ingr


MANIFESTE_URL = "https://d24hrna6wu3lb7.cloudfront.net/uploads/list-menus/manifeste.json"
B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"


def en_ligne():
    """Ensemble des identifiants qui ont déjà une photo en ligne (même lecture que lib/menus/photoManifest.js).
    En cas d'échec réseau : None, et rien n'est sauté."""
    import urllib.request

    try:
        with urllib.request.urlopen(MANIFESTE_URL, timeout=20) as r:
            m = json.loads(r.read().decode("utf-8"))
    except Exception:
        return None
    ids = set(m.get("recettes") or []) | set(m.get("ingredients") or [])
    gen = m.get("gen") or ""
    gen_n = m.get("genN") or len(gen) * 6
    for i, c in enumerate(gen):
        v = B64.find(c)
        for k in range(6):
            r = i * 6 + k
            if v > 0 and r < gen_n and (v >> k) & 1:
                ids.add("g-" + base36(r))
    return ids


def base36(n):
    chiffres = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while True:
        n, k = divmod(n, 36)
        out = chiffres[k] + out
        if n == 0:
            return out


def echantillon(ordre, n):
    """Environ 20 % de recettes à la main, 15 % d'ingrédients, le reste des familles toutes différentes."""
    main = [p for p in ordre if est_main(p)]
    ingr = [p for p in ordre if p["type"] == "ingredient"]
    gen = [p for p in ordre if p["type"] == "recette" and not est_main(p)]

    def reparti(liste, k):
        if k <= 0 or not liste:
            return []
        k = min(k, len(liste))
        return [liste[(i * len(liste)) // k] for i in range(k)]

    n_main = max(1, round(n * 0.2))
    n_ingr = max(1, round(n * 0.15))
    n_gen = max(0, n - n_main - n_ingr)
    return reparti(main, n_main) + reparti(ingr, n_ingr) + gen[:n_gen]


# --------------------------------------------------------------------------- empreintes (comme images.js)


def _hex(bits):
    return "".join(
        format((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3], "x")
        for i in range(0, 64, 4)
    )


def empreintes(img):
    """aHash et dHash 64 bits, même codage que images.js (secours de controle.js sans sharp)."""
    from PIL import Image

    g = img.convert("L")
    p8 = list(g.resize((8, 8), Image.BOX).getdata())
    m = sum(p8) / 64.0
    a = _hex([1 if v > m else 0 for v in p8])
    p9 = list(g.resize((9, 8), Image.BOX).getdata())
    d = _hex([1 if p9[y * 9 + x] > p9[y * 9 + x + 1] else 0 for y in range(8) for x in range(8)])
    return a, d


def vers_webp(img, qualite=92):
    """Image PIL vers octets WebP COTExCOTE (recadrage centré si besoin)."""
    import io

    from PIL import Image

    img = img.convert("RGB")
    w, h = img.size
    if w != h:
        c = min(w, h)
        img = img.crop(((w - c) // 2, (h - c) // 2, (w - c) // 2 + c, (h - c) // 2 + c))
    if img.size != (COTE, COTE):
        img = img.resize((COTE, COTE), Image.LANCZOS)
    b = io.BytesIO()
    img.save(b, format="WEBP", quality=qualite, method=5)
    return b.getvalue(), img


# --------------------------------------------------------------------------- fichiers et état


def dossier_type(racine, typ):
    return racine / "images" / ("ingredients" if typ == "ingredient" else "recettes")


def fichier_image(racine, p):
    return dossier_type(racine, p["type"]) / f"{p['id']}.webp"


def lire_json(f, defaut):
    try:
        return json.loads(Path(f).read_text("utf-8"))
    except (OSError, ValueError):
        return defaut


def ecrire_json(f, data):
    f = Path(f)
    tmp = f.with_suffix(f.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    os.replace(tmp, f)


class Journal:
    def __init__(self, f):
        self.f = open(f, "a", encoding="utf-8")

    def __call__(self, msg):
        ligne = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
        print(ligne, flush=True)
        self.f.write(ligne + "\n")
        self.f.flush()


def duree(s):
    s = int(s)
    j, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, _ = divmod(s, 60)
    return f"{j} j {h} h {m:02d} min" if j else f"{h} h {m:02d} min"


# --------------------------------------------------------------------------- préparation du refaire


def lire_en_ligne(racine):
    """Ensemble des « recettes/<id> » et « ingredients/<id> » déjà dans le compartiment."""
    f = racine / "en-ligne.txt"
    if not f.exists():
        return set()
    return {l.strip() for l in f.read_text("utf-8").splitlines() if l.strip()}


def cle_locale(racine, ident):
    if (racine / "images" / "ingredients" / f"{ident}.webp").exists():
        return f"ingredients/{ident}"
    return f"recettes/{ident}"


def preparer_refaire(racine):
    """a-refaire.json (controle.js) + en-ligne.txt : écrit refaire-liste.json { ids, essais, notes }."""
    a = lire_json(racine / "a-refaire.json", None)
    if a is None:
        raise SystemExit("a-refaire.json absent : lancez d'abord controle.js (voir refaire.sh)")
    etat = lire_json(racine / "etat.json", {}).get("images", {})
    en_ligne = lire_en_ligne(racine)
    garde_de = {}  # image signalée : images gardées de ses paires
    for p in a.get("paires", []):
        garde_de.setdefault(p[1], []).append(p[0])
    ids, essais, notes = [], {}, {}

    def ajouter(i, essai, note):
        if i in essais:
            return
        ids.append(i)
        essais[i] = essai
        notes[i] = note

    for i in a.get("ids", []):
        if cle_locale(racine, i) not in en_ligne:
            ajouter(i, a.get("essais", {}).get(i, 1), "; ".join(a.get("raisons", {}).get(i, [])))
            continue
        # déjà en ligne : jamais remplacée en v1 ; on refait l'autre image de la paire si possible
        for g in garde_de.get(i, []):
            if cle_locale(racine, g) not in en_ligne:
                ajouter(g, (etat.get(g, {}).get("essai") or 0) + 1, f"quasi doublon de {i} (déjà en ligne)")
        if i not in notes:
            notes[i] = "déjà en ligne, gardée (v1 n'écrase jamais)"
    out = {"date": datetime.now(timezone.utc).isoformat(), "ids": ids, "essais": essais, "notes": notes}
    ecrire_json(racine / "refaire-liste.json", out)
    print(f"refaire-liste.json : {len(ids)} images à refaire (sur {len(a.get('ids', []))} signalées).")
    return out


# --------------------------------------------------------------------------- génération


def charger_modele(chemin):
    from mflux.models.common.config import ModelConfig
    from mflux.models.flux.variants.txt2img.flux import Flux1

    # Même résolution que « mflux-generate --model <chemin> --base-model schnell » : les poids
    # pré-quantifiés (4 bits) portent leur quantification, aucun --quantize à passer.
    cfg = ModelConfig.from_name(model_name=chemin, base_model="schnell")
    return Flux1(model_config=cfg, quantize=None, model_path=chemin)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--racine", default="~/pearl-photos")
    ap.add_argument("--prompts", default=None)
    ap.add_argument("--echantillon", type=int, default=0)
    ap.add_argument("--ids", default=None)
    ap.add_argument("--refaire", action="store_true")
    ap.add_argument("--taille", type=int, default=640, choices=[640, 768])
    ap.add_argument("--etapes", type=int, default=4)
    ap.add_argument("--modele", default=MODELE_DEFAUT)
    ap.add_argument("--envoyer-tous", type=int, default=0)
    ap.add_argument("--nice", type=int, default=10)
    ap.add_argument("--avec-pc", action="store_true")
    ap.add_argument("--preparer-refaire", action="store_true")
    ap.add_argument("--a-blanc", action="store_true", help="liste et ordre seulement, sans modèle")
    o = ap.parse_args()

    racine = Path(os.path.expanduser(o.racine))
    racine.mkdir(parents=True, exist_ok=True)
    if o.preparer_refaire:
        preparer_refaire(racine)
        return 0

    fp = Path(os.path.expanduser(o.prompts)) if o.prompts else racine / "prompts.json"
    prompts = lire_json(fp, None)
    if not prompts:
        raise SystemExit(f"{fp} absent ou vide : lancez d'abord scripts/menus-photos/mac/prompts.sh")
    ordre = ordonner(prompts)
    if o.avec_pc:
        ordre = ordre_avec_pc(ordre)
    if o.ids:
        voulus = {s.strip() for s in o.ids.split(",") if s.strip()}
        ordre = [p for p in ordre if p["id"] in voulus]
    if o.echantillon:
        ordre = echantillon(ordre, o.echantillon)
    restants = [p for p in ordre if o.refaire or not fichier_image(racine, p).exists()]
    deja = en_ligne() if o.avec_pc else None
    if deja:
        restants = [p for p in restants if p["id"] not in deja]
    print(f"Liste : {len(ordre)} ; déjà faites : {len(ordre) - len(restants)} ; à faire : {len(restants)}")
    if o.a_blanc:
        for p in restants[:30]:
            print(f"  {p['type']:10} {p['famille']:16} {p['id']:32} seed {seed_de(p['id'], p.get('essai', 0))}")
        exemple = restants[0] if restants else None
        if exemple:
            print(f"Prompt FLUX ({len(prompt_flux(exemple['prompt']).split())} mots) : {prompt_flux(exemple['prompt'])}")
        return 0
    if not restants:
        print("Rien à faire.")
        return 0

    # Priorité basse (les builds launchd des sites passent devant) et pas de mise en veille.
    try:
        os.nice(o.nice)
    except OSError:
        pass
    if shutil.which("caffeinate"):
        subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])

    for t in ("recette", "ingredient"):
        dossier_type(racine, t).mkdir(parents=True, exist_ok=True)
    journal = Journal(racine / "journal.log")
    f_etat = racine / "etat.json"
    etat = lire_json(f_etat, {"version": 1, "images": {}, "erreurs": {}})
    etat.setdefault("images", {})
    etat.setdefault("erreurs", {})
    etat["modele"] = o.modele
    f_stop = racine / "STOP"
    arret = {"demande": False}

    def sur_signal(_s, _f):
        if arret["demande"]:
            ecrire_json(f_etat, etat)
            sys.exit(130)
        arret["demande"] = True
        journal("Arrêt propre demandé : fin de l'image en cours…")

    signal.signal(signal.SIGINT, sur_signal)
    signal.signal(signal.SIGTERM, sur_signal)

    modele = os.path.expanduser(o.modele)
    journal(f"Chargement du modèle {modele} …")
    t0 = time.time()
    flux = charger_modele(modele)
    journal(f"Modèle prêt en {time.time() - t0:.0f} s. {len(restants)} images à faire, {o.etapes} étapes, {o.taille}px.")

    envoi = None
    faites = erreurs = suite_erreurs = depuis_envoi = 0
    durees = deque(maxlen=50)
    debut = time.time()
    for n, p in enumerate(restants, 1):
        if arret["demande"] or f_stop.exists():
            journal("Arrêt propre (fichier STOP ou signal).")
            break
        f = fichier_image(racine, p)
        essai = int(p.get("essai") or 0)
        if o.refaire and f.exists():
            rej = racine / "rejetees"
            rej.mkdir(exist_ok=True)
            f.rename(rej / f"{p['id']}.{int(time.time())}.webp")
        elif f.exists():
            continue
        if o.avec_pc:
            if n % 20 == 0:
                deja = en_ligne() or deja
            if deja and p["id"] in deja:
                continue
        seed = seed_de(p["id"], essai)
        t1 = time.time()
        try:
            res = flux.generate_image(
                seed=seed,
                prompt=prompt_flux(p["prompt"]),
                num_inference_steps=o.etapes,
                width=o.taille,
                height=o.taille,
            )
            octets, img = vers_webp(res.image)
            part = f.with_name(f.name + ".part")
            part.write_bytes(octets)
            os.replace(part, f)
            ah, dh = empreintes(img)
            etat["images"][p["id"]] = {
                "type": p["type"],
                "famille": p["famille"],
                "octets": len(octets),
                "ahash": ah,
                "dhash": dh,
                "sha1": hashlib.sha1(octets).hexdigest(),
                "seed": seed,
                "essai": essai,
                "etapes": o.etapes,
                "taille": o.taille,
                "secondes": round(time.time() - t1, 1),
                "date": datetime.now(timezone.utc).isoformat(),
            }
            etat["erreurs"].pop(p["id"], None)
            faites += 1
            depuis_envoi += 1
            suite_erreurs = 0
            durees.append(time.time() - t1)
        except Exception as e:  # une image ratée ne bloque pas la suite
            erreurs += 1
            suite_erreurs += 1
            etat["erreurs"][p["id"]] = {"message": str(e)[:300], "date": datetime.now(timezone.utc).isoformat()}
            journal(f"ERREUR {p['id']} : {str(e)[:200]}")
            if suite_erreurs >= 5:
                journal("5 erreurs de suite : arrêt.")
                break
        if faites % 10 == 0 or n == len(restants):
            ecrire_json(f_etat, etat)
        moyenne = sum(durees) / len(durees) if durees else 0
        reste = len(restants) - n
        journal(
            f"{n}/{len(restants)} {p['id']} ({p['famille']}) {time.time() - t1:.1f} s ; "
            f"moyenne {moyenne:.1f} s ; {faites} faites, {erreurs} erreurs ; fin dans ≈ {duree(reste * moyenne)}"
        )
        if o.envoyer_tous and depuis_envoi >= o.envoyer_tous and (envoi is None or envoi.poll() is not None):
            journal("Envoi d'un lot vers le serveur (arrière-plan, journal envoi.log)…")
            log = open(racine / "envoi.log", "a", encoding="utf-8")
            envoi = subprocess.Popen(["bash", str(ICI / "envoyer.sh")], stdout=log, stderr=subprocess.STDOUT)
            depuis_envoi = 0
    ecrire_json(f_etat, etat)
    journal(f"Fini : {faites} images en {duree(time.time() - debut)}, {erreurs} erreurs. État : {f_etat}")
    if envoi is not None and envoi.poll() is None:
        journal("Attente de la fin de l'envoi en cours…")
        envoi.wait()
    return 0


if __name__ == "__main__":
    sys.exit(main())
