#!/usr/bin/env python3
"""Lit les plantages et les ANR des apps Android, sans ouvrir la Play Console.

    python3 scripts/vitals-android.py               # app du projet courant, 14 j
    python3 scripts/vitals-android.py --all         # les 4 apps d'un coup
    python3 scripts/vitals-android.py --days 30
    python3 scripts/vitals-android.py --issues      # detail des plantages
    python3 scripts/vitals-android.py --app com.exemple.app

Le paquet est devine depuis app.json (projets Expo) ou build.gradle (projets RN
bare) : le script marche tel quel dans les 4 projets, sans modification.

Ce que ce script refuse de faire, parce que ce sont les facons de se tromper :
  - Comparer le PIRE JOUR au seuil Google. Google evalue sur une fenetre
    agregee ; un jour creux fait exploser un taux sans que l'app soit en faute.
    Le verdict porte donc sur la moyenne ponderee par les utilisateurs, et le
    pire jour est montre a cote, comme information, sans verdict.
  - Melanger des jours sur une meme ligne. Le taux et le nombre d'utilisateurs
    affiches viennent du meme jour, date a l'appui.
  - Ecrire "ok" quand une metrique manque : une conformite non verifiee n'est
    pas une conformite.
  - Ecrire "aucun plantage" quand il n'y a pas de donnees. En dessous d'un
    certain nombre d'utilisateurs actifs, Google n'agrege rien du tout.

Utilise la cle de service Play (gitignoree). Aucun secret n'est affiche.
Prerequis : API "Play Developer Reporting" activee sur le projet Cloud.
"""
import datetime, json, sys, time, os, urllib.request, urllib.parse, urllib.error
import jwt  # pyjwt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = os.path.join(ROOT, "google-play-service-account.json")
BASE = "https://playdeveloperreporting.googleapis.com/v1beta1"
SCOPE = "https://www.googleapis.com/auth/playdeveloperreporting"

# Toutes les apps du compte developpeur. La cle de service porte une permission
# de NIVEAU COMPTE : un seul fichier de cle suffit pour les interroger toutes.
APPS = [
    ("Pearl List", "com.pearlstreets.list"),
    ("AppUser", "com.marketplace.users"),
    ("AppPro", "com.pearlstreets.professional"),
    ("Livraison", "com.pearlstreets.delivery"),
]

# Seuils "mauvais comportement" de Google Play, verifies dans la documentation
# officielle : au-dela, la visibilite de l'app dans le store baisse. Ce sont des
# taux PERCUS PAR L'UTILISATEUR, evalues sur une fenetre agregee.
SEUIL = {"crash": 0.0109, "anr": 0.0047}  # 1,09 % et 0,47 %

TOK = None


class PlayError(Exception):
    """Erreur d'API non fatale : une app ou un jeu de metriques en echec ne doit
    jamais faire perdre ce qui a ete lu avec succes a cote."""

    def __init__(self, code, msg):
        super().__init__(msg)
        self.code, self.msg = code, msg


def default_pkg():
    """Paquet du projet courant, pour que le script soit portable entre projets.

    Deux sources, car elles ne coexistent pas : les projets Expo geres declarent
    expo.android.package dans app.json (Pearl List, Livraison), les projets RN
    bare portent applicationId dans build.gradle (AppUser, AppPro).
    Aucune valeur par defaut codee en dur : mieux vaut s'arreter que rapporter
    en silence les chiffres d'une autre app.
    """
    try:
        return json.load(open(os.path.join(ROOT, "app.json")))["expo"]["android"]["package"]
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
    try:
        sa = json.load(open(KEY))
    except (json.JSONDecodeError, OSError) as e:
        sys.exit(f"Cle de service illisible : {e}")
    now = int(time.time())
    claim = {"iss": sa["client_email"], "scope": SCOPE,
             "aud": "https://oauth2.googleapis.com/token",
             "iat": now, "exp": now + 3600}
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt.encode(claim, sa["private_key"], algorithm="RS256")}).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body)
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))["access_token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"Authentification Google refusee ({e.code}). "
                 f"La cle de service est-elle toujours valide ?\n{e.read().decode()[:200]}")
    except (urllib.error.URLError, TimeoutError) as e:
        # Sans ca, une simple coupure reseau sort un traceback urllib brut.
        sys.exit(f"Google injoignable pendant l'authentification : {e}")


