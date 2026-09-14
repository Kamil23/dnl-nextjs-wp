// Konwerter miar kuchennych: szklanka/łyżka/łyżeczka -> gramy.
// Wartości to typowe domowe średnie z polskich tabel kulinarnych
// (szklanka 250 ml, łyżka 15 ml, łyżeczka 5 ml - miary "płaskie").
// Realne odchylenia ±5-10% (sposób nakładania, wilgotność, marka) -
// landingi mówią o tym wprost, więc trzymamy się uczciwego zaokrąglenia.
// null = miara bez sensu dla składnika (np. szklanka proszku do pieczenia).

export type MeasureKey = "szklanka" | "lyzka" | "lyzeczka";

export type IngredientGroup =
  | "maki"
  | "cukry"
  | "nabial-tluszcze"
  | "suche"
  | "dodatki";

export type Ingredient = {
  slug: string;
  // mianownik - nagłówki i listy ("Mąka pszenna")
  name: string;
  // dopełniacz - frazy typu "szklanka mąki pszennej", "100 g mąki"
  nameGen: string;
  group: IngredientGroup;
  grams: { szklanka: number | null; lyzka: number | null; lyzeczka: number | null };
};

export const MEASURES: Record<
  MeasureKey,
  { label: string; forms: [string, string, string]; ml: number }
> = {
  szklanka: { label: "szklanka", forms: ["szklanka", "szklanki", "szklanek"], ml: 250 },
  lyzka: { label: "łyżka", forms: ["łyżka", "łyżki", "łyżek"], ml: 15 },
  lyzeczka: { label: "łyżeczka", forms: ["łyżeczka", "łyżeczki", "łyżeczek"], ml: 5 },
};

export const GROUP_LABELS: Record<IngredientGroup, string> = {
  maki: "Mąki",
  cukry: "Cukry i słodziki",
  "nabial-tluszcze": "Nabiał i tłuszcze",
  suche: "Produkty sypkie",
  dodatki: "Przyprawy i dodatki",
};

