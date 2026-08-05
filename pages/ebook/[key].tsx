import Head from "next/head";
import { GetServerSideProps } from "next";
import { isAdminRequest } from "../../lib/admin-auth";
import { MAGNETS } from "../../lib/server/newsletter";
import { SITE_TITLE, SITE_URL } from "../../lib/constants";

// Print-to-PDF composition for the lead magnets. Admin-only (never public,
// never indexed): open /ebook/slodkie or /ebook/slone while logged in to the
// admin, Cmd+P, save as PDF, drop the file into /srv/dnl/media/pobrane/.
// The welcome mail links exactly the filenames defined in MAGNETS.

const SWEET_SLUGS = ["fit-ciasta", "fit-slodycze", "slodycze-domowe", "wypieki"];

type EbookRecipe = {
  title: string;
  uri: string;
  heroImage: string | null;
  kcal: number | null;
  servingsText: string | null;
  servings: number | null;
  totalTimeMin: number | null;
  ingredientGroups: { title: string | null; items: string[] }[];
  steps: { title: string | null; body: string }[];
};

export default function Ebook({ magnetKey, title, recipes }: { magnetKey: string; title: string; recipes: EbookRecipe[] }) {
  return (
    <div className="ebook">
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <style jsx global>{`
        @media print {
          .recipe-page { page-break-before: always; }
          a { color: inherit; text-decoration: none; }
        }
        .ebook { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2937; max-width: 720px; margin: 0 auto; padding: 24px; }
      `}</style>

      {/* Okładka */}
      <section className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <p className="text-5xl mb-6">{magnetKey === "slodkie" ? "🍰" : "🍕"}</p>
        <h1 className="text-4xl font-bold tracking-tight mb-3">{title}</h1>
        <p className="text-gray-500 mb-10">10 sprawdzonych przepisów z bloga {SITE_TITLE}</p>
        <p className="text-sm text-gray-400">
          Roksana Cieplicka · dietanaluzie.pl · przepisy z TikToka w wersji do gotowania
        </p>
      </section>

      {recipes.map((r, i) => (
        <section key={r.uri} className="recipe-page pt-8">
          <p className="text-xs tracking-widest text-amber-600 font-mono mb-2">
            PRZEPIS {i + 1} / {recipes.length}
          </p>
          <h2 className="text-2xl font-bold tracking-tight mb-2">{r.title}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {[
              r.kcal ? `🔥 ${r.kcal} kcal/porcję` : null,
              r.servingsText || (r.servings ? `${r.servings} porcji` : null),
              r.totalTimeMin ? `⏱ ${r.totalTimeMin} min` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {r.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.heroImage} alt="" className="w-full max-h-72 object-cover rounded-xl mb-5" />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Składniki</h3>
              {r.ingredientGroups.map((g, gi) => (
                <div key={gi} className="mb-3">
                  {g.title && <p className="text-sm font-medium text-gray-600 mb-1">{g.title}</p>}
                  <ul className="text-sm list-disc pl-5 space-y-1">
                    {g.items.map((item, ii) => (
                      <li key={ii}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div>
              <h3 className="font-semibold mb-2">Przygotowanie</h3>
              <ol className="text-sm list-decimal pl-5 space-y-2">
                {r.steps.map((s, si) => (
                  <li key={si}>
                    {s.title && <span className="font-medium">{s.title}: </span>}
                    {s.body}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-5">
            Wersja online z kalkulatorem porcji: {SITE_URL}
            {r.uri}
          </p>
        </section>
      ))}

      <section className="recipe-page pt-8 min-h-[40vh] flex flex-col items-center justify-center text-center">
        <p className="text-3xl mb-4">💌</p>
        <p className="font-semibold mb-2">Smakowało?</p>
        <p className="text-sm text-gray-500 max-w-sm">
          Nowe przepisy wpadają co tydzień z moich rolek. Wszystkie znajdziesz na
          dietanaluzie.pl, a najlepsze wysyłam mailem.
        </p>
      </section>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const key = String(params?.key || "");
  const magnet = MAGNETS[key];
  if (!magnet || !("file" in magnet) || !magnet.file) return { notFound: true };

  const { db, dbSchema } = await import("../../lib/db");
  const { getRecipeByUri } = await import("../../lib/queries");
  const { eq, inArray } = await import("drizzle-orm");
  const { recipes, recipeCategories, categories } = dbSchema;

  // Which recipes belong to sweet categories
  const catRows = await db
    .select({ recipeId: recipeCategories.recipeId, slug: categories.slug })
    .from(recipeCategories)
    .innerJoin(categories, eq(categories.id, recipeCategories.categoryId));
  const sweetIds = new Set(
    catRows.filter((c) => SWEET_SLUGS.includes(c.slug)).map((c) => c.recipeId)
  );

  const all = await db.select().from(recipes).where(eq(recipes.status, "published"));
  const pool = all
    .filter((r) => !r.uri.startsWith("/artykuly/"))
    .filter((r) => (key === "slodkie" ? sweetIds.has(r.id) : !sweetIds.has(r.id)));

  // slodkie: prefer no-bake, then quickest; slone: quickest meals first
  const score = (r: (typeof pool)[number]) => {
    const noBake = `${r.title} ${r.keywords ?? ""}`.toLowerCase().includes("bez pieczenia");
    return (key === "slodkie" && noBake ? -1000 : 0) + (r.totalTimeMin ?? 90);
  };
  const picked = pool.sort((a, b) => score(a) - score(b)).slice(0, 10);

  const full = (
    await Promise.all(picked.map((r) => getRecipeByUri(r.uri)))
  ).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getRecipeByUri>>>[];

  return {
    props: {
      magnetKey: key,
      title: magnet.title,
      recipes: JSON.parse(
        JSON.stringify(
          full.map((r) => ({
            title: r.title,
            uri: r.uri,
            heroImage: r.heroImage,
            kcal: r.kcal,
            servingsText: r.servingsText,
            servings: r.servings,
            totalTimeMin: r.totalTimeMin,
            ingredientGroups: r.ingredientGroups,
            steps: r.steps.map((s) => ({ title: s.title, body: s.body })),
          }))
        )
      ),
    },
  };
};