def api(path, body=None, params=None):
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, data=(json.dumps(body).encode() if body is not None else None),
        method=("POST" if body is not None else "GET"))
    req.add_header("Authorization", "Bearer " + TOK)
    req.add_header("Content-Type", "application/json")
    # Un balayage --all fait une dizaine d'appels : un 503 passager de Google
    # ne doit pas faire passer une app pour illisible. Deux reprises suffisent.
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if e.code == 403 and "has not been used in project" in msg:
                sys.exit("L'API Play Developer Reporting est desactivee sur le projet Cloud.\n"
                         "Activer : https://console.developers.google.com/apis/api/"
                         "playdeveloperreporting.googleapis.com/overview")
            if e.code in (429, 500, 502, 503, 504) and essai < 2:
                time.sleep(2 ** essai)
                continue
            raise PlayError(e.code, msg)
        except (urllib.error.URLError, TimeoutError) as e:
            if essai < 2:
                time.sleep(2 ** essai)
                continue
            raise PlayError(0, f"reseau injoignable : {e}")


def freshness(pkg, metric_set):
    """Dernier instant couvert par CE jeu de metriques.

    Interroge par jeu, jamais mutualise : Google materialise les plantages et
    les ANR independamment, et un decalage d'un jour entre les deux suffit a
    faire refuser toute la requete avec un 400.
    """
    info = api(f"apps/{pkg}/{metric_set}").get("freshnessInfo", {})
    for f in info.get("freshnesses", []):
        if f.get("aggregationPeriod") == "DAILY" and f.get("latestEndTime"):
            return f["latestEndTime"]
    return None


def shift(d, n):
    """Recule de n jours en conservant heure et fuseau de la borne d'origine.

    Arithmetique en date pure (pas d'epoch) : passer par time.mktime melangeait
    heure locale et UTC et pouvait decaler la fenetre d'un jour.
    Les champs de fuseau sont recopies car Google refuse un intervalle dont les
    deux bornes n'expriment pas le decalage de la meme facon.
    """
    base = datetime.date(d["year"], d["month"], d["day"]) - datetime.timedelta(days=n)
    out = {k: v for k, v in d.items() if k not in ("year", "month", "day")}
    out.update({"year": base.year, "month": base.month, "day": base.day})
    return out


def fmt(d):
    return f"{d['year']}-{d['month']:02d}-{d['day']:02d}"


def sans_heures(d):
    """Retire le champ hours d'une borne journaliere.

    Necessaire : l'agregation DAILY renvoie 400 "Hours should be unset for
    DAILY aggregation", or certains jeux publient une fraicheur qui contient
    hours (errorCountMetricSet : hours=9) et d'autres non (crashRateMetricSet).
    """
    return {k: v for k, v in d.items() if k != "hours"}


def query(pkg, metric_set, metrics, start, end, dims=("versionCode",)):
    """Toutes les lignes, pagination comprise : sans elle, les jours au-dela de
    la premiere page disparaissent et faussent les agregats."""
    rows, page, garde = [], None, 0
    while garde < 50:
        garde += 1
        body = {"timelineSpec": {"aggregationPeriod": "DAILY",
                                 "startTime": start, "endTime": end},
                "metrics": list(metrics), "dimensions": list(dims)}
        if page:
            body["pageToken"] = page
        res = api(f"apps/{pkg}/{metric_set}:query", body=body)
        rows.extend(res.get("rows", []))
        page = res.get("nextPageToken")
        if not page:
            break
    if page:
        # Ne jamais tronquer en silence : une agregation partielle presentee
        # comme complete est pire qu'une absence de chiffre.
        print(f"    ATTENTION : {metric_set} depasse {garde} pages, "
              "les agregats ci-dessous sont incomplets.")
    return rows


def num(m):
    """Une valeur arrive en decimalValue ou en int64Value selon la metrique."""
    for k in ("decimalValue", "int64Value", "doubleValue"):
        if k in m:
            raw = m[k]
            try:
                return float(raw["value"] if isinstance(raw, dict) else raw)
            except (TypeError, ValueError):
                return None
    return None


