/**
 * Jednorazowe zgłoszenie wszystkich opublikowanych URL-i do IndexNow
 * (Bing/Yandex/Naver - Google nie wspiera protokołu).
 * Run: npm run indexnow:submit-all - po wdrożeniu lub większych zmianach.
 * Wymaga INDEXNOW_KEY w env; bez niego kończy się komunikatem.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { staticSitemapPaths } from "../lib/site-routes";
import { EXCLUDED_PAGE_URIS } from "../lib/constants";
import { notifyIndexNow } from "../lib/server/indexnow";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });

async function main() {
  if (!process.env.INDEXNOW_KEY) {
    console.error("Brak INDEXNOW_KEY w env - nic nie zgłoszono.");
    process.exit(1);
  }

  const [recipeUris, categoryUris, pageUris] = await Promise.all([
    db
      .select({ uri: schema.recipes.uri })
      .from(schema.recipes)
      .where(eq(schema.recipes.status, "published")),
    db
      .selectDistinct({ uri: schema.categories.uri })
      .from(schema.categories)
      .innerJoin(
        schema.recipeCategories,
        eq(schema.recipeCategories.categoryId, schema.categories.id)
      )
      .innerJoin(
        schema.recipes,
        and(
          eq(schema.recipes.id, schema.recipeCategories.recipeId),
          eq(schema.recipes.status, "published")
        )
      ),
    db.select({ uri: schema.pages.uri }).from(schema.pages),
  ]);

  const paths = [
    "/",
    ...staticSitemapPaths(),
    ...recipeUris.map((r) => r.uri),
    ...categoryUris.map((c) => c.uri),
    ...pageUris
      .map((p) => p.uri)
      .filter((uri) => uri !== "/" && !EXCLUDED_PAGE_URIS.includes(uri)),
  ];

  const submitted = await notifyIndexNow(paths);
  if (submitted === null) {
    console.error("Zgłoszenie nieudane (szczegóły w logu powyżej).");
    process.exit(1);
  }
  console.log(`Zgłoszono ${submitted} URL-i do IndexNow.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
