import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { estimateMacros } from "../../../../lib/server/estimate-macros";

// Estimate per-serving nutrition for the recipe currently in the editor. Works
// on unsaved form data (ingredients come in the request body), so the operator
// can fill kcal/macros before saving.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { title, servings, ingredients } = req.body ?? {};
  const items = Array.isArray(ingredients)
    ? ingredients.map((s: any) => String(s).trim()).filter(Boolean)
    : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "Dodaj składniki, żeby oszacować" });
  }
  try {
    const m = await estimateMacros(
      String(title || "przepis"),
      servings != null && servings !== "" ? Number(servings) : null,
      items
    );
    return res.status(200).json(m);
  } catch (e: any) {
    return res
      .status(502)
      .json({ error: e.message?.slice(0, 200) || "Błąd estymacji" });
  }
}
