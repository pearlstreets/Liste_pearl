#!/usr/bin/env python3
"""Lit les plantages et les ANR d'une app Android, sans ouvrir la Play Console.

    python3 scripts/vitals-android.py               # 14 derniers jours
    python3 scripts/vitals-android.py --days 30
    python3 scripts/vitals-android.py --issues      # detail des plantages (stack traces)
    python3 scripts/vitals-android.py --app com.pearlstreets.appuser

Le paquet est devine depuis app.json (expo.android.package) : le script marche
tel quel dans les 4 projets, sans modification.

Deux pieges que ce script absorbe tout seul :
  - Les donnees Google ont un JOUR de retard. Demander aujourd'hui renvoie une
    erreur 400. La fenetre est donc bornee sur la "freshness" annoncee par l'API.
  - Zero ligne ne veut PAS dire zero plantage : en dessous d'un certain nombre
    d'utilisateurs actifs, Google n'agrege aucune statistique. Le script le dit
    explicitement au lieu de laisser croire que tout va bien.

Utilise la cle de service Play (gitignoree). Aucun secret n'est affiche.
Prerequis : API "Play Developer Reporting" activee sur le projet Cloud.
"""
import json, sys, time, os, urllib.request, urllib.parse, urllib.error
import jwt  # pyjwt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.path.join(ROOT, "google-play-service-account.json")
BASE = "https://playdeveloperreporting.googleapis.com/v1beta1"
SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting"

TOK = None
PKG = None


def default_pkg():
    """Paquet du projet courant, pour que le script soit portable entre projets.

    Deux sources, car elles ne coexistent pas : les projets Expo geres declarent
    expo.android.package dans app.json (Pearl List, Livraison), les projets RN
    bare portent applicationId dans build.gradle (AppUser, AppPro).
    Aucune valeur par defaut codee en dur : mieux vaut s'arreter que rapporter
    en silence les chiffres d'une autre app.
    """
    try:
        cfg = json.load(open(os.path.join(ROOT, "app.json")))
        return cfg["expo"]["android"]["package"]
    except Exception:
        pass
    gradle = os.path.join(ROOT, "android", "app", "build.gradle")
    if os.path.exists(gradle):
        for line in open(gradle, encoding="utf-8", errors="ignore"):
            line = line.strip()
            if line.startswith("applicationId"):
                return line.split('"')[1] if '"' in line else line.split("'")[1]
    sys.exit(f"Paquet Android introuvable depuis {ROOT}.\n"
             "Preciser explicitement : --app com.exemple.monapp")


def token():
    if not os.path.exists(KEY):
        sys.exit(f"Cle de service introuvable : {KEY}\n"
                 "Voir la memoire google-play-service-account-automation.")
    sa = json.load(open(KEY))
    now = int(time.time())
    claim = {"iss": sa["client_email"], "scope": SCOPE,
             "aud": "https://oauth2.googleapis.com/token",
             "iat": now, "exp": now + 3600}
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt.encode(claim, sa["private_key"], algorithm="RS256")}).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body)
    return json.load(urllib.request.urlopen(req))["access_token"]


def api(path, body=None, params=None):
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, data=(json.dumps(body).encode() if body is not None else None),
        method=("POST" if body is not None else "GET"))
    req.add_header("Authorization", "Bearer " + TOK)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        if e.code == 403 and "has not been used in project" in msg:
            sys.exit("L'API Play Developer Reporting est desactivee sur le projet Cloud.\n"
                     "Activer : https://console.developers.google.com/apis/api/"
                     "playdeveloperreporting.googleapis.com/overview")
        if e.code == 404:
            sys.exit(f"Paquet inconnu ou compte de service sans acces : {PKG}")
        sys.exit(f"Erreur Google {e.code} sur {path} :\n{msg[:400]}")


def freshness(metric_set):
    """Dernier jour pour lequel Google a des donnees. Sans ca, toute requete part en 400."""
    info = api(f"apps/{PKG}/{metric_set}").get("freshnessInfo", {})
    for f in info.get("freshnesses", []):
        if f.get("aggregationPeriod") == "DAILY":
            d = f.get("latestEndTime", {})
            if d:
                return d
    return None


def day_before(d, n):
    """Recule de n jours. Passe par l'epoch pour gerer les debuts de mois.

    Recopie l'heure et le fuseau de la borne d'origine : Google refuse un
    intervalle dont les deux bornes n'expriment pas le decalage de la meme facon.
    """
    t = time.gmtime(time.mktime((d["year"], d["month"], d["day"], 12, 0, 0, 0, 1, 0)) - n * 86400)
    out = {k: v for k, v in d.items() if k not in ("year", "month", "day")}
    out.update({"year": t.tm_year, "month": t.tm_mon, "day": t.tm_mday})
    return out


