#!/usr/bin/env python3
"""
Reface toate imaginile de marcă din logo-ul original.

Când primești un logo nou:
  1. pui fișierul nou peste `design/logo-original.png` (PNG cu fundal transparent);
  2. verifici coordonatele ROATA de mai jos — decupajul pentru iconițe;
  3. rulezi:  pip install Pillow && python3 design/genereaza-imagini.py

Se rescriu: public/logo.png, app/icon.png, app/apple-icon.png,
app/favicon.ico, app/opengraph-image.png
"""
from PIL import Image, ImageDraw, ImageFont

SURSA = "design/logo-original.png"
FUNDAL = (21, 24, 28, 255)   # #15181C — fundalul de header/footer
ACCENT = (255, 107, 26, 255) # #FF6B1A

# Decupajul pentru iconițe: doar roata dințată, fără nicio literă.
# Literele „AUTOPAS" încep pe la y=535 în originalul de 1536×1024; tăiem înainte,
# altfel la 32px fragmentele de litere arată ca un text greșit.
ROATA = (54, 101, 600, 532)

im = Image.open(SURSA).convert("RGBA")
taiat = im.crop(im.split()[3].getbbox())   # scoatem marginile transparente

# --- Logo-ul folosit în header, subsol și admin ---------------------------
# 600px lățime acoperă și ecranele cu densitate mare. Reducerea la 256 de culori
# îl face de ~5 ori mai mic (39 KB în loc de 189) fără diferență vizibilă.
lat = 600
b = taiat.resize((lat, round(lat * taiat.height / taiat.width)), Image.LANCZOS)
b.quantize(colors=256, method=Image.FASTOCTREE).save("public/logo.png", optimize=True)

# --- Iconițele (tab, iPhone) ----------------------------------------------
roata = im.crop(ROATA)

def patrat(latura, umplere=0.94):
    """Roata centrată într-un pătrat, pe fundal închis (transparentul ar dispărea
    pe barele de tab deschise la culoare)."""
    c = Image.new("RGBA", (latura, latura), FUNDAL)
    s = roata.copy()
    s.thumbnail((int(latura * umplere),) * 2, Image.LANCZOS)
    c.paste(s, ((latura - s.width) // 2, (latura - s.height) // 2), s)
    return c

patrat(256).convert("RGB").quantize(colors=256).save("app/icon.png", optimize=True)
patrat(180).convert("RGB").quantize(colors=256).save("app/apple-icon.png", optimize=True)
patrat(64).save("app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

# --- Imaginea de partajare pe WhatsApp / Facebook (1200×630) --------------
og = Image.new("RGBA", (1200, 630), FUNDAL)
l = taiat.copy()
l.thumbnail((760, 760), Image.LANCZOS)
og.paste(l, ((1200 - l.width) // 2, 248 - l.height // 2), l)
d = ImageDraw.Draw(og)
d.text((600, 492), "Piese auto testate, cu garanție 90 de zile",
       font=ImageFont.truetype("app/fonts/Poppins-Medium.ttf", 36),
       fill=(255, 255, 255, 230), anchor="mm")
d.text((600, 552), "Dezmembrări autorizate · județul Neamț",
       font=ImageFont.truetype("app/fonts/Poppins-SemiBold.ttf", 26),
       fill=ACCENT, anchor="mm")
og.convert("RGB").quantize(colors=256).save("app/opengraph-image.png", optimize=True)

print("Gata. Logo:", b.size)