def collect(rows):
    """{versionCode: {date: {metrique: valeur}}}.

    On garde le detail JOUR par JOUR. Aplatir tout de suite en un maximum par
    metrique melangeait des jours differents sur une meme ligne d'affichage.
    """
    out = {}
    for row in rows:
        vc = "?"
        for d in row.get("dimensions", []):
            if d.get("dimension") == "versionCode":
                vc = d.get("int64Value") or d.get("stringValue") or "?"
        st = row.get("startTime") or {}
        jour = fmt(st) if st.get("year") else "?"
        e = out.setdefault(str(vc), {}).setdefault(jour, {})
        for m in row.get("metrics", []):
            n = num(m)
            if n is not None:
                e[m.get("metric")] = n
    return out


def agrege(jours, cle):
    """(moyenne, pire valeur, date du pire jour, nb de jours, ponderee ou non).

    La ponderation par les utilisateurs n'est appliquee que si TOUS les jours
    portent distinctUsers. Sinon on retombe sur une moyenne simple de TOUS les
    jours, et on le signale.

    Pourquoi : ponderer un sous-ensemble revenait a effacer en silence les jours
    sans distinctUsers (numerateur ET denominateur a zero). Un seul jour porteur
    suffisait alors a jeter tous les autres, et un jour a 8 % de plantages
    disparaissait du verdict tout en restant affiche comme "pic".
    """
    vals = [(j, v[cle], v.get("distinctUsers")) for j, v in jours.items() if cle in v]
    if not vals:
        return (None, None, None, 0, False)
    complet = all(u for _, _, u in vals)
    if complet:
        poids = sum(u for _, _, u in vals)
        moy = sum(r * u for _, r, u in vals) / poids
    else:
        moy = sum(r for _, r, _ in vals) / len(vals)
    pire_jour, pire, _ = max(vals, key=lambda t: t[1])
    return (moy, pire, pire_jour, len(vals), complet)


def pct(v):
    return f"{v * 100:.2f} %" if v is not None else "inconnu"


def ligne_metrique(label, jours, cle_percue, cle_brute, seuil):
    """Une metrique pour une version. Renvoie l'etat pour le recapitulatif.

    Affiche son PROPRE nombre de jours : les deux jeux de metriques ont des
    fraicheurs et des seuils de publication independants, donc une couverture
    differente. Un compte unique en en-tete de version laisserait croire que
    les deux lignes reposent sur le meme echantillon.
    """
    moy, pire, pire_jour, n, pondere = agrege(jours, cle_percue)
    if moy is None:
        # Volontairement neutre : la cause (metrique non publiee, erreur API)
        # est deja imprimee plus haut. Affirmer ici serait affirmer a tort.
        print(f"    {label:<18} inconnu (metrique non disponible)")
        return "inconnu"
    verdict = "DEPASSE LE SEUIL" if moy > seuil else "ok"
    print(f"    {label:<18} {pct(moy):>9} sur {n} jour(s) "
          f"(seuil {pct(seuil)})  {verdict}")
    if not pondere:
        print(f"    {'':<18} moyenne NON ponderee : distinctUsers manque "
              "certains jours")
    # Marge de 5 % : sans elle, des jours tous identiques produisent un faux
    # "pic" ne tenant qu'a l'arrondi flottant de la moyenne.
    if pire is not None and pire > moy * 1.05:
        print(f"    {'':<18} pic a {pct(pire)} le {pire_jour}")
    brut, _, _, _, _ = agrege(jours, cle_brute)
    if brut is not None:
        print(f"    {'':<18} taux brut (pas seulement percu) : {pct(brut)}")
    return "depasse" if moy > seuil else "ok"


