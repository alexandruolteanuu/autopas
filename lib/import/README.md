# `lib/import/` — un singur motor, două declanșatoare

Importul din pieseauto.ro poate porni din două locuri:

- **din terminal** — `node scripts/import-pieseauto.mjs --feed=…` (rulare lungă, fără limită de timp)
- **din admin** — `/admin/import`, prin ruta `app/api/import/route.ts` (loturi scurte, o cerere pe lot)

Amândouă fac **exact același lucru** cu fiecare rând din feed. Dacă ar fi două
implementări, s-ar despărți în timp: cineva ar repara extragerea într-un loc și ar
uita celălalt, iar piesele importate din admin ar ieși altfel decât cele importate
din terminal. Bug-uri de felul ăsta se găsesc greu, fiindcă ambele „merg".

## Cum se evită duplicarea

Toată logica stă în modulele de aici. Cele două declanșatoare nu conțin nicio
regulă de import — doar orchestrare (de unde vine fișierul, unde se scrie progresul,
cum se afișează).

| Modul | Ce conține | Cine îl folosește |
|---|---|---|
| `csv.mjs` | parser RFC 4180 + verificarea coloanelor | script, rută |
| `extragere.mjs` | tot ce se citește din HTML-ul unei pagini de produs | script, rută |
| `potrivire.mjs` | marcă, model, categorie; regulile de taxonomie | script, rută |
| `rand.mjs` | rândul din `products`; ce are voie să atingă un re-import | script, rută |
| `aducere.mjs` | cererea politicoasă pe HTTP/2 (pauze, User-Agent, „sorry", reîncercări) | script, rută |
| `imagini.mjs` | conversia pozelor în WebP | script, rută, `/api/publica-piesa` |
| `depozit.mjs` | singurul loc care vorbește cu Supabase în timpul importului | script, rută |
| `motor.mjs` | planificarea și procesarea unei felii de rânduri | script, rută |
| `taxonomie-sursa.mjs` | catalogul pieseauto.ro (742 categorii în 33 de grupe), **generat** — nu se editează cu mâna | `potrivire.mjs` |

## De ce `.mjs` și nu `.ts`

Scriptul din terminal rulează direct cu `node`, fără pas de compilare — proiectul
n-are unul pentru `scripts/`. Node nu execută TypeScript, deci un modul comun scris
în `.ts` ar fi cerut fie un încărcător experimental, fie un al doilea build. În
schimb, TypeScript **poate** importa `.mjs`: `tsconfig.json` are deja `allowJs: true`,
iar tipurile se deduc din cod. Așa există un singur fișier per regulă, fără unelte în
plus.

## Regula

Orice regulă nouă de import se scrie **aici**. Dacă te trezești copiind cod din
`scripts/` în `app/api/`, sau invers, e semn că locul lui e în modulul comun.
