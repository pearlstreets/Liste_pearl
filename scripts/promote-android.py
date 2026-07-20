#!/usr/bin/env python3
"""Promeut la derniere version de la piste `internal` vers `production`.

Deploiement PROGRESSIF par defaut : la version ne part pas d'un coup chez tous
les utilisateurs. On peut ainsi surveiller les plantages et stopper net si
besoin, au lieu de decouvrir un probleme quand tout le parc l'a deja recu.

    python3 scripts/promote-android.py            # 20 % des utilisateurs
    python3 scripts/promote-android.py 50         # 50 %
    python3 scripts/promote-android.py 100        # tout le monde
    python3 scripts/promote-android.py --status   # etat des pistes, sans rien changer
    python3 scripts/promote-android.py --halt     # stoppe un deploiement en cours

Utilise la cle de service Play (gitignoree). Aucun secret n'est affiche.
"""
import json, sys, time, os, urllib.request, urllib.parse
import jwt  # pyjwt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.path.join(ROOT, "google-play-service-account.json")
PKG = "com.pearlstreets.list"
BASE = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PKG}"


def token():
    if not os.path.exists(KEY):
        sys.exit(f"Cle de service introuvable : {KEY}\n"
                 "Voir la memoire google-play-service-account-automation.")
    sa = json.load(open(KEY))
    now = int(time.time())
    claim = {"iss": sa["client_email"],
             "scope": "https://www.googleapis.com/auth/androidpublisher",
             "aud": "https://oauth2.googleapis.com/token",
             "iat": now, "exp": now + 3600}
    assertion = jwt.encode(claim, sa["private_key"], algorithm="RS256")
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion}).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body)
    return json.load(urllib.request.urlopen(req))["access_token"]


TOK = None


def api(path, method="GET", body=None):
    req = urllib.request.Request(f"{BASE}/{path}",
                                 data=(json.dumps(body).encode() if body is not None else None),
                                 method=method)
    req.add_header("Authorization", "Bearer " + TOK)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        sys.exit(f"Erreur Google Play {e.code} sur {path} :\n{e.read().decode()[:500]}")


def tracks(eid):
    return {t["track"]: t for t in api(f"edits/{eid}/tracks").get("tracks", [])}


def show(ts):
    for name in ("internal", "alpha", "beta", "production"):
        t = ts.get(name)
        if not t:
            continue
        for rel in t.get("releases", []):
            frac = rel.get("userFraction")
            part = f" — {round(frac * 100)} % des utilisateurs" if frac else ""
            print(f"  {name:<11} {rel.get('status'):<10} vc={rel.get('versionCodes')} "
                  f"nom={rel.get('name')}{part}")


def main():
    global TOK
    TOK = token()
    arg = sys.argv[1] if len(sys.argv) > 1 else "20"

    eid = api("edits", "POST")["id"]
    ts = tracks(eid)

    if arg == "--status":
        print(f"=== Pistes {PKG} ===")
        show(ts)
        return

    if arg == "--halt":
        prod = ts.get("production", {})
        rel = next((r for r in prod.get("releases", []) if r.get("status") == "inProgress"), None)
        if not rel:
            print("Aucun deploiement en cours a stopper.")
            return
        rel["status"] = "halted"
        api(f"edits/{eid}/tracks/production", "PUT", {"track": "production", "releases": [rel]})
        api(f"edits/{eid}:commit", "POST")
        print(f"Deploiement STOPPE (vc={rel.get('versionCodes')}). "
              "Les utilisateurs qui ne l'ont pas encore recu ne le recevront plus.")
        return

    try:
        pct = float(arg)
        assert 0 < pct <= 100
    except Exception:
        sys.exit("Pourcentage attendu entre 1 et 100, ou --status / --halt.")

    src = ts.get("internal")
    if not src or not src.get("releases"):
        sys.exit("Aucune version sur la piste internal a promouvoir.")
    rel = max(src["releases"], key=lambda r: max(int(v) for v in r.get("versionCodes", [0])))
    vcs, name = rel["versionCodes"], rel.get("name")

    prod_rel = {"versionCodes": vcs, "name": name,
                "releaseNotes": rel.get("releaseNotes", [])}
    if pct >= 100:
        prod_rel["status"] = "completed"
    else:
        prod_rel["status"] = "inProgress"
        prod_rel["userFraction"] = round(pct / 100, 4)

    api(f"edits/{eid}/tracks/production", "PUT",
        {"track": "production", "releases": [prod_rel]})
    api(f"edits/{eid}:commit", "POST")

    cible = "tous les utilisateurs" if pct >= 100 else f"{round(pct)} % des utilisateurs"
    print(f"Promue en production : vc={vcs} ({name}) -> {cible}")

    eid2 = api("edits", "POST")["id"]
    print("=== etat apres promotion ===")
    show(tracks(eid2))


if __name__ == "__main__":
    main()
