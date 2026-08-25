/**
 * Full Meilisearch reindex from Postgres (published recipes only).
 * Run: npm run search:reindex - idempotent, run after bulk changes.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema";
import { buildRecipeDoc } from "../lib/search-sync";
import { configureIndex, meili, INDEX, upsertDocs } from "../lib/search";
import { eq } from "drizzle-orm";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });

async function main() {
  await configureIndex();

  const published = await db
    .select({ id: schema.recipes.id })
    .from(schema.recipes)
    .where(eq(schema.recipes.status, "published"));

  const docs = [];
  for (const { id } of published) {
    const doc = await buildRecipeDoc(db, id);
    if (doc) docs.push(doc);
  }

  await meili().index(INDEX).deleteAllDocuments();
  await upsertDocs(docs);
  console.log(`Zaindeksowano ${docs.length} przepisów.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
