import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";
import { db, dbSchema } from "../../lib/db";
import { getUserIdFromRequest } from "../../lib/user-auth";

const { savedRecipes, recipes } = dbSchema;

// Zapisane przepisy zalogowanego czytelnika.
// GET ?recipeId=N → { loggedIn, saved }   (stan serca na stronie przepisu)
// GET             → { loggedIn, ids }     (wszystkie zapisane id)
// POST {recipeId} → toggle; { saved } albo 401 {error:"login"}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = getUserIdFromRequest(req);

  if (req.method === "GET") {
    const recipeIdRaw = req.query.recipeId;
    if (recipeIdRaw !== undefined) {
      const recipeId = parseInt(String(recipeIdRaw), 10);
      if (!Number.isInteger(recipeId) || recipeId <= 0) {
        return res.status(400).json({ error: "Bad request" });
      }
      if (!userId) return res.status(200).json({ loggedIn: false, saved: false });
      const [row] = await db
        .select({ id: savedRecipes.id })
        .from(savedRecipes)
        .where(and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId)));
      return res.status(200).json({ loggedIn: true, saved: !!row });
    }
    if (!userId) return res.status(200).json({ loggedIn: false, ids: [] });
    const rows = await db
      .select({ recipeId: savedRecipes.recipeId })
      .from(savedRecipes)
      .where(eq(savedRecipes.userId, userId));
    return res.status(200).json({ loggedIn: true, ids: rows.map((r) => r.recipeId) });
  }

  if (req.method === "POST") {
    if (!userId) return res.status(401).json({ error: "login" });
    const recipeId = parseInt(req.body?.recipeId, 10);
    if (!Number.isInteger(recipeId) || recipeId <= 0) {
      return res.status(400).json({ error: "Bad request" });
    }

    // Toggle: najpierw próbujemy zdjąć zapis, jeśli nic nie zeszło - dodajemy
    const deleted = await db
      .delete(savedRecipes)
      .where(and(eq(savedRecipes.userId, userId), eq(savedRecipes.recipeId, recipeId)))
      .returning({ id: savedRecipes.id });
    if (deleted.length > 0) return res.status(200).json({ saved: false });

    const [recipe] = await db
      .select({ id: recipes.id, status: recipes.status })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    if (!recipe || recipe.status !== "published") {
      return res.status(404).json({ error: "Not found" });
    }

    // onConflictDoNothing: podwójny klik nie wywali się na unikalnym indeksie
    await db
      .insert(savedRecipes)
      .values({ userId, recipeId })
      .onConflictDoNothing({ target: [savedRecipes.userId, savedRecipes.recipeId] });
    return res.status(200).json({ saved: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
