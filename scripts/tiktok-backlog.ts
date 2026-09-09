/**
 * CLI katalogu TikTok. Rdzeń w lib/server/tiktok-backlog-run.ts (wspólny z
 * workerem, który wykonuje zlecenia z admina i odświeżanie interwałowe).
 * Uruchomienie: npm run tiktok:backlog [-- --skip-fetch]
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../lib/db/schema";
import { runTiktokBacklog } from "../lib/server/tiktok-backlog-run";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });

async function main() {
  await runTiktokBacklog(db, (s) => console.log(s), {
    skipFetch: process.argv.includes("--skip-fetch"),
  });
  console.log("Backlog do importu zobaczysz w /admin/tiktok-backlog.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
