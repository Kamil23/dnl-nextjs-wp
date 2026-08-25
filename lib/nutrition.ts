// Shared nutrition formulas for the calculator pages. Pure functions only
// (no JSX, no I/O) so they can be unit-tested and reused across the BMR/CPM,
// deficit, macro, BMI and glycemic-load pages. Every page still owns its own
// input parsing and SEO copy; the maths lives here once.

export type Sex = "k" | "m";

export const ACTIVITY_LEVELS = [
  { label: "Znikoma (praca siedząca, brak treningów)", factor: 1.2 },
  { label: "Niska (1–2 treningi w tygodniu)", factor: 1.375 },
  { label: "Umiarkowana (3–4 treningi w tygodniu)", factor: 1.55 },
  { label: "Wysoka (5–6 treningów w tygodniu)", factor: 1.725 },
  { label: "Bardzo wysoka (codzienne treningi / praca fizyczna)", factor: 1.9 },
] as const;

// Mifflin-St Jeor - the same formula the calorie page already used.
export function mifflinBmr(sex: Sex, weightKg: number, heightCm: number, age: number) {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161));
}

export function tdee(bmr: number, activityFactor: number) {
  return Math.round(bmr * activityFactor);
}

// Plausible adult anthropometrics - shared guard so every page rejects the
// same nonsense (0 kg, 3 m tall) before showing a result.
export function validBody(age: number, weightKg: number, heightCm: number) {
  return (
    age > 0 && age < 120 &&
    weightKg > 20 && weightKg < 400 &&
    heightCm > 100 && heightCm < 250
  );
}

// --- BMI ---------------------------------------------------------------

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export type BmiBand = {
  key: "niedowaga" | "norma" | "nadwaga" | "otylosc";
  label: string;
  // inclusive lower / exclusive upper bound (kg/m²)
  min: number;
  max: number;
};

export const BMI_BANDS: BmiBand[] = [
  { key: "niedowaga", label: "Niedowaga", min: 0, max: 18.5 },
  { key: "norma", label: "Waga prawidłowa", min: 18.5, max: 25 },
  { key: "nadwaga", label: "Nadwaga", min: 25, max: 30 },
  { key: "otylosc", label: "Otyłość", min: 30, max: Infinity },
];

export function bmiBand(value: number): BmiBand {
  return BMI_BANDS.find((b) => value >= b.min && value < b.max) ?? BMI_BANDS[BMI_BANDS.length - 1];
}

// Weight (kg) that lands you in the middle of the healthy BMI band - a useful,
// non-medical "target" hint for the BMI page.
export function healthyWeightRange(heightCm: number): [number, number] {
  const m = heightCm / 100;
  return [Math.round(18.5 * m * m), Math.round(24.9 * m * m)];
}

// --- Deficit / goal calories ------------------------------------------

// 1 kg body fat ≈ 7700 kcal. A daily deficit sustained over a week gives the
// weekly-loss estimates on the deficit page. Tiers are the commonly-cited
// safe range; aggressive is capped because deeper cuts risk muscle loss.
export const KCAL_PER_KG_FAT = 7700;

export type DeficitTier = {
  key: "lekki" | "umiarkowany" | "agresywny";
  label: string;
  pct: number; // fraction of TDEE removed
};

export const DEFICIT_TIERS: DeficitTier[] = [
  { key: "lekki", label: "Lekki (~10%)", pct: 0.1 },
  { key: "umiarkowany", label: "Umiarkowany (~20%)", pct: 0.2 },
  { key: "agresywny", label: "Agresywny (~25%)", pct: 0.25 },
];

// Never recommend eating below this - a floor that roughly tracks BMR and the
// commonly-cited minimums (1200 kobiety / 1500 mężczyźni).
export function calorieFloor(sex: Sex) {
  return sex === "m" ? 1500 : 1200;
}

export function deficitTarget(tdeeKcal: number, pct: number, sex: Sex) {
  const raw = Math.round(tdeeKcal * (1 - pct));
  const floor = calorieFloor(sex);
  return { kcal: Math.max(raw, floor), floored: raw < floor };
}

// kg/week implied by a given daily deficit
export function weeklyLoss(dailyDeficitKcal: number) {
  return (dailyDeficitKcal * 7) / KCAL_PER_KG_FAT;
}

// --- Macros ------------------------------------------------------------

export type MacroGoal = "redukcja" | "utrzymanie" | "masa";

// Protein target in g per kg bodyweight. Higher on a cut (satiety + muscle
// retention, matters for the GLP-1 audience), moderate at maintenance.
const PROTEIN_G_PER_KG: Record<MacroGoal, number> = {
  redukcja: 2.0,
  utrzymanie: 1.6,
  masa: 1.8,
};

