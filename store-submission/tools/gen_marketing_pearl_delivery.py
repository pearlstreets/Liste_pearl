#!/usr/bin/env python3
import base64, os
SHOTS = "/private/tmp/claude-501/-Users-remsko-Marketplace/3028c1fc-9f48-4662-ad20-361ecf09f5c2/scratchpad/dshots"
OUT   = "/private/tmp/claude-501/-Users-remsko-Marketplace/3028c1fc-9f48-4662-ad20-361ecf09f5c2/scratchpad/dmkt"
os.makedirs(OUT, exist_ok=True)

def b64(p):
    with open(p,"rb") as f: return base64.b64encode(f.read()).decode()

# (file, title, subtitle, hero?)
SCREENS = [
    ("04_course_entrante.png", "GAGNEZ",          "Acceptez des courses près de vous en un tap", True),
    ("01_dashboard.png",       "TABLEAU<br>DE BORD","Gains, note et courses en un coup d'œil", False),
    ("02_opportunites.png",    "PLUS<br>DE GAINS", "Boosts, quêtes et zones prioritaires", False),
    ("03_revenus.png",         "ENCAISSEZ",        "Votre solde, retirable chaque jour", False),
    ("05_historique.png",      "SUIVEZ<br>TOUT",   "Historique et revenus détaillés", False),
]

TPL = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{width:1242px;height:2688px;overflow:hidden;font-family:-apple-system,'Helvetica Neue','Segoe UI',Arial,sans-serif;}}
.canvas{{position:relative;width:1242px;height:2688px;overflow:hidden;
  background:radial-gradient(120% 90% at 50% 12%, #1E1F27 0%, #101018 42%, #08080C 72%, #050508 100%);}}
.glow{{position:absolute;border-radius:50%;filter:blur(20px);}}
.g1{{width:1100px;height:1100px;top:-380px;right:-360px;background:rgba(98,212,172,.14);}}
.g2{{width:640px;height:640px;bottom:-220px;left:-220px;background:rgba(98,212,172,.10);}}
.g3{{width:520px;height:520px;top:1180px;left:50%;transform:translateX(-50%);background:rgba(98,212,172,.10);}}
.brand{{position:absolute;top:96px;left:0;right:0;text-align:center;
  font-size:52px;font-weight:800;color:#fff;letter-spacing:-1px;}}
.brand .dot{{color:#62D4AC;}}
.cap{{position:absolute;top:222px;left:0;right:0;text-align:center;padding:0 84px;}}
.title{{font-size:148px;font-weight:800;color:#fff;letter-spacing:-3px;line-height:.92;text-transform:uppercase;}}
.sub{{font-size:49px;font-weight:500;color:rgba(255,255,255,.72);margin-top:34px;line-height:1.24;}}
.accent{{margin-top:26px;font-size:52px;font-weight:800;color:#62D4AC;letter-spacing:.5px;}}
.phone-wrap{{position:absolute;left:0;right:0;top:720px;bottom:80px;display:flex;align-items:center;justify-content:center;}}
.phone{{width:700px;background:#0A0A0E;border-radius:92px;padding:16px;
  box-shadow:0 0 0 2px rgba(255,255,255,.09), 0 50px 120px rgba(0,0,0,.65), 0 0 120px rgba(98,212,172,.16);}}
.phone img{{display:block;width:100%;border-radius:78px;}}
</style></head><body>
<div class="canvas">
  <div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
  <div class="brand">Pearl Delivery<span class="dot">.</span></div>
  <div class="cap">
    <div class="title">{title}</div>
    <div class="sub">{sub}</div>
    {hero}
  </div>
  <div class="phone-wrap"><div class="phone"><img src="data:image/png;base64,{img}"></div></div>
</div>
</body></html>"""

HERO = '<div class="accent">★ 5,0 · jusqu\'à +7,99 € la course</div>'

for i,(f,title,sub,hero) in enumerate(SCREENS, start=1):
    html = TPL.format(title=title, sub=sub, img=b64(os.path.join(SHOTS,f)), hero=(HERO if hero else ""))
    with open(os.path.join(OUT,f"d_{i}.html"),"w") as o: o.write(html)
print("DONE")
