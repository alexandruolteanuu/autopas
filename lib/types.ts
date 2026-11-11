export type Category = { id: number; slug: string; nume: string; display_count: number; art: string; ordine: number;
  parent_id?: number | null; descriere?: string | null; nr_piese?: number };
// Mașina la dezmembrat. Coloanele de la `poze` în jos sunt din
// supabase/pagini-masini.sql, adăugate ca să existe o pagină publică.
// `marca_id`/`model_id` sunt marca și modelul ca DATE, nu ca text în `nume`:
// fără ele nu se poate afla ce mașini sunt înrudite. Rămân null pe mașinile
// înregistrate înainte de migrare; se completează din Admin → Mașini.
export type Vehicle  = { id: number; slug: string; nume: string; an: number | null; vin_masca: string | null;
  piese_listate: number; intrare: string;
  poze?: string[] | null; descriere?: string | null; publicat?: boolean;
  motorizare?: string | null; caroserie?: string | null; culoare?: string | null;
  cutie_viteze?: string | null; km?: number | null;
  marca_id?: number | null; model_id?: number | null };
export type Product  = {
  id: number; slug: string; nume: string; oem: string | null; stare: "A" | "B" | "C" | null;
  stare_nota: string | null; pret_lei: number; pret_sufix: string | null; ani: string | null;
  art: string; categorie_id: number | null; vehicul_id: number | null;
  compat: string[]; stoc: number; publicat: boolean; model_ids?: number[]; greutate_kg?: number | null;
  // Calculată de bază din model_ids (supabase/piese-compatibile-masini.sql):
  // câte modele sunt trecute pe piesă. Cu cât mai puține, cu atât piesa e mai
  // specific a modelului respectiv — de asta e cheia de ordonare pe pagina mașinii.
  nr_modele?: number;
  cost_lei?: number | null; vizualizari?: number; subcategorie_id?: number | null; cod_intern?: string | null;
  originala?: boolean; poze?: string[] | null; created_at?: string;
  categories?: Category | null; vehicles?: Vehicle | null;
  // Proveniența din pieseauto.ro. `import_erori.ciorna` = piesă nouă din sincronizarea
  // CSV, nepublicată, fără poze și descriere (lib/import/rand.mjs, „Piese noi din CSV").
  sursa?: string | null; sursa_url?: string | null;
  import_erori?: { ciorna?: boolean; revizuire?: string[] } | null;
};
// `poza` = prima poză a piesei, memorată în coș ca să nu fie nevoie de o
// interogare pentru fiecare rând la fiecare afișare a coșului.
// `null` înseamnă „am verificat, piesa n-are poză" — DIFERIT de cheia lipsă,
// care înseamnă „coș salvat înainte de 7 septembrie 2026, încă neverificat".
// CartContext se bazează pe distincția asta ca să nu reinterogheze la infinit.
// `stoc` = câte bucăți avea piesa la ultima reîmprospătare a coșului. E un
// PLAFON pentru selectorul de cantitate, nu un adevăr: coșul trăiește în
// localStorage, iar stocul se schimbă între timp. De asta `/cos` îl recitește
// la fiecare deschidere, iar decizia finală rămâne a lui `plaseaza_comanda`,
// pe server. Cheia lipsă = coș salvat înainte de 20 octombrie 2026.
export type CartItem = { id: number; slug: string; nume: string; pret: number; art: string; oem: string;
  cantitate: number; poza?: string | null; stoc?: number };
export type Brand = { id: number; slug: string; nume: string; ordine: number };
// an_start / an_final = anii generației, ca date (supabase/ani-generatie.sql).
// an_final null = model încă în producție. Numele rămâne doar pentru afișare.
export type Model = { id: number; brand_id: number; slug: string; nume: string;
  an_start?: number | null; an_final?: number | null };
