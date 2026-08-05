// AI estimation of per-serving nutrition from an ingredient list. Server-only
// (uses the OpenAI key). Shared by the admin "estimate" button, the one-shot
// backfill script (scripts/estimate-macros.ts) and the TikTok import fallback.

export type MacroEstimate = {
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  assumedServings: number;
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
            "Jesteś dietetykiem. Szacujesz wartości odżywcze przepisu NA JEDNĄ PORCJĘ na podstawie listy składników. " +
            'Zwracasz WYŁĄCZNIE JSON: {"kcal": int, "protein": number, "fat": number, "carbs": number, "assumedServings": int}. ' +
            "assumedServings = liczba porcji użyta do podziału (podana albo Twoje realistyczne założenie, np. ciasto ~12 kawałków). " +
            "Wartości realistyczne; gramy zaokrąglaj do 1 miejsca.",
        },
        {
          role: "user",
          content: `Przepis: ${title}\nLiczba porcji: ${
            servings ?? "nieznana — załóż realistyczną i zwróć w assumedServings"
          }\nSkładniki:\n${items.join("\n")}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const m = JSON.parse(
    json.choices[0].message.content.replace(/^```json?\s*|\s*```$/g, "")
  );
  if (!m.kcal || m.kcal < 20 || m.kcal > 3000) {
    throw new Error(`podejrzane kcal: ${m.kcal}`);
  }
  return {
    kcal: Math.round(m.kcal),
    protein: m.protein != null ? Number(m.protein) : null,
    fat: m.fat != null ? Number(m.fat) : null,
    carbs: m.carbs != null ? Number(m.carbs) : null,
    assumedServings: m.assumedServings > 0 ? Math.round(m.assumedServings) : 0,
  };
}
