import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db, dbSchema } from "../../../../lib/db";
import { slugify } from "../../../../lib/slugify";
import { syncRecipeToSearch } from "../../../../lib/search-sync";
import { frameUrls, ingredientLines, type ImportDraft } from "../../../../lib/import-draft";
import { reviewDraft } from "../../../../lib/import-review";
import { recompute, type NutritionBreakdown, type NutritionItem } from "../../../../lib/nutrition-calc";
import { getAiModels, isValidModelId } from "../../../../lib/server/ai-models";
import { buildBreakdown } from "../../../../lib/server/nutrition-ai";
import { refineDraft } from "../../../../lib/server/refine-draft";
import { parseShoppingLine } from "../../../../lib/quantity";
import { textToHtml } from "../../../../lib/html-text";
import { applyOps, touchesIngredients, type RecipeChange, type RecipeText } from "../../../../lib/recipe-ops";
import { breakdownItemsFor } from "../../../../lib/server/nutrition-ai";

const { imports, recipes, ingredientGroups, ingredients, steps, tags, recipeTags, categories, recipeCategories } = dbSchema;

// "Kilka słów o tym przepisie" arrives as plain paragraphs - wrap in <p>
const aboutToHtml = (about: unknown) => textToHtml(typeof about === "string" ? about : null);

function draftToRecipeText(d: ImportDraft): RecipeText {
  return {
    title: d.title ?? "",
    lead: d.lead ?? "",
    about: d.about ?? "",
    ingredientGroups: (d.ingredientGroups ?? []).map((g) => ({ title: g.title ?? null, items: [...(g.items ?? [])] })),
    steps: (d.steps ?? []).map((st) => ({ title: st.title ?? null, body: st.body, tip: st.tip ?? null })),
    servings: d.servings ?? null,
    prepTimeMin: d.prepTimeMin ?? null,
    totalTimeMin: d.totalTimeMin ?? null,
    difficulty: d.difficulty ?? null,
  };
}