def en_utc(d):
    """Convertit une borne exprimee dans le fuseau du store en instant UTC.

    errorIssues:search n'accepte QUE UTC : passer le fuseau reel des metriques
    (America/Los_Angeles) renvoie 400 "Unsupported timezone". Mais forcer minuit
    UTC ferait porter la liste des plantages sur une fenetre decalee de
    plusieurs heures par rapport au tableau affiche juste au-dessus. On convertit
    donc, au lieu d'ecraser.
    """
    naive = datetime.datetime(d["year"], d["month"], d["day"], d.get("hours", 0))
    tz = (d.get("timeZone") or {}).get("id")
    if tz:
        try:
            from zoneinfo import ZoneInfo
            u = naive.replace(tzinfo=ZoneInfo(tz)).astimezone(datetime.timezone.utc)
            naive = u.replace(tzinfo=None)
        except Exception:
            pass  # fuseau inconnu du systeme : on reste sur l'heure telle quelle
    return {"year": naive.year, "month": naive.month,
            "day": naive.day, "hours": naive.hour}


def issues(pkg, start, end, limit=10):
    """Les plantages reels, groupes par cause, avec l'extrait de pile.

    Couvre la MEME fenetre que le tableau, convertie en UTC (seul fuseau accepte
    par cet endpoint).
    """
    params = {"pageSize": limit, "orderBy": "distinctUsers desc"}
    for nom, d in (("startTime", en_utc(start)), ("endTime", en_utc(end))):
        params[f"interval.{nom}.year"] = d["year"]
        params[f"interval.{nom}.month"] = d["month"]
        params[f"interval.{nom}.day"] = d["day"]
        params[f"interval.{nom}.hours"] = d["hours"]
        params[f"interval.{nom}.timeZone.id"] = "UTC"
    try:
        found = api(f"apps/{pkg}/errorIssues:search", params=params).get("errorIssues", [])
    except PlayError as e:
        print(f"    Detail des plantages indisponible (erreur {e.code}).")
        return
    if not found:
        print("    Aucun plantage DANS LES DONNEES DISPONIBLES. Ce n'est pas la")
        print("    preuve qu'il n'y en a pas eu : Google n'en publie qu'au-dela")
        print("    d'un certain nombre d'utilisateurs actifs.")
        return
    for i, it in enumerate(found, 1):
        cause = (it.get("cause") or "").strip() or "(cause non fournie)"
        loc = (it.get("location") or "").strip()
        print(f"\n    {i}. [{it.get('type', '?')}] "
              f"{it.get('distinctUsers', '?')} utilisateur(s) touche(s)")
        print(f"       {cause[:160]}")
        if loc:
            print(f"       -> {loc[:160]}")
    if len(found) >= limit:
        print(f"\n    (liste tronquee aux {limit} plantages touchant le plus d'utilisateurs)")


def lire(pkg, metric_set, metrics, days):
    """Un jeu de metriques, avec sa PROPRE fraicheur. Renvoie (donnees, fenetre,
    erreur) : un jeu en echec ne doit pas emporter l'autre."""
    try:
        end = freshness(pkg, metric_set)
        if not end:
            return ({}, None, "aucune donnee annoncee")
        end = sans_heures(end)
        start = shift(end, days)
        return (collect(query(pkg, metric_set, metrics, start, end)), (start, end), None)
    except PlayError as e:
        motif = ("paquet inconnu ou compte de service sans acces"
                 if e.code == 404 else f"erreur {e.code}")
        return ({}, None, motif)


def compte_erreurs(pkg, days):
    """Nombre BRUT de rapports d'erreur, par version, type et jour.

    C'est la seule source qui parle quand l'app a peu d'utilisateurs : les taux
    (crashRate, anrRate) exigent un minimum d'audience et Google ne publie
    alors AUCUNE ligne. Verifie sur AppUser : zero taux, mais un plantage reel
    en versionCode 167. Sans ce jeu, ce plantage etait invisible.

    Renvoie ([(jour, type, versionCode, nombre)], fenetre, erreur).
    """
    try:
        end = freshness(pkg, "errorCountMetricSet")
        if not end:
            return ([], None, "aucune donnee annoncee")
        end = sans_heures(end)
        start = shift(end, days)
        rows = query(pkg, "errorCountMetricSet", ["errorReportCount"], start, end,
                     dims=("reportType", "versionCode"))
    except PlayError as e:
        return ([], None, f"erreur {e.code}")

    trouves = []
    for row in rows:
        dims = {d.get("dimension"): (d.get("stringValue") or d.get("int64Value"))
                for d in row.get("dimensions", [])}
        for m in row.get("metrics", []):
            n = num(m)
            if m.get("metric") == "errorReportCount" and n and n > 0:
                st = row.get("startTime") or {}
                trouves.append((fmt(st) if st.get("year") else "?",
                                dims.get("reportType", "?"),
                                dims.get("versionCode", "?"), int(n)))
    trouves.sort()
    return (trouves, (start, end), None)


