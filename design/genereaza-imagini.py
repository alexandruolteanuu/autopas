#!/usr/bin/env python3
"""
Reface toate imaginile de marcă din logo-ul original.

Când primești un logo nou:
  1. pui fișierul nou peste `design/logo-original-galben.png` (PNG cu fundal transparent);
  2. verifici coordonatele ROATA de mai jos — decupajul pentru iconițe;
  3. rulezi:  pip install Pillow && python3 design/genereaza-imagini.py

Se rescriu: public/logo.png, app/icon.png, app/apple-icon.png,
app/favicon.ico, app/opengraph-image.png

──────────────────────────────────────────────────────────────────────────
ATENȚIE — două grafici, două palete (constatat 24 august 2026)

  design/logo-original.png         PORTOCALIU #FF6B1A, 1536×1024 — paleta VECHE
  design/logo-original-galben.png  GALBEN     #F2B705, 2752×1536 — paleta ACTUALĂ

Scriptul citea din cel portocaliu, dar în `public/` fusese pus manual cel
galben. Adică o rulare a scriptului ÎNTORCEA logoul site-ului la portocaliu,
fără ca cineva să ceară asta. Acum sursa e cea galbenă; cea portocalie rămâne
în depozit ca istoric, neatinsă.

Iconițele din `app/` (icon.png, apple-icon.png, favicon.ico, opengraph-image)
sunt încă cele PORTOCALII, generate înainte de schimbarea temei. O rulare a
scriptului le va reface galbene — corect, dar e o schimbare vizibilă în tabul
browserului și la partajarea pe WhatsApp. Rulează conștient.
──────────────────────────────────────────────────────────────────────────
"""
from PIL import Image, ImageDraw, ImageFont

SURSA = "design/logo-original-galben.png"
FUNDAL = (21, 24, 28, 255)   # #15181C — fundalul de header/footer
ACCENT = (242, 183, 5, 255)  # #F2B705 — accentul temei „Atelier, galben industrial"

# Decupajul pentru iconițe: doar roata dințată, fără nicio literă.
# Literele „AUTOPAS" încep pe la y=820 în sursa galbenă de 2752×1536; tăiem
# înainte, altfel la 32px fragmentele de litere arată ca un text greșit.
# (Pentru vechea sursă portocalie de 1536×1024 valoarea era (54, 101, 600, 532).)
ROATA = (220, 164, 1087, 817)

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