const num = (v: unknown): number | null => {
  if (v === null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

// Przeliczenie pól na porcję z rozbicia + świeży audyt; jedno miejsce, żeby
// każda akcja (patch/refine/recalc) zostawiała draft w spójnym stanie
function finalize(d: ImportDraft): ImportDraft {
  const next = { ...d };
  if (next.nutrition?.perServing) {
    next.kcal = next.nutrition.perServing.kcal;
    next.protein = next.nutrition.perServing.protein;
    next.fat = next.nutrition.perServing.fat;
    next.carbs = next.nutrition.perServing.carbs;
    if (next.nutrition.servings) next.servings = next.nutrition.servings;
  }
  next.review = reviewDraft(next);
  return next;
}

async function saveDraft(id: number, d: ImportDraft) {
  await db.update(imports).set({ aiDraft: d }).where(eq(imports.id, id));
  return d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });

  const [imp] = await db.select().from(imports).where(eq(imports.id, id));
  if (!imp) return res.status(404).json({ error: "Not found" });
  const draft = (imp.aiDraft ?? null) as ImportDraft | null;

  if (req.method === "DELETE") {
    // Klatki leżą na wolumenie mediów, do którego web ma tylko odczyt: gdy są,
    // wiersz zostaje jako rejected ze zleceniem dla workera (kasuje pliki i wiersz)
    if (draft && frameUrls(draft).length) {
      await db
        .update(imports)
        .set({ status: "rejected", aiDraft: { ...draft, cleanupRequest: { keep: [], deleteRow: true } } })
        .where(eq(imports.id, id));
      return res.json({ ok: true, deferred: true });
    }
    await db.delete(imports).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const action = req.body?.action;

  if (action === "reject") {
    const patch = draft && frameUrls(draft).length ? { aiDraft: { ...draft, cleanupRequest: { keep: [] } } } : {};
    await db.update(imports).set({ status: "rejected", ...patch }).where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  // Ponowienie po błędzie albo po odrzuceniu: od nowa, bez starego draftu.
  // Pliki z poprzedniego przebiegu worker wymienia przy publikacji klatek.
  if (action === "retry") {
    if (!["failed", "rejected"].includes(imp.status)) {
      return res.status(400).json({ error: "Ponowić można tylko import nieudany lub odrzucony" });
    }
    await db
      .update(imports)
      .set({ status: "pending", operatorNotes: null, aiDraft: null, progress: null, recipeId: null })
      .where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  // Duplicate override: requeue with force=true so the worker skips the dedup
  // check; recipeId pointed at the duplicated recipe, so clear it
  if (action === "force") {
    if (imp.status !== "duplicate") {
      return res.status(400).json({ error: "Ten import nie jest duplikatem" });
    }
    await db
      .update(imports)
      .set({ status: "pending", force: true, recipeId: null, operatorNotes: null })
      .where(eq(imports.id, id));
    return res.json({ ok: true });
  }

  // Od tego miejsca każda akcja wymaga gotowego draftu
  if (imp.status !== "ready" || !draft) {
    return res.status(400).json({ error: "Draft nie jest gotowy" });
  }
  const frames = frameUrls(draft);

  // On-demand hero cleanup: the operator picked a frame and hit "Generuj AI
  // hero". Web can't do the image work itself (media is mounted ro here and the
  // frame dirs are root-owned by the worker), so we just record the request on
  // the draft; the worker picks it up (has the media rw + the image key) and
  // writes heroEnhanced back. The admin polls until it appears.
  if (action === "enhance") {
    const frame = typeof req.body?.frame === "string" ? req.body.frame : "";
    // Whitelist to a known published frame - also blocks path traversal
    if (!frames.includes(frame)) {
      return res.status(400).json({ error: "Nieznana klatka" });
    }
    await saveDraft(id, { ...draft, enhanceRequest: { frame }, enhanceError: null });
    return res.status(202).json({ ok: true, queued: true });
  }

  // Ponowne dobranie klatek do kroków: worker ma pliki klatek, web nie
  if (action === "reassign-frames") {
    await saveDraft(id, { ...draft, reassignRequest: true, reassignError: null });
    return res.status(202).json({ ok: true, queued: true });
  }

  // Punktowe poprawki operatora w drafcie (klatka kroku, gramy, porcje, czasy)
  if (action === "patch") {
    const p = req.body?.patch ?? {};
    let next: ImportDraft = { ...draft };

    if (Array.isArray(p.steps)) {
      next.steps = next.steps.map((st, i) => {
        const change = p.steps.find((x: any) => Number(x?.i) === i);
        if (!change || !("image" in change)) return st;
        const img = change.image;
        if (img !== null && !frames.includes(img)) return st;
        return { ...st, image: img };
      });
    }
    if ("heroFrame" in p && (p.heroFrame === null || frames.includes(p.heroFrame))) {
      next.heroFrame = p.heroFrame;
    }
    if ("servings" in p) {
      const s = num(p.servings);
      next.servings = s && s > 0 ? Math.round(s) : null;
      if (next.nutrition) {
        next.nutrition = recompute(next.nutrition, { servings: next.servings, servingsSource: "operator" });
      }
    }
    if ("prepTimeMin" in p) next.prepTimeMin = num(p.prepTimeMin);
    if ("totalTimeMin" in p) next.totalTimeMin = num(p.totalTimeMin);
    if (p.nutrition && next.nutrition && Array.isArray(p.nutrition.items)) {
      const items: NutritionItem[] = next.nutrition.items.map((it, i) => {
        const change = p.nutrition.items.find((x: any) => Number(x?.i) === i);
        if (!change) return it;
        const out = { ...it };
        if ("grams" in change) {
          const g = num(change.grams);
          out.grams = g != null && g >= 0 ? g : null;
          out.gramsSource = "operator";
        }
        if ("excluded" in change) out.excluded = !!change.excluded;
        if (change.per100 && typeof change.per100 === "object") {
          const kcal = num(change.per100.kcal);
          const protein = num(change.per100.protein);
          const fat = num(change.per100.fat);
          const carbs = num(change.per100.carbs);
          if (kcal != null && protein != null && fat != null && carbs != null) {
            out.per100 = { kcal, protein, fat, carbs };
          }
        }
        return out;
      });
      next.nutrition = recompute(next.nutrition, { items });
    }
    // Ręczne wartości na porcję, gdy nie ma rozbicia (np. brak klucza OpenAI)
    if (!next.nutrition && p.manualNutrition) {
      const m = p.manualNutrition;
      if ("kcal" in m) next.kcal = num(m.kcal);
      if ("protein" in m) next.protein = num(m.protein);
      if ("fat" in m) next.fat = num(m.fat);
      if ("carbs" in m) next.carbs = num(m.carbs);
    }
    next = finalize(next);
    await saveDraft(id, next);
    return res.json({ ok: true, draft: next });
  }

  // Dopełnianie braków mocniejszym modelem (tekst, synchronicznie)
  if (action === "refine") {
    try {
      const models = await getAiModels(db);
      const model = isValidModelId(req.body?.model) ? req.body.model : models.refine;
      const review = reviewDraft(draft);
      const r = await refineDraft({
        draft,
        caption: imp.caption,
        transcript: imp.transcript,
        issues: review.issues,
        model,
      });
      let next: ImportDraft = {
        ...r.draft,
        aiFilled: [...(draft.aiFilled ?? []), ...r.filled],
        refinedWith: r.model,
        models: { ...(draft.models ?? {}), refine: r.model },
      };
      // składniki mogły się zmienić: rozbicie przestaje być aktualne
      const before = ingredientLines(draft).join("\n");
      const after = ingredientLines(next).join("\n");
      if (before !== after && next.nutrition) {
        next.nutrition = {
          ...next.nutrition,
          issues: [
            ...next.nutrition.issues.filter((i) => i.code !== "stale"),
            { severity: "warning", code: "stale", message: "Składniki zmieniły się po dopełnieniu; policz wartości odżywcze ponownie.", field: "ingredients" },
          ],
        };
      }
      next = finalize(next);
      await saveDraft(id, next);
      return res.json({ ok: true, draft: next, filled: r.filled.length });
    } catch (e: any) {
      return res.status(502).json({ error: e.message?.slice(0, 300) || "Dopełnianie nieudane" });
    }
  }

  // Wartości odżywcze: pełne rozbicie od nowa wybranym modelem (tekst, synchronicznie)
  if (action === "recalc-nutrition") {
    const lines = ingredientLines(draft);
    if (!lines.length) return res.status(400).json({ error: "Draft nie ma składników" });
    try {
      const models = await getAiModels(db);
      const model = isValidModelId(req.body?.model) ? req.body.model : models.nutrition;
      const servings = draft.servings && draft.servings > 0 ? draft.servings : null;
      const nutrition: NutritionBreakdown = await buildBreakdown({
        title: draft.title,
        lines,
        servings,
        servingsSource: servings ? draft.nutrition?.servingsSource ?? "draft" : undefined,
        context: imp.caption?.slice(0, 600) ?? null,
        model,
        draftPerServing: draft.nutrition?.draftPerServing ?? null,
      });
      const next = finalize({ ...draft, nutrition, models: { ...(draft.models ?? {}), nutrition: model } });
      await saveDraft(id, next);
      return res.json({ ok: true, draft: next });
    } catch (e: any) {
      return res.status(502).json({ error: e.message?.slice(0, 300) || "Przeliczenie nieudane" });
    }
  }

  // "Popraw wg instrukcji": operator zatwierdził operacje z podglądu
  // (POST /api/admin/recipes/instruct). Nakładamy je na draft, kroki zachowują
  // zdjęcia/okna czasowe po pozycji wejściowej, a dla zmienionych linii
  // składników liczymy rozbicie odżywcze tylko dla nowych pozycji.
  if (action === "apply-ops") {
    const ops: RecipeChange[] = (Array.isArray(req.body?.ops) ? req.body.ops : []).filter(
      (o: any) => o && typeof o.path === "string" && ["set", "add", "remove"].includes(o.op)
    );
    if (!ops.length) return res.status(400).json({ error: "Brak operacji" });
    const instruction = String(req.body?.instruction ?? "").trim().slice(0, 1000);
    const before = draftToRecipeText(draft);
    const result = applyOps(before, ops);
    if (!result.applied.length) {
      return res.status(400).json({ error: "Żadna operacja nie przeszła walidacji", rejected: result.rejected });
    }
    const after = result.recipe;

    // Kroki: dopasuj metadane (zdjęcie, kandydaci, czas) po pozycji WEJŚCIOWEJ,
    // śledząc add/remove w kolejności, w jakiej applyOps je nakłada
    const stepMeta = draft.steps.map((st) => ({ image: st.image ?? null, frameCandidates: st.frameCandidates ?? [], startSec: st.startSec ?? null, endSec: st.endSec ?? null }));
    const metaByOutput: (typeof stepMeta[number] | null)[] = [...stepMeta];
    const stepAdds = result.applied
      .filter((o) => o.op === "add" && o.path === "steps")
      .sort((a: any, b: any) => (a.index ?? 1e9) - (b.index ?? 1e9));
    let shift = 0;
    for (const a of stepAdds as any[]) {
      const at = a.index == null || a.index < 0 || a.index > stepMeta.length ? metaByOutput.length : a.index + shift;
      metaByOutput.splice(at, 0, null);
      shift++;
    }
    const stepRemoves = result.applied.filter((o) => o.op === "remove" && /^steps\[\d+\]$/.test(o.path));
    const removedInput = new Set(stepRemoves.map((o) => Number(o.path.match(/\d+/)![0])));
    // pozycje wejściowe usuniętych → po przesunięciu add
    const outputRemovals: number[] = [];
    for (const ri of removedInput) {
      let adj = ri;
      for (const a of stepAdds as any[]) {
        const w = a.index == null ? 1e9 : a.index;
        if (w <= ri) adj++;
      }
      outputRemovals.push(adj);
    }
    for (const idx of outputRemovals.sort((a, b) => b - a)) metaByOutput.splice(idx, 1);

    let next: ImportDraft = {
      ...draft,
      title: after.title,
      lead: after.lead,
      about: after.about ?? draft.about,
      ingredientGroups: after.ingredientGroups,
      steps: after.steps.map((st, i) => ({
        title: st.title,
        body: st.body,
        tip: st.tip,
        image: metaByOutput[i]?.image ?? null,
        frameCandidates: metaByOutput[i]?.frameCandidates ?? [],
        startSec: metaByOutput[i]?.startSec ?? null,
        endSec: metaByOutput[i]?.endSec ?? null,
      })),
      servings: after.servings,
      prepTimeMin: after.prepTimeMin,
      totalTimeMin: after.totalTimeMin,
      difficulty: after.difficulty,
      aiFilled: [
        ...(draft.aiFilled ?? []),
        ...result.applied
          .filter((o) => o.kind === "consequence")
          .map((o) => ({
            field: o.path,
            value: o.op === "remove" ? "(usunięto)" : (o as any).value,
            reason: o.reason || `konsekwencja instrukcji: ${instruction}`,
            basis: "instruction" as const,
          })),
      ],
      instructions: [...(draft.instructions ?? []), { at: new Date().toISOString(), text: instruction, applied: result.applied.length }],
    };

    // Rozbicie odżywcze: zostawiamy pozycje dla niezmienionych linii (w tym
    // ręczne gramy operatora), liczymy tylko nowe/zmienione
    let recalcNote = "";
    if (touchesIngredients(result.applied)) {
      const newLines = ingredientLines(next);
      const oldItems = new Map<string, NutritionItem>();
      for (const it of draft.nutrition?.items ?? []) if (!oldItems.has(it.line.trim())) oldItems.set(it.line.trim(), it);
      const missing = newLines.filter((l) => !oldItems.has(l.trim()));
      let fresh: NutritionItem[] = [];
      if (missing.length && process.env.OPENAI_API_KEY) {
        try {
          const models = await getAiModels(db);
          fresh = await breakdownItemsFor({ title: next.title, lines: missing, context: imp.caption?.slice(0, 600) ?? null, model: models.nutrition });
        } catch (e: any) {
          recalcNote = ` Nie udało się policzyć nowych składników: ${e.message?.slice(0, 120)}.`;
        }
      }
      const freshByLine = new Map(fresh.map((it) => [it.line.trim(), it]));
      const items: NutritionItem[] = newLines.map(
        (l) =>
          oldItems.get(l.trim()) ??
          freshByLine.get(l.trim()) ?? { line: l, name: l, grams: null, gramsSource: "ai-estimate", per100: null, assumption: null }
      );
      if (draft.nutrition) {
        next.nutrition = recompute(draft.nutrition, { items, servings: next.servings ?? draft.nutrition.servings });
      }
    }
    next = finalize(next);
    await saveDraft(id, next);
    const kcalBefore = draft.kcal ?? null;
    const kcalAfter = next.kcal ?? null;
    const msg =
      `Zapisano ${result.applied.length} zmian.` +
      (touchesIngredients(result.applied) && kcalBefore != null && kcalAfter != null && kcalBefore !== kcalAfter
        ? ` Wartości odżywcze: ${kcalBefore} → ${kcalAfter} kcal/porcję.`
        : "") +
      recalcNote;
    return res.json({ ok: true, draft: next, applied: result.applied.length, rejected: result.rejected, message: msg });
  }

  if (action === "accept") {
    const d = finalize(draft);
    // Blokada niezależna od UI: błędy zawsze, ostrzeżenia bez potwierdzenia
    if (d.review?.blocking) {
      return res.status(400).json({
        error: "Draft ma błędy blokujące: " + d.review.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" "),
        review: d.review,
      });
    }
    if (d.review && d.review.issues.length && req.body?.confirmed !== true) {
      return res.status(400).json({ error: "Potwierdź, że sprawdziłeś ostrzeżenia (porcje i wartości odżywcze).", review: d.review });
    }

    // slug/uri are unique - a re-imported recipe (same title as an existing
    // one) must land under a suffixed slug instead of blowing up the insert
    const baseSlug = slugify(d.title || `tiktok-${id}`) || `tiktok-${id}`;
    const taken = new Set(
      (
        await db
          .select({ slug: recipes.slug })
          .from(recipes)
          .where(like(recipes.slug, `${baseSlug}%`))
      ).map((r) => r.slug)
    );
    let slug = baseSlug;
    for (let n = 2; taken.has(slug); n++) slug = `${baseSlug}-${n}`;
    // Operator's pick wins; otherwise the AI-enhanced hero variant when the
    // worker produced one, then the frame the AI flagged as the best hero
    // shot, falling back to the first frame
    const heroImage =
      (typeof req.body?.heroImage === "string" && req.body.heroImage) ||
      d.heroEnhanced ||
      d.heroFrame ||
      frames[0] ||
      null;

    // Gramatura per składnik z rozbicia -> kolumny amount/unit/name
    const byLine = new Map<string, NutritionItem>();
    for (const it of d.nutrition?.items ?? []) byLine.set(it.line.trim(), it);

    let acceptError: unknown = null;
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
          difficulty: ["latwy", "sredni", "trudny"].includes(d.difficulty as string) ? (d.difficulty as any) : null,
          videoUrl: imp.tiktokUrl,
          videoDurationSec: d.videoDurationSec ?? null,
          videoViews: Number.isFinite(d.videoViews as number) ? d.videoViews : null,
          authorName: "Roksana",
          prepTimeMin: d.prepTimeMin != null ? Math.round(d.prepTimeMin) : null,
          totalTimeMin: d.totalTimeMin != null ? Math.round(d.totalTimeMin) : null,
          servings: d.servings != null ? Math.round(d.servings) : null,
          kcal: d.kcal != null ? Math.round(d.kcal) : null,
          protein: d.protein?.toString() ?? null,
          fat: d.fat?.toString() ?? null,
          carbs: d.carbs?.toString() ?? null,
          keywords: d.keywords ?? null,
          seoTitle: d.seoTitle ?? null,
          seoDescription: d.seoDescription ?? null,
          reviewMeta: {
            confidence: d.confidence,
            notes: d.notes ?? null,
            aiFilled: d.aiFilled ?? [],
            issues: d.review?.issues ?? [],
            models: d.models ?? null,
            importId: id,
            acceptedAt: new Date().toISOString(),
          },
          nutritionBreakdown: d.nutrition ?? null,
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
          items.map((rawText: string, i: number) => {
            const it = byLine.get(rawText.trim());
            const parsed = parseShoppingLine(rawText);
            return {
              groupId: group.id,
              rawText,
              position: i,
              amount: it?.grams != null ? String(it.grams) : parsed.qty != null ? String(parsed.qty) : null,
              unit: it?.grams != null ? "g" : parsed.kind === "count" && parsed.forms ? parsed.forms[0] : parsed.kind === "volume" ? "ml" : null,
              name: it?.name ?? (parsed.name || null),
            };
          })
        );
      }

      const stepRows = (d.steps ?? []).filter((s) => s.body);
      if (stepRows.length) {
        await tx.insert(steps).values(
          stepRows.map((s, i) => ({
            recipeId: recipe.id,
            position: i,
            title: s.title ?? null,
            body: s.body,
            tip: s.tip ?? null,
            image: s.image ?? null,
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

      // Sprzątanie: zostają tylko klatki, których przepis używa
      const keep = Array.from(
        new Set([heroImage, d.heroEnhanced, ...stepRows.map((s) => s.image)].filter((u): u is string => !!u))
      );
      await tx
        .update(imports)
        .set({ status: "approved", recipeId: recipe.id, aiDraft: { ...d, cleanupRequest: { keep } } })
        .where(eq(imports.id, id));

      return recipe.id;
    }).catch((e): null => {
      acceptError = e;
      return null;
    });

    if (recipeId === null) {
      const msg = acceptError instanceof Error ? acceptError.message : String(acceptError);
      console.error(`[imports] akceptacja #${id} nie powiodła się:`, acceptError);
      return res.status(500).json({ error: `Nie udało się utworzyć przepisu: ${msg}` });
    }

    // The recipe is committed at this point - a search hiccup must not fail
    // the accept; the index can be rebuilt anytime (npm run search:reindex)
    await syncRecipeToSearch(db, recipeId).catch((e) =>
      console.error(`[imports] search sync przepisu ${recipeId} nieudany:`, e)
    );
    return res.json({ ok: true, recipeId });
  }

  return res.status(400).json({ error: "Unknown action" });
}