export type OrderEvent = { id: number; order_id: number; tip: string; mesaj: string; autor: string; created_at: string };
export type OrderFull = { id: number; numar: string; tip_client: string; nume: string; email: string; telefon: string;
  firma: string | null; cui: string | null; adresa: string; oras: string; judet: string; curier: string; plata: string;
  subtotal: number; livrare: number; total: number; status: string; gdpr: boolean; created_at: string;
  awb: string | null; nota_interna: string | null; factura_serie: string | null; factura_status: string;
  /** Migrarea 55: comanda cu factură „ștearsă” din admin = ascunsă. Null = vizibilă. */
  sters_la?: string | null;
  discount_cod: string | null; discount_valoare: number;
  // Costul livrării se stabilește după plasarea comenzii (vezi supabase/livrare-dupa-comanda.sql).
  // `livrare_stabilit_la` null = încă necalculat, deci comanda nu poate fi expediată.
  livrare_baza: number | null; livrare_km_extra: number | null; livrare_alte: number | null;
  livrare_greutate_kg: number | null; livrare_dimensiuni: string | null;
  livrare_nota: string | null; livrare_stabilit_la: string | null;
  // Ce a scris clientul la checkout (supabase/observatii-comanda.sql). Opțional.
  observatii: string | null;
  // Ce s-a declarat la FAN și ce a răspuns (supabase/awb-fancourier.sql). Null = AWB scris de mână.
  awb_date?: AwbDate | null };
export type AwbDate = { colete: number; greutate: number; lungime: number | null; latime: number | null; inaltime: number | null;
  ramburs: number; serviciu: string; tarif: number; tva: number; tracking: string;
  destinatar: { telefon: string; judet: string; localitate: string; strada: string } };
export type Discount = { id: number; cod: string; tip: "procent" | "fix"; valoare: number;
  minim_comanda: number; expira_la: string | null; activ: boolean; folosiri: number };
export type VehiculAdmin = { id: number; slug: string; nume: string; an: number | null; vin_masca: string | null;
  piese_listate: number; intrare: string; cost_achizitie: number | null; status: string;
  poze?: string[] | null; descriere?: string | null; publicat?: boolean;
  motorizare?: string | null; caroserie?: string | null; culoare?: string | null;
  cutie_viteze?: string | null; km?: number | null;
  marca_id?: number | null; model_id?: number | null };

// ============================================================
// FACTURILE SPRE SAGA (supabase/saga-facturi.sql, migrarea 49; docs/saga-plan.md)
// ============================================================
export type SagaStatus = "de_trimis" | "in_curs" | "trimisa" | "eroare" | "confirmata";
export type FacturaSerie = { serie: string; urmator: number; activa: boolean;
  actualizat_la: string; actualizat_de: string | null };
export type FacturaSerieIstoric = { id: number; serie: string; urmator: number;
  actiune: "setare" | "retragere"; detalii: string | null; facut_la: string;
  facut_de: string | null; facut_de_email: string | null };
export type Factura = { id: number; tip: "factura" | "storno"; storno_pentru: number | null;
  order_id: number; serie: string; numar: number; data: string; scadenta: string | null;
  regim_tva: "normal" | "marja"; preturi_cu_tva: boolean;
  client: Record<string, string | null>; furnizor: Record<string, string | null>;
  mentiune_plata: string | null; observatii: string | null;
  total_fara_tva: number; total_tva: number; total: number;
  saga_status: SagaStatus; saga_eroare: string | null; saga_trimisa_la: string | null;
  confirmata_la: string | null; confirmata_de: string | null; emisa_de: string | null;
  created_at: string; updated_at: string };
export type FacturaLinie = { id: number; factura_id: number; nr_crt: number;
  tip: "piesa" | "reducere" | "transport"; order_item_id: number | null; product_id: number | null;
  cod_intern: string | null; denumire_site: string; cod_articol_saga: string; descriere: string;
  um: string; cantitate: number; pret_cu_tva: number; pret_fara_tva: number; valoare: number;
  cota_tva: number; tva: number; total: number };