def affiche_comptes(trouves, fen, err, fen_taux):
    """Les rapports bruts. Affiches meme (et surtout) quand aucun taux n'existe.

    Annonce sa propre fenetre quand elle differe de celle des taux : ce jeu de
    metriques est souvent plus frais d'un jour, et une date hors de la periode
    affichee plus haut passerait pour une incoherence.
    """
    if err:
        print(f"  Comptes bruts d'erreurs indisponibles : {err}.")
        return
    periode = ""
    if fen and (not fen_taux or fen[1] != fen_taux[1]):
        periode = f" (du {fmt(fen[0])} au {fmt(shift(fen[1], 1))} inclus)"
    if not trouves:
        print(f"  Aucun rapport d'erreur brut{periode}.")
        return
    total = sum(n for _, _, _, n in trouves)
    print(f"  Rapports d'erreur bruts{periode} : {total} au total "
          "(cette source parle meme sans assez d'utilisateurs pour un taux)")
    for jour, typ, vc, n in trouves:
        print(f"    {jour}  {typ:<6} versionCode {vc:<6} {n} rapport(s)")


def report(label, pkg, days, want_issues):
    """Affiche une app. Renvoie un resume court pour la recapitulation finale."""
    print(f"\n=== {label} ({pkg}) ===")

    crash, fen_c, err_c = lire(pkg, "crashRateMetricSet",
                               ["crashRate", "userPerceivedCrashRate", "distinctUsers"], days)
    anr, fen_a, err_a = lire(pkg, "anrRateMetricSet",
                             ["anrRate", "userPerceivedAnrRate", "distinctUsers"], days)

    if err_c and err_a:
        print(f"  Illisible : plantages ({err_c}), ANR ({err_a}).")
        return (label, f"illisible ({err_c})")
    for quoi, err in (("plantages", err_c), ("ANR", err_a)):
        if err:
            print(f"  Metrique {quoi} indisponible : {err}. Le reste est affiche.")

    fen = fen_c or fen_a
    start, end = fen
    # latestEndTime est une borne EXCLUSIVE : le dernier jour couvert est la veille.
    print(f"  Periode couverte : du {fmt(start)} au {fmt(shift(end, 1))} inclus")
    print("  (Google s'arrete la : les donnees ont environ un jour de retard)")
    if fen_c and fen_a and fen_c[1] != fen_a[1]:
        print(f"  Note : les ANR s'arretent au {fmt(shift(fen_a[1], 1))}, "
              f"les plantages au {fmt(shift(fen_c[1], 1))}.")

    bruts, fen_b, err_b = compte_erreurs(pkg, days)

    vcs = sorted(set(crash) | set(anr), key=lambda v: -int(v) if v.isdigit() else 0)
    if not vcs:
        print("\n  Aucun TAUX publie : en dessous d'un certain nombre d'utilisateurs")
        print("  actifs, Google n'en calcule pas. Cela ne dit rien des plantages.")
        affiche_comptes(bruts, fen_b, err_b, fen)
        if want_issues:
            print("\n  Plantages remontes :")
            issues(pkg, start, end)
        # Une panne d'API ne doit pas se confondre avec une absence de donnees :
        # sans ca, "aucun taux" laissait croire a un silence de Google alors
        # qu'un jeu avait echoue.
        pannes = [f"{q} : {e}" for q, e in (("plantages", err_c), ("ANR", err_a)) if e]
        suffixe = f" [{'; '.join(pannes)}]" if pannes else ""
        if bruts:
            n = sum(x[3] for x in bruts)
            return (label, f"aucun taux, mais {n} rapport(s) d'erreur brut(s){suffixe}")
        return (label, f"aucun taux ni rapport d'erreur{suffixe}")

    etats = []
    for vc in vcs:
        jc, ja = crash.get(vc, {}), anr.get(vc, {})
        # Les utilisateurs sont cherches dans LES DEUX jeux : les prendre sur le
        # seul jeu plantages perdait le volume quand seuls les ANR etaient
        # publies. Le nombre de jours est affiche par metrique, pas ici, car il
        # differe entre les deux.
        users = [v["distinctUsers"] for jours in (jc, ja) for v in jours.values()
                 if "distinctUsers" in v]
        print(f"\n  --- versionCode {vc}"
              + (f" (jusqu'a {int(max(users))} utilisateurs/jour)" if users else ""))
        e1 = ligne_metrique("plantages percus", jc, "userPerceivedCrashRate", "crashRate",
                            SEUIL["crash"])
        e2 = ligne_metrique("ANR percus", ja, "userPerceivedAnrRate", "anrRate", SEUIL["anr"])
        # Les deux constats se cumulent : un depassement ne doit pas faire
        # disparaitre du recapitulatif le fait qu'une metrique reste inconnue.
        paires = (("plantages", e1), ("ANR", e2))
        for etiquette, filtre in (("au-dessus du seuil", "depasse"), ("inconnu", "inconnu")):
            quoi = " et ".join(n for n, e in paires if e == filtre)
            if quoi:
                etats.append(f"vc={vc} {quoi} {etiquette}")

    print()
    affiche_comptes(bruts, fen_b, err_b, fen)

    print("\n  APPROXIMATION : le verdict compare une moyenne des taux quotidiens")
    print(f"  sur {days} jour(s) au seuil Google, alors que Google evalue un rapport")
    print("  de comptes cumules sur 28 jours glissants. L'ordre de grandeur est")
    print("  bon, la valeur exacte non : un chiffre proche du seuil se verifie")
    print("  dans la Play Console avant toute decision.")
    print("  Le pic d'une journee est signale a part : il ne vaut pas condamnation.")
    print("  Non verifie ici : le seuil par MODELE d'appareil (8 %), qui peut etre")
    print("  depasse sur un modele precis alors que la moyenne reste bonne.")

    if want_issues:
        print("\n  Plantages remontes :")
        issues(pkg, start, end)

    return (label, "; ".join(etats) if etats else "sous les seuils")


