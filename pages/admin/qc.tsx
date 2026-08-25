import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { and, eq, sql } from "drizzle-orm";
import AdminShell from "../../components/admin/admin-shell";
import { isAdminRequest } from "../../lib/admin-auth";
import { db, dbSchema } from "../../lib/db";
import { checkRecipe, hasError, type QcIssue } from "../../lib/recipe-qc";
import { planRecipeFixes } from "../../lib/recipe-qc-fix";

// QC danych przepisów: przelicza reguły z lib/recipe-qc dla wszystkich
// opublikowanych przepisów i pokazuje te z problemami (błędy przed
// ostrzeżeniami). Uruchamiasz ją po prostu wchodząc na tę stronę.

type Row = {
  id: number;
  title: string;
  uri: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  servings: number | null;
  issues: QcIssue[];
  fixes: string[];
  aiServings: boolean;
};

export default function AdminQc({
  rows,
  checked,
  errorCount,
  warningCount,
}: {
  rows: Row[];
  checked: number;
  errorCount: number;
  warningCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const fixableCount = rows.filter((r) => r.fixes.length > 0).length;

  async function post(url: string, payload: object, key: number | "all") {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      router.replace(router.asPath); // przelicz QC po zapisie
    } catch (e) {
      alert("Nie udało się poprawić: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const runFix = (payload: { id: number } | { all: true }, key: number | "all") =>
    post("/api/admin/qc-fix", payload, key);
  const runAiServings = (id: number) => post("/api/admin/recipes/reestimate", { id }, id);

  return (
    <AdminShell title="QC danych">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-1">QC danych przepisów</h1>
          <p className="text-sm text-gray-500">
            Sprawdzono {checked} opublikowanych przepisów.{" "}
            <span className="text-red-600 font-medium">{errorCount} z błędami</span>,{" "}
            <span className="text-amber-600 font-medium">{warningCount} z ostrzeżeniami</span>. Odśwież stronę, aby przeliczyć ponownie.
          </p>
        </div>
        {fixableCount > 0 && (
          <button
            onClick={() => runFix({ all: true }, "all")}
            disabled={busy !== null}
            className="rounded-full bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {busy === "all" ? "Poprawiam…" : `Popraw wszystkie automatycznie (${fixableCount})`}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-500">Wszystkie przepisy przechodzą kontrolę. 🎉</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Przepis</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">kcal / B·T·W / porcje</th>
                <th className="px-4 py-3 font-medium">Problemy</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className={hasError(r.issues) ? "bg-red-50/40" : ""}>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/admin/przepisy/${r.id}`} className="font-medium text-gray-900 hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-gray-600">
                    {r.kcal ?? "—"} kcal
                    <span className="text-gray-300"> · </span>
                    {fmt(r.protein)}·{fmt(r.fat)}·{fmt(r.carbs)}
                    <span className="text-gray-300"> · </span>
                    {r.servings ?? "—"} porc.
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ul className="space-y-1">
                      {r.issues.map((i, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 inline-block h-2 w-2 rounded-full shrink-0 ${
                              i.severity === "error" ? "bg-red-500" : "bg-amber-400"
                            }`}
                            title={i.severity === "error" ? "Błąd" : "Ostrzeżenie"}
                          />
                          <span className="text-gray-700">{i.message}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                    {r.fixes.length > 0 && (
                      <button
                        onClick={() => runFix({ id: r.id }, r.id)}
                        disabled={busy !== null}
                        title={r.fixes.join("\n")}
                        className="mb-2 block ml-auto rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy === r.id ? "Poprawiam…" : `Popraw (${r.fixes.length})`}
                      </button>
                    )}
                    {r.aiServings && (
                      <button
                        onClick={() => runAiServings(r.id)}
                        disabled={busy !== null}
                        title="AI oceni liczbę porcji i przeliczy makra na porcję"
                        className="mb-2 block ml-auto rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                      >
                        {busy === r.id ? "Liczę…" : "Porcje z AI"}
                      </button>
                    )}
                    <Link href={`/admin/przepisy/${r.id}`} className="text-gray-500 hover:text-gray-900">
                      edytuj
                    </Link>
                    <span className="text-gray-300"> · </span>
                    <Link href={r.uri} target="_blank" className="text-gray-400 hover:text-gray-700">
                      podgląd ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function fmt(v: number | null) {
  return v == null ? "—" : `${Math.round(Number(v))}g`;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }

  const { recipes, ingredientGroups, ingredients, steps } = dbSchema;

  const recs = await db
    .select({
      id: recipes.id,
      title: recipes.title,
      uri: recipes.uri,
      status: recipes.status,
      kcal: recipes.kcal,
      protein: recipes.protein,
      fat: recipes.fat,
      carbs: recipes.carbs,
      servings: recipes.servings,
      prepTimeMin: recipes.prepTimeMin,
      cookTimeMin: recipes.cookTimeMin,
      totalTimeMin: recipes.totalTimeMin,
      heroImage: recipes.heroImage,
      contentHtml: recipes.contentHtml,
    })
    .from(recipes)
    // artykuły (/artykuly/) nie są przepisami — nie podlegają QC makr/kroków
    .where(and(eq(recipes.status, "published"), sql`${recipes.uri} not like '/artykuly/%'`));

  const ingRows = await db
    .select({
      recipeId: ingredientGroups.recipeId,
      c: sql<number>`count(${ingredients.id})::int`,
    })
    .from(ingredientGroups)
    .leftJoin(ingredients, eq(ingredients.groupId, ingredientGroups.id))
    .groupBy(ingredientGroups.recipeId);

  const stepRows = await db
    .select({ recipeId: steps.recipeId, c: sql<number>`count(*)::int` })
    .from(steps)
    .groupBy(steps.recipeId);

  const ingByRecipe = new Map(ingRows.map((r) => [r.recipeId, Number(r.c)]));
  const stepByRecipe = new Map(stepRows.map((r) => [r.recipeId, Number(r.c)]));

  const rows: Row[] = [];
  for (const r of recs) {
    const issues = checkRecipe({
      id: r.id,
      title: r.title,
      uri: r.uri,
      status: r.status,
      kcal: r.kcal,
      protein: r.protein != null ? Number(r.protein) : null,
      fat: r.fat != null ? Number(r.fat) : null,
      carbs: r.carbs != null ? Number(r.carbs) : null,
      servings: r.servings,
      totalTimeMin: r.totalTimeMin,
      heroImage: r.heroImage,
      ingredientCount: ingByRecipe.get(r.id) ?? 0,
      stepCount: stepByRecipe.get(r.id) ?? 0,
      hasContentHtml: (r.contentHtml?.length ?? 0) > 50,
    });
    if (issues.length === 0) continue;

    const plan = planRecipeFixes({
      kcal: r.kcal,
      protein: r.protein != null ? Number(r.protein) : null,
      fat: r.fat != null ? Number(r.fat) : null,
      carbs: r.carbs != null ? Number(r.carbs) : null,
      servings: r.servings,
      prepTimeMin: r.prepTimeMin,
      cookTimeMin: r.cookTimeMin,
      totalTimeMin: r.totalTimeMin,
      ingredientCount: ingByRecipe.get(r.id) ?? 0,
      stepCount: stepByRecipe.get(r.id) ?? 0,
      contentHtml: r.contentHtml,
    });

    rows.push({
      id: r.id,
      title: r.title,
      uri: r.uri,
      kcal: r.kcal,
      protein: r.protein != null ? Number(r.protein) : null,
      fat: r.fat != null ? Number(r.fat) : null,
      carbs: r.carbs != null ? Number(r.carbs) : null,
      servings: r.servings,
      issues,
      fixes: plan.descriptions,
      aiServings: issues.some((i) => i.code === "servings-suspicious"),
    });
  }

  // Błędy przed ostrzeżeniami, potem więcej problemów wyżej.
  rows.sort((a, b) => {
    const ae = hasError(a.issues) ? 1 : 0;
    const be = hasError(b.issues) ? 1 : 0;
    if (ae !== be) return be - ae;
    return b.issues.length - a.issues.length;
  });

  const errorCount = rows.filter((r) => hasError(r.issues)).length;
  const warningCount = rows.length - errorCount;

  return {
    props: {
      rows: JSON.parse(JSON.stringify(rows)),
      checked: recs.length,
      errorCount,
      warningCount,
    },
  };
};
