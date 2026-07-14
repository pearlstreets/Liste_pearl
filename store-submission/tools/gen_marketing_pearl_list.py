#!/usr/bin/env python3
import base64, os

SHOTS = "/private/tmp/claude-501/-Users-remsko-Marketplace/3028c1fc-9f48-4662-ad20-361ecf09f5c2/scratchpad/shots"
OUT   = "/private/tmp/claude-501/-Users-remsko-Marketplace/3028c1fc-9f48-4662-ad20-361ecf09f5c2/scratchpad/mkt"
os.makedirs(OUT, exist_ok=True)

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

# (file, title, subtitle, hero?)
SCREENS = [
    ("A_maliste.png",  "VOTRE<br>LISTE",   "Écrivez vos courses en langage naturel", True),
    ("B_produits.png", "TROUVEZ<br>TOUT",  "Chaque article dans les boutiques près de vous", False),
    ("01_boutiques.png","BOUTIQUES<br>LOCALES","Parcourez les commerces autour de vous", False),
    ("03_panier.png",  "COMMANDEZ",        "Click &amp; Collect ou livraison, en un clic", False),
    ("C_profil.png",   "TOUT<br>EN UN",    "Commandes, favoris et adresses réunis", False),
]

TPL = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{width:1242px;height:2688px;overflow:hidden;font-family:-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif;}}
.canvas{{position:relative;width:1242px;height:2688px;overflow:hidden;
  background:linear-gradient(158deg,#7BE7C4 0%,#62D4AC 42%,#34B48E 100%);}}
.blob{{position:absolute;border-radius:50%;background:rgba(255,255,255,.10);}}
.b1{{width:1000px;height:1000px;top:-360px;right:-320px;background:rgba(255,255,255,.13);}}
.b2{{width:560px;height:560px;bottom:-160px;left:-190px;}}
.b3{{width:230px;height:230px;top:760px;left:120px;background:rgba(255,255,255,.08);}}
.brand{{position:absolute;top:96px;left:0;right:0;text-align:center;
  font-size:52px;font-weight:800;color:#fff;letter-spacing:-1px;}}
.brand .dot{{color:#0B4A3A;}}
.cap{{position:absolute;top:224px;left:0;right:0;text-align:center;padding:0 90px;}}
.title{{font-size:150px;font-weight:800;color:#fff;letter-spacing:-3px;line-height:.92;text-transform:uppercase;
  text-shadow:0 6px 30px rgba(9,60,45,.18);}}
.sub{{font-size:50px;font-weight:500;color:rgba(255,255,255,.94);margin-top:34px;line-height:1.24;}}
.stars{{margin-top:30px;font-size:56px;color:#FFD23F;letter-spacing:6px;}}
.rate{{font-size:34px;color:rgba(255,255,255,.9);font-weight:600;margin-top:6px;letter-spacing:1px;}}
.phone-wrap{{position:absolute;left:0;right:0;top:720px;bottom:80px;display:flex;align-items:center;justify-content:center;}}
.phone{{width:700px;background:#0A0A0E;border-radius:92px;padding:16px;
  box-shadow:0 70px 130px rgba(5,45,34,.42), 0 0 0 3px rgba(0,0,0,.25);}}
.phone img{{display:block;width:100%;border-radius:78px;}}
</style></head><body>
<div class="canvas">
  <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
  <div class="brand">Pearl List<span class="dot">.</span></div>
  <div class="cap">
    <div class="title">{title}</div>
    <div class="sub">{sub}</div>
    {hero}
  </div>
  <div class="phone-wrap"><div class="phone"><img src="data:image/png;base64,{img}"></div></div>
</div>
</body></html>"""

HERO = '<div class="stars">★★★★★</div><div class="rate">Vos courses locales, en un clin d\'œil</div>'

for i,(f,title,sub,hero) in enumerate(SCREENS, start=1):
    html = TPL.format(title=title, sub=sub, img=b64(os.path.join(SHOTS,f)),
                      hero=(HERO if hero else ""))
    p = os.path.join(OUT, f"mkt_{i}.html")
    with open(p,"w") as out: out.write(html)
    print("wrote", p)
print("DONE")
