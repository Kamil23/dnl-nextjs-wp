// AI estimation of per-serving nutrition from an ingredient list. Server-only
// (uses the OpenAI key). Shared by the admin "estimate" button, the one-shot
// backfill script (scripts/estimate-macros.ts) and the TikTok import fallback.

export type MacroEstimate = {
  // NA PORCJĘ, licząc przez efektywną liczbę porcji (podaną albo — gdy brak —
  // assumedServings). Zachowuje kontrakt dla dotychczasowych wywołań.
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  // Niezależna, realistyczna ocena liczby porcji przez AI (może różnić się od
  // podanej — edytor/QC to wykorzystują, żeby wychwycić np. "1 porcja = 1394 kcal").
  assumedServings: number;
  // Sumy dla CAŁEGO przepisu — pozwalają przeliczyć makra pod dowolną liczbę porcji.
  totalKcal: number;
  totalProtein: number | null;
  totalFat: number | null;
  totalCarbs: number | null;
};

export async function estimateMacros(
  title: string,
  servings: number | null,
  items: string[]
): Promise<MacroEstimate> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Brak OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Jesteś dietetykiem. Na podstawie listy składników szacujesz wartości odżywcze dla CAŁEGO przepisu (suma) " +
            "oraz realistyczną liczbę porcji. " +
            'Zwracasz WYŁĄCZNIE JSON: {"kcalTotal": int, "proteinTotal": number, "fatTotal": number, "carbsTotal": number, "assumedServings": int}. ' +
            "assumedServings = Twoja NIEZALEŻNA, realistyczna ocena, na ile porcji dzieli się ten przepis (po ilości i typie potrawy, " +
            "np. ciasto 8–12 kawałków, deser jednoporcjowy 1–2, obiad z 500 g mięsa ~4). Oceniaj sam, nawet jeśli autor poda inną liczbę. " +
            "Sumy liczysz dla całości; gramy zaokrąglaj do 1 miejsca.",
        },
        {
          role: "user",
          content: `Przepis: ${title}\nLiczba porcji podana przez autora: ${
            servings ?? "nieznana"
          } (oceń realistyczną samodzielnie)\nSkładniki:\n${items.join("\n")}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const m = JSON.parse(
    json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, "")
  );
  const totalKcal = Number(m.kcalTotal);
  if (!totalKcal || totalKcal < 20 || totalKcal > 20000) {
    throw new Error(`podejrzane kcalTotal: ${m.kcalTotal}`);
  }
  const assumed = m.assumedServings > 0 ? Math.round(m.assumedServings) : 1;
  // Efektywna liczba porcji do podziału: preferuj podaną przez autora, w jej
  // braku użyj oceny AI. (Edytor pokazuje rozbieżność i pozwala ją zastosować.)
  const eff = servings && servings > 0 ? servings : assumed;

  const totalProtein = m.proteinTotal != null ? Number(m.proteinTotal) : null;
  const totalFat = m.fatTotal != null ? Number(m.fatTotal) : null;
  const totalCarbs = m.carbsTotal != null ? Number(m.carbsTotal) : null;
  const per = (v: number | null) => (v != null ? Math.round((v / eff) * 10) / 10 : null);

  return {
    kcal: Math.round(totalKcal / eff),
    protein: per(totalProtein),
    fat: per(totalFat),
    carbs: per(totalCarbs),
    assumedServings: assumed,
    totalKcal: Math.round(totalKcal),
    totalProtein,
    totalFat,
    totalCarbs,
  };
}
