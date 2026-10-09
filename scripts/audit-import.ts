/**
 * Ładuje propozycje z audytu (audit/proposals/<id>.json) do tabeli
 * recipe_proposals. Nie dotyka recipes: decyzję podejmuje operator w
 * /admin/propozycje. Pomija propozycje bez verdict CONFIRMED (jeśli pole jest),
 * o nieobsługiwanej ścieżce, puste (before == after) i już załadowane
 * (ten sam przepis + ścieżka + źródło w statusie pending/applied).
 *
 *   npm run audit:import -- --source claude-audit-2026-10 [--dir audit/proposals] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import fs from "fs";
import path from "path";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { isAllowedPath, readValue } from "../lib/server/apply-proposal";

const client = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(client, { schema });

const args = process.argv.slice(2);
const flag = (name: string, def: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
const SOURCE = flag("--source", `claude-audit-${new Date().toISOString().slice(0, 7)}`);
const DIR = flag("--dir", path.join(process.cwd(), "audit", "proposals"));
const DRY = args.includes("--dry");

type Finding = {
  path: string;
  severity?: "error" | "warning" | "polish";
  before?: unknown;
  after: unknown;
  reason: string;
  confidence?: "high" | "medium" | "low";
  basis?: "ingredients-math" | "source-text" | "knowledge";
  verdict?: "CONFIRMED" | "REJECTED";
};

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  let inserted = 0;
  let skipped = 0;
  const reasons: Record<string, number> = {};
  const skip = (why: string) => {
    skipped++;
    reasons[why] = (reasons[why] ?? 0) + 1;
  };

  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const recipeId = Number(data.recipeId ?? path.basename(f, ".json"));
    if (!Number.isInteger(recipeId)) {
      skip("zły recipeId");
      continue;
    }
    const [rec] = await db.select({ id: schema.recipes.id }).from(schema.recipes).where(eq(schema.recipes.id, recipeId));
    if (!rec) {
      skip("przepis nie istnieje");
      continue;
    }
    const existing = await db
      .select({ path: schema.recipeProposals.path })
      .from(schema.recipeProposals)
      .where(
        and(
          eq(schema.recipeProposals.recipeId, recipeId),
          eq(schema.recipeProposals.source, SOURCE),
          inArray(schema.recipeProposals.status, ["pending", "applied"])
        )
      );
    const have = new Set(existing.map((e) => e.path));

    for (const fd of (data.findings ?? []) as Finding[]) {
      if (!fd || typeof fd.path !== "string" || typeof fd.reason !== "string") {
        skip("niepełny wpis");
        continue;
      }
      if (fd.verdict && fd.verdict !== "CONFIRMED") {
        skip("verdict != CONFIRMED");
        continue;
      }
      if (!isAllowedPath(fd.path)) {
        skip(`ścieżka niedozwolona (${fd.path.split(/[\[.]/)[0]})`);
        continue;
      }
      if (have.has(fd.path)) {
        skip("już załadowana");
        continue;
      }
      const before = await readValue(db, recipeId, fd.path);
      if (before === undefined) {
        skip("pole nie istnieje");
        continue;
      }
      if (JSON.stringify(before ?? null) === JSON.stringify(fd.after ?? null)) {
        skip("bez zmiany");
        continue;
      }
      if (!DRY) {
        await db.insert(schema.recipeProposals).values({
          recipeId,
          path: fd.path,
          before: before ?? null,
          after: fd.after ?? null,
          reason: fd.reason.slice(0, 2000),
          severity: fd.severity && ["error", "warning", "polish"].includes(fd.severity) ? fd.severity : "warning",
          confidence: fd.confidence && ["high", "medium", "low"].includes(fd.confidence) ? fd.confidence : "medium",
          basis: fd.basis && ["ingredients-math", "source-text", "knowledge"].includes(fd.basis) ? fd.basis : "knowledge",
          source: SOURCE,
          status: "pending",
        });
      }
      have.add(fd.path);
      inserted++;
    }
  }
  console.log(`${DRY ? "[dry] " : ""}Załadowano ${inserted} propozycji (źródło ${SOURCE}), pominięto ${skipped}.`);
  for (const [k, v] of Object.entries(reasons)) console.log(`  - ${k}: ${v}`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