export const INGREDIENTS: Ingredient[] = [
  // --- Mąki ---
  { slug: "maka-pszenna", name: "Mąka pszenna", nameGen: "mąki pszennej", group: "maki", grams: { szklanka: 160, lyzka: 10, lyzeczka: 3 } },
  { slug: "maka-zytnia", name: "Mąka żytnia", nameGen: "mąki żytniej", group: "maki", grams: { szklanka: 150, lyzka: 10, lyzeczka: 3 } },
  { slug: "maka-orkiszowa", name: "Mąka orkiszowa", nameGen: "mąki orkiszowej", group: "maki", grams: { szklanka: 155, lyzka: 10, lyzeczka: 3 } },
  { slug: "maka-pelnoziarnista", name: "Mąka pełnoziarnista", nameGen: "mąki pełnoziarnistej", group: "maki", grams: { szklanka: 145, lyzka: 9, lyzeczka: 3 } },
  { slug: "maka-ziemniaczana", name: "Mąka ziemniaczana", nameGen: "mąki ziemniaczanej", group: "maki", grams: { szklanka: 175, lyzka: 12, lyzeczka: 4 } },
  { slug: "maka-migdalowa", name: "Mąka migdałowa", nameGen: "mąki migdałowej", group: "maki", grams: { szklanka: 100, lyzka: 6, lyzeczka: 2 } },
  { slug: "maka-kokosowa", name: "Mąka kokosowa", nameGen: "mąki kokosowej", group: "maki", grams: { szklanka: 100, lyzka: 7, lyzeczka: 2 } },

  // --- Cukry i słodziki ---
  { slug: "cukier", name: "Cukier", nameGen: "cukru", group: "cukry", grams: { szklanka: 220, lyzka: 12, lyzeczka: 4 } },
  { slug: "cukier-puder", name: "Cukier puder", nameGen: "cukru pudru", group: "cukry", grams: { szklanka: 160, lyzka: 8, lyzeczka: 3 } },
  { slug: "cukier-trzcinowy", name: "Cukier trzcinowy", nameGen: "cukru trzcinowego", group: "cukry", grams: { szklanka: 200, lyzka: 12, lyzeczka: 4 } },
  { slug: "cukier-waniliowy", name: "Cukier waniliowy", nameGen: "cukru waniliowego", group: "cukry", grams: { szklanka: 220, lyzka: 12, lyzeczka: 4 } },
  { slug: "ksylitol", name: "Ksylitol", nameGen: "ksylitolu", group: "cukry", grams: { szklanka: 200, lyzka: 12, lyzeczka: 4 } },
  { slug: "erytrytol", name: "Erytrytol", nameGen: "erytrytolu", group: "cukry", grams: { szklanka: 170, lyzka: 10, lyzeczka: 3 } },
  { slug: "miod", name: "Miód", nameGen: "miodu", group: "cukry", grams: { szklanka: 350, lyzka: 21, lyzeczka: 7 } },
  { slug: "syrop-klonowy", name: "Syrop klonowy", nameGen: "syropu klonowego", group: "cukry", grams: { szklanka: 330, lyzka: 20, lyzeczka: 7 } },
  { slug: "syrop-z-agawy", name: "Syrop z agawy", nameGen: "syropu z agawy", group: "cukry", grams: { szklanka: 340, lyzka: 20, lyzeczka: 7 } },

  // --- Nabiał i tłuszcze ---
  { slug: "maslo", name: "Masło", nameGen: "masła", group: "nabial-tluszcze", grams: { szklanka: 240, lyzka: 15, lyzeczka: 5 } },
  { slug: "mleko", name: "Mleko", nameGen: "mleka", group: "nabial-tluszcze", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },
  { slug: "jogurt-naturalny", name: "Jogurt naturalny", nameGen: "jogurtu naturalnego", group: "nabial-tluszcze", grams: { szklanka: 245, lyzka: 15, lyzeczka: 5 } },
  { slug: "skyr", name: "Skyr", nameGen: "skyru", group: "nabial-tluszcze", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },
  { slug: "smietana-18", name: "Śmietana 18%", nameGen: "śmietany 18%", group: "nabial-tluszcze", grams: { szklanka: 250, lyzka: 15, lyzeczka: 5 } },
  { slug: "smietana-30", name: "Śmietana 30%", nameGen: "śmietany 30%", group: "nabial-tluszcze", grams: { szklanka: 245, lyzka: 15, lyzeczka: 5 } },
  { slug: "mascarpone", name: "Ser mascarpone", nameGen: "sera mascarpone", group: "nabial-tluszcze", grams: { szklanka: 265, lyzka: 16, lyzeczka: 5 } },
  { slug: "twarog", name: "Twaróg", nameGen: "twarogu", group: "nabial-tluszcze", grams: { szklanka: 260, lyzka: 15, lyzeczka: 5 } },
  { slug: "ser-zolty-tarty", name: "Ser żółty (tarty)", nameGen: "startego sera żółtego", group: "nabial-tluszcze", grams: { szklanka: 110, lyzka: 7, lyzeczka: 2 } },
  { slug: "olej-rzepakowy", name: "Olej rzepakowy", nameGen: "oleju rzepakowego", group: "nabial-tluszcze", grams: { szklanka: 235, lyzka: 14, lyzeczka: 5 } },
  { slug: "oliwa-z-oliwek", name: "Oliwa z oliwek", nameGen: "oliwy z oliwek", group: "nabial-tluszcze", grams: { szklanka: 230, lyzka: 14, lyzeczka: 5 } },
  { slug: "olej-kokosowy", name: "Olej kokosowy (ciekły)", nameGen: "oleju kokosowego", group: "nabial-tluszcze", grams: { szklanka: 230, lyzka: 14, lyzeczka: 5 } },

  // --- Produkty sypkie ---
  { slug: "platki-owsiane", name: "Płatki owsiane", nameGen: "płatków owsianych", group: "suche", grams: { szklanka: 90, lyzka: 6, lyzeczka: 2 } },
  { slug: "ryz", name: "Ryż (suchy)", nameGen: "suchego ryżu", group: "suche", grams: { szklanka: 210, lyzka: 13, lyzeczka: 4 } },
  { slug: "kasza-gryczana", name: "Kasza gryczana", nameGen: "kaszy gryczanej", group: "suche", grams: { szklanka: 190, lyzka: 12, lyzeczka: 4 } },
  { slug: "kasza-jaglana", name: "Kasza jaglana", nameGen: "kaszy jaglanej", group: "suche", grams: { szklanka: 180, lyzka: 11, lyzeczka: 3 } },
  { slug: "kasza-peczak", name: "Kasza pęczak", nameGen: "kaszy pęczak", group: "suche", grams: { szklanka: 195, lyzka: 12, lyzeczka: 4 } },
  { slug: "kakao", name: "Kakao", nameGen: "kakao", group: "suche", grams: { szklanka: 120, lyzka: 8, lyzeczka: 3 } },
  { slug: "wiorki-kokosowe", name: "Wiórki kokosowe", nameGen: "wiórków kokosowych", group: "suche", grams: { szklanka: 90, lyzka: 6, lyzeczka: 2 } },
  { slug: "migdaly-platki", name: "Płatki migdałów", nameGen: "płatków migdałów", group: "suche", grams: { szklanka: 100, lyzka: 6, lyzeczka: 2 } },
  { slug: "orzechy-wloskie", name: "Orzechy włoskie (posiekane)", nameGen: "posiekanych orzechów włoskich", group: "suche", grams: { szklanka: 120, lyzka: 8, lyzeczka: 3 } },
  { slug: "rodzynki", name: "Rodzynki", nameGen: "rodzynek", group: "suche", grams: { szklanka: 150, lyzka: 9, lyzeczka: 3 } },
  { slug: "daktyle", name: "Daktyle (posiekane)", nameGen: "posiekanych daktyli", group: "suche", grams: { szklanka: 150, lyzka: 10, lyzeczka: 3 } },
  { slug: "siemie-lniane", name: "Siemię lniane", nameGen: "siemienia lnianego", group: "suche", grams: { szklanka: 150, lyzka: 9, lyzeczka: 3 } },
  { slug: "nasiona-chia", name: "Nasiona chia", nameGen: "nasion chia", group: "suche", grams: { szklanka: 170, lyzka: 10, lyzeczka: 3 } },
  { slug: "otreby-pszenne", name: "Otręby pszenne", nameGen: "otrębów pszennych", group: "suche", grams: { szklanka: 60, lyzka: 4, lyzeczka: 1.5 } },
  { slug: "bulka-tarta", name: "Bułka tarta", nameGen: "bułki tartej", group: "suche", grams: { szklanka: 120, lyzka: 7, lyzeczka: 2 } },

  // --- Przyprawy i dodatki (małe objętości) ---
  { slug: "proszek-do-pieczenia", name: "Proszek do pieczenia", nameGen: "proszku do pieczenia", group: "dodatki", grams: { szklanka: null, lyzka: 12, lyzeczka: 4 } },
  { slug: "soda-oczyszczona", name: "Soda oczyszczona", nameGen: "sody oczyszczonej", group: "dodatki", grams: { szklanka: null, lyzka: 14, lyzeczka: 5 } },
  { slug: "drozdze-instant", name: "Drożdże instant", nameGen: "drożdży instant", group: "dodatki", grams: { szklanka: null, lyzka: 9, lyzeczka: 3 } },
  { slug: "zelatyna", name: "Żelatyna w proszku", nameGen: "żelatyny w proszku", group: "dodatki", grams: { szklanka: null, lyzka: 9, lyzeczka: 3 } },
  { slug: "cynamon", name: "Cynamon", nameGen: "cynamonu", group: "dodatki", grams: { szklanka: null, lyzka: 8, lyzeczka: 3 } },

  // --- Płynne bazy ---
  { slug: "woda", name: "Woda", nameGen: "wody", group: "nabial-tluszcze", grams: { szklanka: 250, lyzka: 15, lyzeczka: 5 } },
  { slug: "sok-z-cytryny", name: "Sok z cytryny", nameGen: "soku z cytryny", group: "dodatki", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },
  { slug: "passata", name: "Passata pomidorowa", nameGen: "passaty pomidorowej", group: "dodatki", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },

  // --- Rozszerzenie 2026-09: konwerter to najczęściej cytowany typ strony
  // w odpowiedziach AI (raport GSC), więc dokładamy kolejne popularne składniki ---

  // Mąki i skrobie
  { slug: "maka-owsiana", name: "Mąka owsiana", nameGen: "mąki owsianej", group: "maki", grams: { szklanka: 110, lyzka: 7, lyzeczka: 2 } },
  { slug: "maka-kukurydziana", name: "Mąka kukurydziana", nameGen: "mąki kukurydzianej", group: "maki", grams: { szklanka: 160, lyzka: 10, lyzeczka: 3 } },
  { slug: "maka-ryzowa", name: "Mąka ryżowa", nameGen: "mąki ryżowej", group: "maki", grams: { szklanka: 160, lyzka: 10, lyzeczka: 3 } },
  { slug: "maka-gryczana", name: "Mąka gryczana", nameGen: "mąki gryczanej", group: "maki", grams: { szklanka: 150, lyzka: 10, lyzeczka: 3 } },
  { slug: "skrobia-kukurydziana", name: "Skrobia kukurydziana", nameGen: "skrobi kukurydzianej", group: "maki", grams: { szklanka: 150, lyzka: 10, lyzeczka: 3 } },

  // Cukry i słodziki
  { slug: "cukier-kokosowy", name: "Cukier kokosowy", nameGen: "cukru kokosowego", group: "cukry", grams: { szklanka: 190, lyzka: 11, lyzeczka: 4 } },

  // Nabiał i tłuszcze
  { slug: "kefir", name: "Kefir", nameGen: "kefiru", group: "nabial-tluszcze", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },
  { slug: "maslanka", name: "Maślanka", nameGen: "maślanki", group: "nabial-tluszcze", grams: { szklanka: 255, lyzka: 15, lyzeczka: 5 } },
  { slug: "mleko-kokosowe", name: "Mleko kokosowe (z puszki)", nameGen: "mleka kokosowego", group: "nabial-tluszcze", grams: { szklanka: 240, lyzka: 14, lyzeczka: 5 } },
  { slug: "serek-wiejski", name: "Serek wiejski", nameGen: "serka wiejskiego", group: "nabial-tluszcze", grams: { szklanka: 225, lyzka: 14, lyzeczka: 5 } },
  { slug: "parmezan-tarty", name: "Parmezan (tarty)", nameGen: "startego parmezanu", group: "nabial-tluszcze", grams: { szklanka: 90, lyzka: 6, lyzeczka: 2 } },
  { slug: "maslo-orzechowe", name: "Masło orzechowe", nameGen: "masła orzechowego", group: "nabial-tluszcze", grams: { szklanka: 260, lyzka: 16, lyzeczka: 5 } },
  { slug: "tahini", name: "Tahini (pasta sezamowa)", nameGen: "tahini", group: "nabial-tluszcze", grams: { szklanka: 250, lyzka: 15, lyzeczka: 5 } },

  // Produkty sypkie
  { slug: "kasza-manna", name: "Kasza manna", nameGen: "kaszy manny", group: "suche", grams: { szklanka: 170, lyzka: 10, lyzeczka: 3 } },
  { slug: "kuskus", name: "Kuskus (suchy)", nameGen: "suchego kuskusu", group: "suche", grams: { szklanka: 180, lyzka: 11, lyzeczka: 3 } },
  { slug: "komosa-ryzowa", name: "Komosa ryżowa (quinoa)", nameGen: "komosy ryżowej", group: "suche", grams: { szklanka: 180, lyzka: 11, lyzeczka: 4 } },
  { slug: "kasza-bulgur", name: "Kasza bulgur", nameGen: "kaszy bulgur", group: "suche", grams: { szklanka: 180, lyzka: 11, lyzeczka: 4 } },
  { slug: "platki-jaglane", name: "Płatki jaglane", nameGen: "płatków jaglanych", group: "suche", grams: { szklanka: 100, lyzka: 6, lyzeczka: 2 } },
  { slug: "platki-orkiszowe", name: "Płatki orkiszowe", nameGen: "płatków orkiszowych", group: "suche", grams: { szklanka: 90, lyzka: 6, lyzeczka: 2 } },
  { slug: "platki-kukurydziane", name: "Płatki kukurydziane", nameGen: "płatków kukurydzianych", group: "suche", grams: { szklanka: 30, lyzka: 2, lyzeczka: null } },
  { slug: "otreby-owsiane", name: "Otręby owsiane", nameGen: "otrębów owsianych", group: "suche", grams: { szklanka: 90, lyzka: 6, lyzeczka: 2 } },
  { slug: "soczewica-czerwona", name: "Soczewica czerwona (sucha)", nameGen: "suchej soczewicy czerwonej", group: "suche", grams: { szklanka: 200, lyzka: 13, lyzeczka: 4 } },
  { slug: "mak", name: "Mak", nameGen: "maku", group: "suche", grams: { szklanka: 160, lyzka: 10, lyzeczka: 3 } },
  { slug: "sezam", name: "Sezam", nameGen: "sezamu", group: "suche", grams: { szklanka: 150, lyzka: 9, lyzeczka: 3 } },
  { slug: "slonecznik", name: "Słonecznik (łuskany)", nameGen: "słonecznika łuskanego", group: "suche", grams: { szklanka: 140, lyzka: 9, lyzeczka: 3 } },
  { slug: "pestki-dyni", name: "Pestki dyni", nameGen: "pestek dyni", group: "suche", grams: { szklanka: 130, lyzka: 8, lyzeczka: 3 } },
  { slug: "migdaly", name: "Migdały (całe)", nameGen: "całych migdałów", group: "suche", grams: { szklanka: 150, lyzka: 9, lyzeczka: 3 } },
  { slug: "orzechy-laskowe", name: "Orzechy laskowe", nameGen: "orzechów laskowych", group: "suche", grams: { szklanka: 135, lyzka: 9, lyzeczka: 3 } },
  { slug: "orzechy-nerkowca", name: "Orzechy nerkowca", nameGen: "orzechów nerkowca", group: "suche", grams: { szklanka: 140, lyzka: 9, lyzeczka: 3 } },
  { slug: "zurawina-suszona", name: "Żurawina suszona", nameGen: "suszonej żurawiny", group: "suche", grams: { szklanka: 120, lyzka: 8, lyzeczka: 3 } },
  { slug: "morele-suszone", name: "Morele suszone (posiekane)", nameGen: "posiekanych suszonych moreli", group: "suche", grams: { szklanka: 150, lyzka: 9, lyzeczka: 3 } },
  { slug: "mleko-w-proszku", name: "Mleko w proszku", nameGen: "mleka w proszku", group: "suche", grams: { szklanka: 120, lyzka: 8, lyzeczka: 3 } },

  // Przyprawy i dodatki
  { slug: "sol", name: "Sól", nameGen: "soli", group: "dodatki", grams: { szklanka: null, lyzka: 20, lyzeczka: 7 } },
  { slug: "pieprz-mielony", name: "Pieprz mielony", nameGen: "pieprzu mielonego", group: "dodatki", grams: { szklanka: null, lyzka: 7, lyzeczka: 2 } },
  { slug: "papryka-slodka", name: "Papryka słodka (mielona)", nameGen: "papryki słodkiej", group: "dodatki", grams: { szklanka: null, lyzka: 7, lyzeczka: 2 } },
  { slug: "kurkuma", name: "Kurkuma", nameGen: "kurkumy", group: "dodatki", grams: { szklanka: null, lyzka: 9, lyzeczka: 3 } },
  { slug: "imbir-mielony", name: "Imbir mielony", nameGen: "imbiru mielonego", group: "dodatki", grams: { szklanka: null, lyzka: 6, lyzeczka: 2 } },
  { slug: "oregano-suszone", name: "Oregano suszone", nameGen: "suszonego oregano", group: "dodatki", grams: { szklanka: null, lyzka: 3, lyzeczka: 1 } },
  { slug: "bazylia-suszona", name: "Bazylia suszona", nameGen: "suszonej bazylii", group: "dodatki", grams: { szklanka: null, lyzka: 3, lyzeczka: 1 } },
  { slug: "czosnek-granulowany", name: "Czosnek granulowany", nameGen: "czosnku granulowanego", group: "dodatki", grams: { szklanka: null, lyzka: 10, lyzeczka: 3 } },
  { slug: "kawa-mielona", name: "Kawa mielona", nameGen: "kawy mielonej", group: "dodatki", grams: { szklanka: null, lyzka: 6, lyzeczka: 2 } },
  { slug: "ocet-jablkowy", name: "Ocet jabłkowy", nameGen: "octu jabłkowego", group: "dodatki", grams: { szklanka: 250, lyzka: 15, lyzeczka: 5 } },
  { slug: "sos-sojowy", name: "Sos sojowy", nameGen: "sosu sojowego", group: "dodatki", grams: { szklanka: 265, lyzka: 16, lyzeczka: 5 } },
  { slug: "musztarda", name: "Musztarda", nameGen: "musztardy", group: "dodatki", grams: { szklanka: 250, lyzka: 15, lyzeczka: 5 } },
  { slug: "ketchup", name: "Ketchup", nameGen: "ketchupu", group: "dodatki", grams: { szklanka: 275, lyzka: 17, lyzeczka: 6 } },
  { slug: "koncentrat-pomidorowy", name: "Koncentrat pomidorowy", nameGen: "koncentratu pomidorowego", group: "dodatki", grams: { szklanka: 280, lyzka: 17, lyzeczka: 6 } },
  { slug: "majonez", name: "Majonez", nameGen: "majonezu", group: "dodatki", grams: { szklanka: 230, lyzka: 14, lyzeczka: 5 } },
  { slug: "dzem", name: "Dżem", nameGen: "dżemu", group: "dodatki", grams: { szklanka: 330, lyzka: 20, lyzeczka: 7 } },
];

