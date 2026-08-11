/**
 * One-shot WordPress -> Postgres comment import.
 *
 * The live domain serves Next.js now, but the old WP install still runs on
 * the Plesk box — we reach it by IP with SNI pinned to the real hostname
 * (the TLS cert there is for dietanaluzie.pl, so verification still passes).
 *
 * WPGraphQL publicly exposes only APPROVED comments — exactly the set worth
 * migrating. Mapping to recipes is by URI (the permalinks never changed).
 * Threads deeper than one level are flattened to their top-level ancestor,
 * matching how the new UI renders replies. Roksana's replies (registered
 * User author) come in with isAuthor = true.
 *
 * Re-runnable: deletes previously imported rows (fingerprint = 'wp-import')
 * before inserting. Reader-submitted comments are untouched.
 * Run: npm run import:wp-comments   (opcjonalnie WP_OLD_IP=... gdy Plesk
 * zmieni adres)
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });

import https from "https";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";

const OLD_WP_IP = process.env.WP_OLD_IP || "51.75.54.187";
const WP_HOSTNAME = "dietanaluzie.pl";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const db = drizzle(sql, { schema });
const { comments, recipes } = schema;

function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const body = JSON.stringify({ query, variables });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: OLD_WP_IP,
        servername: WP_HOSTNAME, // SNI + cert verification against the real name
        port: 443,
        path: "/graphql",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Host: WP_HOSTNAME,
        },
        timeout: 30_000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) return reject(new Error("GraphQL: " + JSON.stringify(json.errors)));
            resolve(json.data);
          } catch (e) {
            reject(new Error(`Zła odpowiedź (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(body);
  });
}

// wptexturize leaves rendered HTML: paragraphs, <br>, entities (also numeric,
// e.g. polskie cudzysłowy) — comments in the new system are plain text
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type WpComment = {
  databaseId: number;
  dateGmt: string;
  parentDatabaseId: number;
  content: string;
  author: { node: { __typename: string; name: string } };
  commentedOn: { node: { __typename: string; uri: string } } | null;
};

async function fetchAllComments(): Promise<WpComment[]> {
  const all: WpComment[] = [];
  let after: string | null = null;
  let hasNextPage = true;
  while (hasNextPage) {
    const data = await gql(
      `query ImportComments($after: String) {
        comments(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node {
            databaseId dateGmt parentDatabaseId
            content(format: RENDERED)
            author { node { __typename name } }
            commentedOn { node { __typename uri } }
          } }
        }
      }`,
      { after }
    );
    all.push(...data.comments.edges.map((e: any) => e.node));
    hasNextPage = data.comments.pageInfo.hasNextPage;
    after = data.comments.pageInfo.endCursor;
    console.log(`Pobrano ${all.length} komentarzy...`);
  }
  return all;
}

async function main() {
  const wpComments = await fetchAllComments();

  const recipeRows = await db.select({ id: recipes.id, uri: recipes.uri }).from(recipes);
  const recipeByUri = new Map(recipeRows.map((r) => [r.uri, r.id]));

  const byWpId = new Map(wpComments.map((c) => [c.databaseId, c]));
  // Flatten threads: everything hangs off its top-level ancestor
  function topAncestor(c: WpComment): WpComment {
    let cur = c;
    while (cur.parentDatabaseId && byWpId.has(cur.parentDatabaseId)) {
      cur = byWpId.get(cur.parentDatabaseId)!;
    }
    return cur;
  }

  // Oldest first, parents before their replies
  wpComments.sort((a, b) => a.dateGmt.localeCompare(b.dateGmt));

  const previous = await db
    .delete(comments)
    .where(eq(comments.fingerprint, "wp-import"))
    .returning({ id: comments.id });
  if (previous.length) console.log(`Usunięto ${previous.length} wcześniej zaimportowanych.`);

  const newIdByWpId = new Map<number, number>();
  const skipped: string[] = [];
  let imported = 0;
  let replies = 0;

  for (const c of wpComments) {
    const uri = c.commentedOn?.node?.uri;
    const recipeId = uri ? recipeByUri.get(uri) : undefined;
    if (!recipeId) {
      skipped.push(`#${c.databaseId} (${uri ?? "brak wpisu"})`);
      continue;
    }
    const body = htmlToText(c.content ?? "");
    if (!body) {
      skipped.push(`#${c.databaseId} (pusta treść)`);
      continue;
    }
    const isAuthor = c.author?.node?.__typename === "User";
    const ancestor = topAncestor(c);
    const parentId =
      ancestor.databaseId !== c.databaseId ? newIdByWpId.get(ancestor.databaseId) ?? null : null;

    const [row] = await db
      .insert(comments)
      .values({
        recipeId,
        parentId,
        authorName: (c.author?.node?.name || "Czytelniczka").slice(0, 80),
        body,
        isAuthor,
        fingerprint: "wp-import",
        status: "approved",
        createdAt: new Date(c.dateGmt + "Z"),
      })
      .returning({ id: comments.id });
    newIdByWpId.set(c.databaseId, row.id);
    imported++;
    if (parentId) replies++;
  }

  console.log(`\n✓ Zaimportowano ${imported} komentarzy (w tym ${replies} odpowiedzi).`);
  if (skipped.length) {
    console.log(`Pominięto ${skipped.length}: ${skipped.join(", ")}`);
  }

  // Recipes with imported comments — handy to spot-check on the site
  const withComments = await db
    .selectDistinct({ uri: recipes.uri })
    .from(comments)
    .innerJoin(recipes, eq(recipes.id, comments.recipeId))
    .where(inArray(comments.fingerprint, ["wp-import"]));
  console.log(`Wpisy z komentarzami: ${withComments.length}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
