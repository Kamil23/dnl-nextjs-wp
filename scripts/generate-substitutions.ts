/**
 * CLI szkiców zamienników. Rdzeń w lib/server/substitutions-run.ts (wspólny z
 * workerem, który wykonuje zlecenia z przycisku w /admin/zamienniki).
 * Uruchom: npm run substitutions:generate [-- --limit N] [-- --recipe ID]
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema";
import { runSubstitutionsGenerate } from "../lib/server/substitutions-run";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

async function main() {
  const recipeArg = argValue("--recipe");
  const recipeId = recipeArg != null ? parseInt(recipeArg, 10) : null;
  if (recipeArg != null && !Number.isInteger(recipeId)) {
    console.error(`Nieprawidłowe --recipe: ${recipeArg} (podaj liczbowe ID przepisu).`);
    await client.end();
    process.exit(1);
  }

  try {
    const r = await runSubstitutionsGenerate(db, (s) => console.log(s), {
      limit: Math.max(1, parseInt(argValue("--limit") ?? "10", 10) || 10),
      recipeId,
    });
    if (r.inserted > 0) console.log("Przejrzyj i zaakceptuj w /admin/zamienniki.");
  } catch (e: any) {
    console.error(e.message || e);
    await client.end();
    process.exit(1);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