def main():
    global TOK
    args = sys.argv[1:]

    connues = {"--all", "--issues", "--days", "--app"}
    # args.index() ne voit que la premiere occurrence : une option repetee
    # produirait un message d'erreur designant la mauvaise valeur.
    for opt in connues:
        if args.count(opt) > 1:
            sys.exit(f"Option {opt} indiquee plusieurs fois : n'en garder qu'une.")
    valeurs = set()
    for opt in ("--days", "--app"):
        if opt in args and args.index(opt) + 1 < len(args):
            valeurs.add(args.index(opt) + 1)
    inconnues = [a for i, a in enumerate(args) if i not in valeurs and a not in connues]
    if inconnues:
        sys.exit(f"Option inconnue : {' '.join(inconnues)}\n"
                 "Options acceptees : --all, --issues, --days N, --app com.exemple.monapp")

    days = 14
    if "--days" in args:
        i = args.index("--days") + 1
        # Pas d'assert : sous python3 -O les assertions disparaissent et la
        # borne ne serait plus verifiee du tout.
        if i >= len(args) or not args[i].isdigit() or not 1 <= int(args[i]) <= 365:
            sys.exit("--days attend un nombre de jours entier entre 1 et 365.")
        days = int(args[i])

    want_issues = "--issues" in args

    if "--app" in args and "--all" in args:
        sys.exit("--app et --all s'excluent : choisir une app precise, ou les balayer toutes.")

    if "--app" in args:
        i = args.index("--app") + 1
        if i >= len(args) or args[i].startswith("--"):
            sys.exit("--app attend un nom de paquet, par exemple com.exemple.monapp.")
        cibles = [(args[i], args[i])]
    elif "--all" in args:
        cibles = APPS
    else:
        p = default_pkg()
        cibles = [(p, p)]

    TOK = token()
    resumes = [report(label, pkg, days, want_issues) for label, pkg in cibles]

    if len(resumes) > 1:
        print("\n=== Recapitulatif ===")
        for label, etat in resumes:
            print(f"  {label:<12} {etat}")


if __name__ == "__main__":
    main()