export function getIngredientBySlug(slug: string): Ingredient | undefined {
  return INGREDIENTS.find((i) => i.slug === slug);
}

// Grams for `amount` of a measure; null when the measure doesn't apply.
export function measureToGrams(ing: Ingredient, measure: MeasureKey, amount: number): number | null {
  const per = ing.grams[measure];
  if (per == null) return null;
  return amount * per;
}

// How many of `measure` fit into `grams`; null when the measure doesn't apply.
export function gramsToMeasure(ing: Ingredient, measure: MeasureKey, grams: number): number | null {
  const per = ing.grams[measure];
  if (!per) return null;
  return grams / per;
}

// Polish plural for countable measures (reuse of the lib/quantity rule):
// 1 szklanka / 2-4 szklanki / 5+ szklanek
export function measureForm(measure: MeasureKey, value: number): string {
  const forms = MEASURES[measure].forms;
  if (value === 1) return forms[0];
  if (!Number.isInteger(value)) return forms[1];
  const d10 = value % 10;
  const d100 = value % 100;
  if (d10 >= 2 && d10 <= 4 && !(d100 >= 12 && d100 <= 14)) return forms[1];
  return forms[2];
}

// "1½" style formatting, consistent with the recipe servings switcher.
export function formatMeasureValue(value: number): string {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 100) / 100;
  const FRAC: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
  const fracStr = FRAC[String(frac)];
  if (fracStr) return whole > 0 ? `${whole}${fracStr}` : fracStr;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

// Gram display: halves under 20 g, integers above, comma as decimal separator.
export function formatGrams(g: number): string {
  const rounded = g < 20 ? Math.round(g * 2) / 2 : Math.round(g);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

export function ingredientPath(ing: Pick<Ingredient, "slug">): string {
  return `/konwerter/${ing.slug}/`;
}
