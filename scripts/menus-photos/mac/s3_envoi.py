#!/usr/bin/env python3
"""Envoi des photos de Pearl List dans le compartiment S3, SUR LE SERVEUR (lancé par envoyer.sh).

    python3 s3_envoi.py --dossier ~/list-menus-photos/v1 [--exclure refaire-liste.json] [--version 1]
                        [--env ~/Marketplace---Pearl-Streets/Backend/Marketplace/.env] [--a-blanc]

- Lit <dossier>/images/recettes/<id>.webp et <dossier>/images/ingredients/<clé>.webp.
- Clés : uploads/list-menus/v<N>/<id>.webp et uploads/list-menus/v<N>/ingredients/<clé>.webp.
- En-têtes : Content-Type image/webp, Cache-Control public, max-age=31536000, immutable.
- JAMAIS d'écrasement : head_object d'abord (clé présente = sautée), puis écriture conditionnelle
  If-None-Match: * quand la version de boto3 la connaît.
- Reprise : <dossier>/en-ligne.txt garde les clés déjà en ligne (« recettes/<id> », « ingredients/<clé> »).
- Identifiants AWS lus dans le .env Django du serveur, jamais affichés.
"""

import argparse
import json
import os
import struct
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

COMPARTIMENT = "markerplacemobileapp"
CACHE = "public, max-age=31536000, immutable"
COTE = 640


def lire_env(f):
    """KEY=VALUE d'un .env (guillemets retirés). Les valeurs ne sont jamais affichées."""
    out = {}
    for ligne in Path(f).read_text("utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        k, v = ligne.split("=", 1)
        k = k.strip()
        if k.startswith("export "):
            k = k[7:].strip()
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
            v = v[1:-1]
        out[k] = v
    return out


def dimensions_webp(b):
    """(largeur, hauteur) lues dans l'en-tête WebP, ou None."""
    if len(b) < 30 or b[0:4] != b"RIFF" or b[8:12] != b"WEBP":
        return None
    bloc = b[12:16]
    if bloc == b"VP8X":
        return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")
    if bloc == b"VP8 " and b[23:26] == b"\x9d\x01\x2a":
        w, h = struct.unpack("<HH", b[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if bloc == b"VP8L" and b[20] == 0x2F:
        v = int.from_bytes(b[21:25], "little")
        return 1 + (v & 0x3FFF), 1 + ((v >> 14) & 0x3FFF)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dossier", default="~/list-menus-photos/v1")
    ap.add_argument("--exclure", default=None, help="refaire-liste.json : identifiants à ne pas envoyer")
    ap.add_argument("--version", type=int, default=1)
    ap.add_argument("--env", default="~/Marketplace---Pearl-Streets/Backend/Marketplace/.env")
    ap.add_argument("--compartiment", default=COMPARTIMENT)
    ap.add_argument("--parallele", type=int, default=8)
    ap.add_argument("--a-blanc", action="store_true", help="liste ce qui partirait, sans rien envoyer")
    o = ap.parse_args()

    dossier = Path(os.path.expanduser(o.dossier))
    prefixe = f"uploads/list-menus/v{o.version}"
    exclus = set()
    if o.exclure and Path(os.path.expanduser(o.exclure)).exists():
        exclus = set(json.loads(Path(os.path.expanduser(o.exclure)).read_text("utf-8")).get("ids", []))

    f_ligne = dossier / "en-ligne.txt"
    en_ligne = set()
    if f_ligne.exists():
        en_ligne = {l.strip() for l in f_ligne.read_text("utf-8").splitlines() if l.strip()}

    travail, invalides, exclues = [], [], 0
    for sous in ("recettes", "ingredients"):
        d = dossier / "images" / sous
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.webp")):
            ident = f.stem
            local = f"{sous}/{ident}"
            if local in en_ligne:
                continue
            if ident in exclus:
                exclues += 1
                continue
            b = f.read_bytes()
            if len(b) < 8000 or dimensions_webp(b) not in ((640, 640), (768, 768)):
                invalides.append(local)
                continue
            cle = f"{prefixe}/{ident}.webp" if sous == "recettes" else f"{prefixe}/ingredients/{ident}.webp"
            travail.append((local, cle, f))

    print(
        f"{len(en_ligne)} déjà en ligne ; {len(travail)} à envoyer ; {exclues} exclues (à refaire) ; "
        f"{len(invalides)} invalides" + (f" ({', '.join(invalides[:5])}…)" if invalides else "")
    )
    if o.a_blanc or not travail:
        for local, cle, _ in travail[:10]:
            print(f"  {local} vers s3://{o.compartiment}/{cle}")
        return 0

    import boto3
    from botocore.exceptions import ClientError, ParamValidationError

    env = lire_env(os.path.expanduser(o.env))
    for k in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"):
        if not env.get(k):
            print(f"ERREUR : {k} absent du .env", file=sys.stderr)
            return 1
    s3 = boto3.client(
        "s3",
        aws_access_key_id=env["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=env["AWS_SECRET_ACCESS_KEY"],
        region_name=env.get("AWS_S3_REGION_NAME") or "us-east-1",
    )
    verrou = threading.Lock()
    compte = {"envoyees": 0, "presentes": 0, "erreurs": 0}
    sortie = open(f_ligne, "a", encoding="utf-8")
    conditionnel = {"ok": True}

    def noter(local, quoi):
        with verrou:
            compte[quoi] += 1
            sortie.write(local + "\n")
            sortie.flush()

    def un(t):
        local, cle, f = t
        try:
            s3.head_object(Bucket=o.compartiment, Key=cle)
            noter(local, "presentes")  # déjà là : jamais réécrite
            return
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code"))
            if code not in ("404", "NoSuchKey", "NotFound"):
                with verrou:
                    compte["erreurs"] += 1
                print(f"  ERREUR head {local} : {code}", file=sys.stderr)
                return
        args = dict(
            Bucket=o.compartiment,
            Key=cle,
            Body=f.read_bytes(),
            ContentType="image/webp",
            CacheControl=CACHE,
        )
        try:
            if conditionnel["ok"]:
                try:
                    s3.put_object(IfNoneMatch="*", **args)
                except ParamValidationError:
                    conditionnel["ok"] = False  # boto3 ancien : le head_object ci-dessus protège déjà
                    s3.put_object(**args)
            else:
                s3.put_object(**args)
            noter(local, "envoyees")
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code"))
            if code in ("PreconditionFailed", "412", "ConditionalRequestConflict"):
                noter(local, "presentes")
            else:
                with verrou:
                    compte["erreurs"] += 1
                print(f"  ERREUR put {local} : {code}", file=sys.stderr)

    with ThreadPoolExecutor(max_workers=max(1, o.parallele)) as ex:
        for i, _ in enumerate(ex.map(un, travail), 1):
            if i % 200 == 0:
                print(f"  {i}/{len(travail)} ({compte})", flush=True)
    sortie.close()
    print(f"Fini : {compte['envoyees']} envoyées, {compte['presentes']} déjà présentes, {compte['erreurs']} erreurs.")
    return 1 if compte["erreurs"] else 0


if __name__ == "__main__":
    sys.exit(main())
