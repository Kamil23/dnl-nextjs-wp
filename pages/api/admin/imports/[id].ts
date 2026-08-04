import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { slugify } from "../../../../lib/slugify";
import { syncRecipeToSearch } from "../../../../lib/search-sync";

const { imports, recipes, ingredientGroups, ingredients, steps, tags, recipeTags, categories, recipeCategories } = dbSchema;

// "Kilka słów o tym przepisie" arrives as plain paragraphs — wrap in <p>
function aboutToHtml(about: unknown): string | null {
  if (typeof about !== "string" || !about.trim()) return null;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return about
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  const [imp] = await db.select().from(imports).where(eq(imports.id, id));
  if (!imp) return res.status(404).json({ error: "Not found" });

  if (req.method === "DELETE") {
    await db.delete(imports).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const action = req.body?.action;

  if (action === "reject") {
    await db.update(imports).set({ status: "rejected" }).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (action === "retry") {
    await db.update(imports).set({ status: "pending", operatorNotes: null }).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (action === "accept") {
    if (imp.status !== "ready" || !imp.aiDraft) {
      return res.status(400).json({ error: "Draft nie jest gotowy" });
    }
    const d = imp.aiDraft as any;
    const slug = slugify(d.title || `tiktok-${id}`);
    const heroImage =
      (typeof req.body?.heroImage === "string" && req.body.heroImage) ||
      d.frames?.[0] ||
      null;

    const recipeId = await db.transaction(async (tx) => {
      const [recipe] = await tx
        .insert(recipes)
        .values({
          title: d.title,
          slug,
          uri: `/przepisy/${slug}/`,
          status: "draft",
          source: "tiktok",
          heroImage,
          sponsor: d.sponsor ?? null,
          lead: d.lead ?? null,
          contentHtml: aboutToHtml(d.about),
          difficulty: ["latwy", "sredni", "trudny"].includes(d.difficulty) ? d.difficulty : null,
          videoUrl: imp.tiktokUrl,
          videoDurationSec: d.videoDurationSec ?? null,
          videoViews: Number.isFinite(d.videoViews) ? d.videoViews : null,
          authorName: "Roksana",
          prepTimeMin: d.prepTimeMin ?? null,
          totalTimeMin: d.totalTimeMin ?? null,
          servings: d.servings ?? null,
          kcal: d.kcal ?? null,
          protein: d.protein?.toString() ?? null,
          fat: d.fat?.toString() ?? null,
          carbs: d.carbs?.toString() ?? null,
          keywords: d.keywords ?? null,
          seoTitle: d.seoTitle ?? null,
          seoDescription: d.seoDescription ?? null,
          publishedAt: new Date(),
        })
        .returning({ id: recipes.id });

      let gPos = 0;
      for (const g of d.ingredientGroups ?? []) {
        const items = (g.items ?? []).filter(Boolean);
        if (!items.length) continue;
        const [group] = await tx
          .insert(ingredientGroups)
          .values({ recipeId: recipe.id, title: g.title ?? null, position: gPos++ })
          .returning({ id: ingredientGroups.id });
        await tx.insert(ingredients).values(
          items.map((rawText: string, i: number) => ({ groupId: group.id, rawText, position: i }))
        );
      }

      const stepRows = (d.steps ?? []).filter((s: any) => s.body);
      if (stepRows.length) {
        await tx.insert(steps).values(
          stepRows.map((s: any, i: number) => ({
            recipeId: recipe.id,
            position: i,
            title: s.title ?? null,
            body: s.body,
            tip: s.tip ?? null,
          }))
        );
      }

      // Category links: the chosen subcategories plus the "Przepisy" parent
      // (the WP convention every archive/tile query builds on)
      const slugs: string[] = Array.isArray(d.categorySlugs) ? d.categorySlugs.filter(Boolean) : [];
      const catRows = slugs.length
        ? await tx.select().from(categories).where(inArray(categories.slug, slugs))
        : [];
      const catIds = new Set(catRows.map((c) => c.id));
      for (const c of catRows) {
        if (c.parentId != null) catIds.add(c.parentId);
      }
      if (catIds.size) {
        await tx.insert(recipeCategories).values(
          Array.from(catIds).map((categoryId) => ({ recipeId: recipe.id, categoryId }))
        );
      }

      // Strict vocabulary: the AI may only attach existing curated tags
      // (group != null). New drafts send slugs; older ones sent names, so
      // slugify covers both. Unknown tags are dropped, never created.
      const wantedTagSlugs = Array.from(
        new Set(
          (Array.isArray(d.tags) ? d.tags : [])
            .map((t: unknown) => slugify(String(t ?? "").trim()))
            .filter(Boolean)
        )
      ) as string[];
      if (wantedTagSlugs.length) {
        const allowed = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(and(inArray(tags.slug, wantedTagSlugs), isNotNull(tags.group)));
        if (allowed.length) {
          await tx
            .insert(recipeTags)
            .values(allowed.map((t) => ({ recipeId: recipe.id, tagId: t.id })));
        }
      }

      await tx
        .update(imports)
        .set({ status: "approved", recipeId: recipe.id })
        .where(eq(imports.id, id));

      return recipe.id;
    });

    await syncRecipeToSearch(db, recipeId);
    return res.json({ ok: true, recipeId });
  }

  return res.status(400).json({ error: "Unknown action" });
}