def query(metric_set, metrics, start, end, dims=("versionCode",)):
    return api(f"apps/{PKG}/{metric_set}:query", body={
        "timelineSpec": {"aggregationPeriod": "DAILY",
                         "startTime": start, "endTime": end},
        "metrics": list(metrics), "dimensions": list(dims)})


def num(v):
    """Une valeur de metrique arrive en decimalValue ou en int64Value selon la metrique."""
    if not isinstance(v, dict):
        return None
    for k in ("decimalValue", "int64Value", "doubleValue"):
        if k in v:
            raw = v[k]
            return float(raw["value"] if isinstance(raw, dict) else raw)
    return None


def collect(rows):
    """Agrege les lignes journalieres par versionCode : pire taux et total utilisateurs."""
    out = {}
    for row in rows:
        vc = "?"
        for d in row.get("dimensions", []):
            if d.get("dimension") == "versionCode":
                vc = d.get("int64Value") or d.get("stringValue") or "?"
        e = out.setdefault(str(vc), {"jours": 0})
        e["jours"] += 1
        for m in row.get("metrics", []):
            n = num(m)
            if n is None:
                continue
            name = m.get("metric")
            if name == "distinctUsers":
                e["users"] = max(e.get("users", 0), n)
            else:
                e[name] = max(e.get(name, 0.0), n)
    return out


def rate_line(label, data, key):
    if not data:
        print(f"  {label:<22} aucune donnee")
        return
    for vc, e in sorted(data.items(), key=lambda kv: -int(kv[0]) if kv[0].isdigit() else 0):
        pct = e.get(key)
        users = e.get("users")
        val = f"{pct * 100:.2f} %" if pct is not None else "n/d"
        u = f"  ({int(users)} utilisateur(s) actif(s))" if users else ""
        print(f"  {label:<22} vc={vc:<5} {val}{u}")


def issues(start, end, limit=10):
    """Les plantages reels, groupes par cause, avec l'extrait de pile."""
    params = {"pageSize": limit, "orderBy": "distinctUsers desc"}
    for bound, d in (("startTime", start), ("endTime", end)):
        params[f"interval.{bound}.year"] = d["year"]
        params[f"interval.{bound}.month"] = d["month"]
        params[f"interval.{bound}.day"] = d["day"]
        params[f"interval.{bound}.hours"] = 0
        params[f"interval.{bound}.timeZone.id"] = "UTC"
    res = api(f"apps/{PKG}/errorIssues:search", params=params)
    found = res.get("errorIssues", [])
    if not found:
        print("  Aucun plantage remonte sur la periode.")
        return
    for i, it in enumerate(found, 1):
        kind = it.get("type", "?")
        users = it.get("distinctUsers", "?")
        cause = (it.get("cause") or "").strip() or "(cause non fournie)"
        loc = (it.get("location") or "").strip()
        print(f"\n  {i}. [{kind}] {users} utilisateur(s) touche(s)")
        print(f"     {cause[:160]}")
        if loc:
            print(f"     -> {loc[:160]}")


def main():
    global TOK, PKG
    args = sys.argv[1:]
    days = 14
    want_issues = "--issues" in args
    PKG = None
    if "--days" in args:
        days = int(args[args.index("--days") + 1])
    if "--app" in args:
        PKG = args[args.index("--app") + 1]
    PKG = PKG or default_pkg()

    TOK = token()

    end = freshness("crashRateMetricSet")
    if not end:
        sys.exit("Google n'annonce aucune donnee pour cette app "
                 "(app jamais publiee, ou aucun utilisateur).")
    start = day_before(end, days)

    print(f"=== Plantages et ANR : {PKG} ===")
    print(f"Periode : {start['year']}-{start['month']:02d}-{start['day']:02d}"
          f" -> {end['year']}-{end['month']:02d}-{end['day']:02d}"
          f"   (Google s'arrete la : les donnees ont ~1 jour de retard)\n")

    crash = collect(query("crashRateMetricSet", ["crashRate", "distinctUsers"], start, end).get("rows", []))
    anr = collect(query("anrRateMetricSet", ["anrRate"], start, end).get("rows", []))

    rate_line("Taux de plantage", crash, "crashRate")
    rate_line("Taux d'ANR", anr, "anrRate")

    if not crash and not anr:
        print("\n  Zero ligne ne signifie PAS zero plantage : en dessous d'un certain")
        print("  nombre d'utilisateurs actifs, Google n'agrege aucune statistique.")
        print("  Verifier le nombre d'installations avant d'en conclure quoi que ce soit.")

    print("\n=== Plantages remontes ===" if want_issues else
          "\n(--issues pour le detail des plantages avec les piles d'appel)")
    if want_issues:
        issues(start, end)


if __name__ == "__main__":
    main()
