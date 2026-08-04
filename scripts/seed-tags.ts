// Curates the tag vocabulary: inserts the sezon-* tags used by the
// homepage calendar and /sezon/ pages, and assigns groups to the legacy
// WP tags so the import AI can only pick from a reviewed list.
// Idempotent: safe to re-run after adding new themes or groups.
//   npx tsx scripts/seed-tags.ts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, dbSchema } from "../lib/db";
import { THEMES } from "../lib/seasonal";

const { tags } = dbSchema;

// Human names for the seasonal tags (slug -> name)
const SEASONAL_NAMES: Record<string, string> = {
  "sezon-tlusty-czwartek": "Tłusty Czwartek",
  "sezon-wielkanoc": "Wielkanoc",
  "sezon-walentynki": "Walentynki",
  "sezon-zdrowy-start": "Zdrowy start roku",
  "sezon-truskawki": "Sezon na truskawki",
  "sezon-lato": "Lato",
  "sezon-do-pudelka": "Do pudełka",
  "sezon-jesien": "Jesień",
  "sezon-swieta": "Boże Narodzenie",
  "sezon-sylwester": "Sylwester i imprezy",
  "sezon-wiosna": "Wiosna",
};

// Legacy tags reviewed into groups; anything not listed stays group=null
// and is invisible to the import AI
const LEGACY_GROUPS: Record<string, string[]> = {
  skladnik: [
    "czekolada",
    "nutella",
    "kurczak",
    "losos",
    "szpinak",
    "maliny",
    "marmolada",
    "kinder-chocolate",
  ],
  rodzaj: [
    "sernik",
    "sernik-na-zimno",
    "bez-pieczenia",
    "drozdzowki",
    "rolada",
    "wypieki",
    "deser",
    "desery",
    "sniadanie",
    "obiad",
    "szybki-obiad",
    "dania-jednogarnkowe",
    "przekaska",
    "przekaski",
    "kruszonka",
  ],
  okazja: [
    "swieta",
    "wielkanoc",
    "przepisy-swiateczne",
    "przepisy-na-sylwestra",
    "przepisy-imprezowe",
    "przekaski-na-impreze",
    "przepisy-na-impreze",
    "kuchnia-azjatycka",
  ],
};

async function main() {
  for (const t of THEMES) {
    const name = SEASONAL_NAMES[t.tagSlug] ?? t.title;
    await db
      .insert(tags)
      .values({ slug: t.tagSlug, name, group: "sezon" })
      .onConflictDoUpdate({ target: tags.slug, set: { group: "sezon" } });
    console.log(`sezon: ${t.tagSlug}`);
  }

  for (const [group, slugs] of Object.entries(LEGACY_GROUPS)) {
    for (const slug of slugs) {
      const updated = await db
        .update(tags)
        .set({ group: group as any })
        .where(eq(tags.slug, slug))
        .returning({ slug: tags.slug });
      console.log(updated.length ? `${group}: ${slug}` : `skip (missing): ${slug}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
