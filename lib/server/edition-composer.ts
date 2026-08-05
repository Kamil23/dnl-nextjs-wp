// Newsletter edition composer: assembles a draft from what the system already
// knows (new recipes since the last send, the upcoming seasonal window, the
// most-read hit) so the admin only toggles sections, adds two sentences and
// hits send. Rendering produces the final email HTML with UTM-tagged links.
import { desc, eq, gt, and, ne, isNotNull } from "drizzle-orm";
import { db, dbSchema } from "../db";
import { getSeasonalTheme, getThemeByKey } from "../seasonal";
import { listThemedRecipes } from "../queries";
import { getTopReadPaths } from "./ga";
import { SITE_URL } from "../constants";
import { escapeHtml, mailShell, MAGNETS } from "./newsletter";

const { recipes, newsletterEditions } = dbSchema;

export type EditionItem = {
  title: string;
  uri: string;
  heroImage: string | null;
  kcal: number | null;
  lead: string | null;
};

export type EditionContent = {
  nowosci: { enabled: boolean; items: EditionItem[] };
  sezon: { enabled: boolean; key: string; title: string; inDays: number; items: EditionItem[] } | null;
  hit: { enabled: boolean; item: EditionItem | null; views: number | null };
  odRoksany: string;
  pytanie: { enabled: boolean; q: string; a: string };
  promo: { enabled: boolean; kind: "slodkie" | "slone" | "planer" | null };
};

const toItem = (r: {
  title: string;
  uri: string;
  heroImage: string | null;
  kcal: number | null;
  lead: string | null;
}): EditionItem => ({
  title: r.title,
  uri: r.uri,
  heroImage: r.heroImage,
  kcal: r.kcal,
  lead: r.lead,
});

// The seasonal theme that will take over within the next `windowDays`
// (evaluated by walking getSeasonalTheme forward day by day)
function upcomingTheme(windowDays = 14) {
  const today = new Date();
  const current = getSeasonalTheme(today).key;
  for (let d = 1; d <= windowDays; d++) {
    const t = getSeasonalTheme(new Date(today.getTime() + d * 86400000));
    if (t.key !== current) return { theme: t, inDays: d };
  }
  return null;
}

export async function composeDraft(): Promise<{ number: number; subject: string; content: EditionContent }> {
  const [lastSent] = await db
    .select()
    .from(newsletterEditions)
    .where(eq(newsletterEditions.status, "sent"))
    .orderBy(desc(newsletterEditions.sentAt))
    .limit(1);
  const since = lastSent?.sentAt ?? new Date(Date.now() - 14 * 86400000);

  // 1. New recipes since the last edition (TikTok pipeline output included)
  const fresh = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.status, "published"), gt(recipes.publishedAt, since)))
    .orderBy(desc(recipes.publishedAt))
    .limit(5);
  const freshItems = fresh.filter((r) => !r.uri.startsWith("/artykuly/")).map(toItem);

  // 2. Seasonal window opening within 14 days (or the current non-default one)
  const upcoming = upcomingTheme(14);
  let sezon: EditionContent["sezon"] = null;
  if (upcoming) {
    const themed = await listThemedRecipes(getThemeByKey(upcoming.theme.key)!, 4);
    if (themed.length) {
      sezon = {
        enabled: true,
        key: upcoming.theme.key,
        title: upcoming.theme.title,
        inDays: upcoming.inDays,
        items: themed.map(toItem),
      };
    }
  }

  // 3. Hit: most-read recipe of the period (GA), fallback: newest top-rated
  let hit: EditionContent["hit"] = { enabled: false, item: null, views: null };
  const top = await getTopReadPaths(14, 20).catch(() => null);
  if (top) {
    for (const { path, views } of top) {
      const clean = path.replace(/\?.*$/, "");
      const [r] = await db.select().from(recipes).where(eq(recipes.uri, clean)).limit(1);
      if (r && r.status === "published" && !r.uri.startsWith("/artykuly/")) {
        hit = { enabled: true, item: toItem(r), views };
        break;
      }
    }
  }
  if (!hit.item) {
    const [r] = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.status, "published"),
          ne(recipes.source, "wp_import"),
          isNotNull(recipes.videoViews)
        )
      )
      .orderBy(desc(recipes.videoViews))
      .limit(1);
    if (r) hit = { enabled: true, item: toItem(r), views: r.videoViews ?? null };
  }

  const [{ maxNumber } = { maxNumber: 0 }] = (await db
    .select({ maxNumber: newsletterEditions.number })
    .from(newsletterEditions)
    .orderBy(desc(newsletterEditions.number))
    .limit(1)) as { maxNumber: number }[];
  const number = (maxNumber ?? 0) + 1;

  const lead = freshItems[0]?.title || sezon?.title || hit.item?.title || "nowe przepisy";
  return {
    number,
    subject: `Dieta na luzie #${number}: ${lead}`,
    content: {
      nowosci: { enabled: freshItems.length > 0, items: freshItems },
      sezon,
      hit,
      odRoksany: "",
      pytanie: { enabled: false, q: "", a: "" },
      promo: { enabled: false, kind: null },
    },
  };
}

