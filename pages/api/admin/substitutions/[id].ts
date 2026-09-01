// Moderacja zamienników: PATCH {status: approved|rejected} z opcjonalną
// drobną edycją {substitute, effect, kcalDelta} przed akceptem.
// Zaakceptowany wiersz zmienia publiczną stronę przepisu, więc odświeżamy ISR.
import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";

const { substitutions, recipes } = dbSchema;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad request" });

  const { status, substitute, effect, kcalDelta } = req.body ?? {};
  const patch: Partial<typeof substitutions.$inferInsert> = {};

  if (status !== undefined) {
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Nieprawidłowy status" });
    }
    patch.status = status;
  }
  if (substitute !== undefined) {
    if (typeof substitute !== "string" || !substitute.trim()) {
      return res.status(400).json({ error: "Zamiennik nie może być pusty" });
    }
    patch.substitute = substitute.trim();
  }
  if (effect !== undefined) {
    if (effect !== null && typeof effect !== "string") {
      return res.status(400).json({ error: "Nieprawidłowy efekt" });
    }
    patch.effect = typeof effect === "string" && effect.trim() ? effect.trim() : null;
  }
  if (kcalDelta !== undefined) {
    if (kcalDelta !== null && !Number.isFinite(Number(kcalDelta))) {
      return res.status(400).json({ error: "Nieprawidłowa zmiana kcal" });
    }
    patch.kcalDelta = kcalDelta === null ? null : Math.round(Number(kcalDelta));
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "Brak zmian" });
  }

  const [row] = await db
    .update(substitutions)
    .set(patch)
    .where(eq(substitutions.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });

  // Akcept trafia na stronę przepisu (ISR) - odśwież ją od razu
  if (patch.status === "approved") {
    const [recipe] = await db
      .select({ uri: recipes.uri })
      .from(recipes)
      .where(eq(recipes.id, row.recipeId));
    if (recipe) {
      try {
        await res.revalidate(recipe.uri);
      } catch {}
    }
  }

  return res.json(row);
}
