export type Category = { id: number; slug: string; nume: string; display_count: number; art: string; ordine: number };
export type Vehicle  = { id: number; slug: string; nume: string; an: number | null; vin_masca: string | null; piese_listate: number; intrare: string };
export type Product  = {
  id: number; slug: string; nume: string; oem: string; stare: "A" | "B" | "C";
  stare_nota: string | null; pret_lei: number; pret_sufix: string | null; ani: string | null;
  art: string; categorie_id: number | null; vehicul_id: number | null;
  compat: string[]; stoc: number; publicat: boolean;
  categories?: Category | null; vehicles?: Vehicle | null;
};
export type CartItem = { id: number; slug: string; nume: string; pret: number; art: string; oem: string; cantitate: number };