// ── e-mail rendering ─────────────────────────────────────────────────────────

function utm(uri: string, edition: number) {
  return `${SITE_URL}${uri}?utm_source=newsletter&utm_medium=email&utm_campaign=wydanie-${edition}`;
}

function recipeCard(item: EditionItem, edition: number) {
  const href = utm(item.uri, edition);
  const img = item.heroImage
    ? `<a href="${href}"><img src="${escapeHtml(item.heroImage)}" alt="" width="504" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;margin:0 0 10px;"/></a>`
    : "";
  const kcal = item.kcal ? `<span style="color:#b45309;font-size:13px;">🔥 ${item.kcal} kcal/porcję</span>` : "";
  const lead = item.lead
    ? `<p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${escapeHtml(item.lead)}</p>`
    : "";
  return `<div style="margin:0 0 22px;">
    ${img}
    <a href="${href}" style="color:#111827;font-weight:700;font-size:17px;text-decoration:none;">${escapeHtml(item.title)}</a>
    ${kcal ? `<div style="margin-top:2px;">${kcal}</div>` : ""}
    ${lead}
  </div>`;
}

function sectionTitle(text: string) {
  return `<h2 style="font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#b45309;margin:28px 0 14px;">${escapeHtml(text)}</h2>`;
}

export function renderEditionHtml(
  number: number,
  content: EditionContent,
  unsubToken: string
): string {
  const parts: string[] = [];

  if (content.odRoksany.trim()) {
    parts.push(
      `<p style="margin:0 0 4px;font-size:16px;">${escapeHtml(content.odRoksany.trim())}</p>
       <p style="margin:0 0 8px;color:#9ca3af;font-size:14px;">Roksana 🧡</p>`
    );
  }

  if (content.nowosci.enabled && content.nowosci.items.length) {
    parts.push(sectionTitle("Nowości z rolek"));
    parts.push(...content.nowosci.items.map((i) => recipeCard(i, number)));
  }

  if (content.sezon?.enabled && content.sezon.items.length) {
    const when =
      content.sezon.inDays <= 1
        ? "już jutro"
        : `za ${content.sezon.inDays} dni`;
    parts.push(sectionTitle(`${content.sezon.title} (${when})`));
    parts.push(...content.sezon.items.map((i) => recipeCard(i, number)));
  }

  if (content.hit.enabled && content.hit.item) {
    parts.push(sectionTitle("Hit ostatnich dni"));
    parts.push(recipeCard(content.hit.item, number));
  }

  if (content.pytanie.enabled && content.pytanie.q.trim()) {
    parts.push(sectionTitle("Pytanie od Was"));
    parts.push(
      `<p style="margin:0 0 6px;font-weight:600;">„${escapeHtml(content.pytanie.q.trim())}"</p>
       <p style="margin:0 0 16px;color:#374151;font-size:15px;">${escapeHtml(content.pytanie.a.trim())}</p>`
    );
  }

  if (content.promo.enabled && content.promo.kind) {
    const m = MAGNETS[content.promo.kind];
    if (m) {
      const href = m.file
        ? `${SITE_URL}${m.file}`
        : `${SITE_URL}/kalkulator-kalorii/?utm_source=newsletter&utm_medium=email&utm_campaign=wydanie-${number}`;
      parts.push(sectionTitle("Dla Ciebie"));
      parts.push(
        `<a href="${href}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 22px;font-weight:600;">${escapeHtml(m.title)}</a>`
      );
    }
  }

  parts.push(
    `<p style="margin:28px 0 0;color:#9ca3af;font-size:13px;">Wszystkie przepisy znajdziesz na <a href="${SITE_URL}/?utm_source=newsletter&utm_medium=email&utm_campaign=wydanie-${number}" style="color:#6b7280;">${SITE_URL.replace("https://", "")}</a>. Smacznego!</p>`
  );

  return mailShell(parts.join("\n"), unsubToken);
}

export function editionPreviewHtml(number: number, content: EditionContent) {
  // Preview in the admin uses a dummy token (links render, unsub goes nowhere)
  return renderEditionHtml(number, content, "0".repeat(48));
}