// Fat as a share of total energy; the rest of the kcal go to carbs.
const FAT_PCT: Record<MacroGoal, number> = {
  redukcja: 0.3,
  utrzymanie: 0.28,
  masa: 0.25,
};

export type Macros = { protein: number; fat: number; carbs: number };

// 4 kcal/g protein & carbs, 9 kcal/g fat. Protein is anchored to bodyweight,
// fat to a share of energy, carbs absorb the remainder (never below 0).
export function macroSplit(kcal: number, goal: MacroGoal, weightKg: number): Macros {
  const protein = Math.round(PROTEIN_G_PER_KG[goal] * weightKg);
  const fat = Math.round((FAT_PCT[goal] * kcal) / 9);
  const carbKcal = kcal - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(carbKcal / 4));
  return { protein, fat, carbs };
}

// --- Glycemic load -----------------------------------------------------

// GL = GI × available carbs (g) / 100. Bands per international convention.
export function glycemicLoad(gi: number, carbsG: number) {
  return (gi * carbsG) / 100;
}

export function glBand(gl: number): { key: "niski" | "sredni" | "wysoki"; label: string } {
  if (gl < 10) return { key: "niski", label: "niski" };
  if (gl <= 19) return { key: "sredni", label: "średni" };
  return { key: "wysoki", label: "wysoki" };
}

export function giBand(gi: number): { key: "niski" | "sredni" | "wysoki"; label: string } {
  if (gi <= 55) return { key: "niski", label: "niski" };
  if (gi <= 69) return { key: "sredni", label: "średni" };
  return { key: "wysoki", label: "wysoki" };
}

// Curated GI/carb reference for common Polish products, per 100 g unless noted.
// Values are typical published figures (orientacyjne - GI varies with ripeness,
// processing and cooking). Used to pre-fill the glycemic-load calculator.
export type GiProduct = {
  slug: string;
  name: string;
  gi: number;
  carbsPer100g: number;
  group: "zboza" | "warzywa" | "owoce" | "nabial" | "straczkowe" | "slodycze";
};

export const GI_PRODUCTS: GiProduct[] = [
  { slug: "ryz-bialy", name: "Ryż biały (ugotowany)", gi: 73, carbsPer100g: 28, group: "zboza" },
  { slug: "ryz-brazowy", name: "Ryż brązowy (ugotowany)", gi: 68, carbsPer100g: 23, group: "zboza" },
  { slug: "kasza-gryczana", name: "Kasza gryczana (ugotowana)", gi: 45, carbsPer100g: 20, group: "zboza" },
  { slug: "platki-owsiane", name: "Płatki owsiane", gi: 55, carbsPer100g: 60, group: "zboza" },
  { slug: "chleb-pszenny", name: "Chleb pszenny jasny", gi: 75, carbsPer100g: 49, group: "zboza" },
  { slug: "chleb-zytni-razowy", name: "Chleb żytni razowy", gi: 50, carbsPer100g: 45, group: "zboza" },
  { slug: "makaron-pszenny", name: "Makaron pszenny (al dente)", gi: 50, carbsPer100g: 25, group: "zboza" },
  { slug: "ziemniaki-gotowane", name: "Ziemniaki gotowane", gi: 78, carbsPer100g: 17, group: "warzywa" },
  { slug: "bataty-pieczone", name: "Bataty pieczone", gi: 63, carbsPer100g: 20, group: "warzywa" },
  { slug: "marchew-gotowana", name: "Marchew gotowana", gi: 39, carbsPer100g: 8, group: "warzywa" },
  { slug: "banan", name: "Banan", gi: 51, carbsPer100g: 23, group: "owoce" },
  { slug: "jablko", name: "Jabłko", gi: 36, carbsPer100g: 14, group: "owoce" },
  { slug: "arbuz", name: "Arbuz", gi: 76, carbsPer100g: 8, group: "owoce" },
  { slug: "truskawki", name: "Truskawki", gi: 40, carbsPer100g: 8, group: "owoce" },
  { slug: "soczewica", name: "Soczewica (ugotowana)", gi: 32, carbsPer100g: 20, group: "straczkowe" },
  { slug: "ciecierzyca", name: "Ciecierzyca (ugotowana)", gi: 28, carbsPer100g: 27, group: "straczkowe" },
  { slug: "jogurt-naturalny", name: "Jogurt naturalny", gi: 36, carbsPer100g: 5, group: "nabial" },
  { slug: "miod", name: "Miód", gi: 61, carbsPer100g: 82, group: "slodycze" },
  { slug: "cukier-bialy", name: "Cukier biały", gi: 65, carbsPer100g: 100, group: "slodycze" },
  { slug: "czekolada-gorzka", name: "Czekolada gorzka (70%)", gi: 22, carbsPer100g: 34, group: "slodycze" },
];
