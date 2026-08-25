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
import { absUrl } from "../seo";
import { escapeHtml, mailShell, mailButton, MAGNETS } from "./newsletter";

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

  // Content-led subject proposal (admin edits anyway): the mobile inbox shows
  // ~40 chars, so no "#N" prefix; curiosity + benefit up front
  const subject = freshItems[0]
    ? `Nowość: ${freshItems[0].title} 🍳`
    : sezon
      ? `${sezon.title} już za ${sezon.inDays} dni`
      : hit.item
        ? `${hit.item.title}: wszyscy to teraz gotują 🔥`
        : "Nowe przepisy i sezonowe pomysły";
  return {
    number,
    subject,
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
// CTR playbook baked in: hidden preheader, one HERO with a big appetizing
// photo + bulletproof button above the fold, whole cards clickable (image AND
// title), kcal/time chips (this audience's hook), seasonal countdown framing,
// social proof on the hit, a P.S. line (the most-read line of any mail) and a
// reply prompt (engagement signals lift deliverability).

function utm(uri: string, edition: number) {
  const sep = uri.includes("?") ? "&" : "?";
  return `${SITE_URL}${uri}${sep}utm_source=newsletter&utm_medium=email&utm_campaign=wydanie-${edition}`;
}

const FONT = `font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;`;

function chips(item: EditionItem) {
  const parts = [item.kcal ? `🔥 ${item.kcal} kcal/porcję` : null].filter(Boolean);
  if (!parts.length) return "";
  return `<div style="margin:6px 0 0;">${parts
    .map(
      (c) =>
        `<span style="${FONT}display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;margin-right:6px;">${c}</span>`
    )
    .join("")}</div>`;
}

// The one big card at the top: photo → title → chips → lead → amber button
function heroCard(item: EditionItem, edition: number, eyebrow: string, cta = "Zobacz przepis →") {
  const href = utm(item.uri, edition);
  const img = item.heroImage
    ? `<a href="${href}" style="text-decoration:none;"><img src="${escapeHtml(absUrl(item.heroImage))}" alt="${escapeHtml(item.title)}" width="544" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border-radius:16px;" /></a>`
    : "";
  const lead = item.lead
    ? `<p style="${FONT}margin:8px 0 0;color:#6b7280;font-size:15px;line-height:1.6;">${escapeHtml(item.lead)}</p>`
    : "";
  return `<div style="margin:6px 0 26px;">
    <p style="${FONT}margin:0 0 10px;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#b45309;">${escapeHtml(eyebrow)}</p>
    ${img}
    <a href="${href}" style="${FONT}display:block;margin:14px 0 0;color:#111827;font-weight:800;font-size:22px;line-height:1.25;text-decoration:none;letter-spacing:-0.3px;">${escapeHtml(item.title)}</a>
    ${chips(item)}
    ${lead}
    <div style="margin:16px 0 0;">${mailButton(href, cta, "#f59e0b", "#1f2937")}</div>
  </div>`;
}

// Compact row: 88px thumb + title + kcal, everything clickable
function miniRow(item: EditionItem, edition: number) {
  const href = utm(item.uri, edition);
  const thumb = item.heroImage
    ? `<a href="${href}" style="text-decoration:none;"><img src="${escapeHtml(absUrl(item.heroImage))}" alt="" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:cover;border-radius:12px;" /></a>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
    <tr>
      <td width="100" valign="top">${thumb}</td>
      <td valign="middle" style="padding-left:2px;">
        <a href="${href}" style="${FONT}color:#111827;font-weight:700;font-size:16px;line-height:1.35;text-decoration:none;">${escapeHtml(item.title)}</a>
        <div style="${FONT}margin-top:3px;color:#b45309;font-size:13px;font-weight:600;">${item.kcal ? `🔥 ${item.kcal} kcal` : ""}&nbsp;<span style="color:#d6d3d1;">·</span>&nbsp;<span style="color:#78716c;">otwórz →</span></div>
      </td>
    </tr>
  </table>`;
}

function sectionTitle(text: string) {
  return `<h2 style="${FONT}font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#b45309;margin:26px 0 14px;">${escapeHtml(text)}</h2>`;
}

export function renderEditionHtml(
  number: number,
  content: EditionContent,
  unsubToken: string
): string {
  const parts: string[] = [];

  // Pick the HERO: first new recipe wins, else the hit, else the season opener
  let hero: { item: EditionItem; eyebrow: string } | null = null;
  let nowosciRest: EditionItem[] = content.nowosci.enabled ? [...content.nowosci.items] : [];
  let hitUsedAsHero = false;
  if (content.nowosci.enabled && content.nowosci.items.length) {
    hero = { item: content.nowosci.items[0], eyebrow: "Nowość z rolki" };
    nowosciRest = content.nowosci.items.slice(1);
  } else if (content.hit.enabled && content.hit.item) {
    hero = { item: content.hit.item, eyebrow: "Hit ostatnich dni" };
    hitUsedAsHero = true;
  } else if (content.sezon?.enabled && content.sezon.items.length) {
    hero = { item: content.sezon.items[0], eyebrow: content.sezon.title };
  }

  // Personal intro: short, with the avatar (parasocial glue - they open for Roksana)
  if (content.odRoksany.trim()) {
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;">
      <tr>
        <td width="52" valign="top"><img src="${SITE_URL}/roksana-avatar.jpeg" alt="Roksana" width="44" height="44" style="display:block;width:44px;height:44px;border-radius:999px;object-fit:cover;" /></td>
        <td valign="middle">
          <p style="${FONT}margin:0;font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(content.odRoksany.trim())}</p>
          <p style="${FONT}margin:2px 0 0;color:#a8a29e;font-size:13px;">Roksana 🧡</p>
        </td>
      </tr>
    </table>`);
  }

  if (hero) parts.push(heroCard(hero.item, number, hero.eyebrow));

  if (nowosciRest.length) {
    parts.push(sectionTitle("Też nowe"));
    parts.push(...nowosciRest.map((i) => miniRow(i, number)));
  }

  // Seasonal block: countdown framing inside a warm tinted box + section CTA
  if (content.sezon?.enabled && content.sezon.items.length) {
    const seasonItems =
      hero && !hitUsedAsHero && hero.eyebrow === content.sezon.title
        ? content.sezon.items.slice(1)
        : content.sezon.items;
    if (seasonItems.length || true) {
      const when = content.sezon.inDays <= 1 ? "JUŻ JUTRO" : `ZA ${content.sezon.inDays} DNI`;
      parts.push(`<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:18px 18px 6px;margin:26px 0 22px;">
        <p style="${FONT}margin:0 0 4px;font-size:12px;font-weight:800;letter-spacing:0.1em;color:#c2410c;">⏳ ${when}</p>
        <p style="${FONT}margin:0 0 14px;font-size:18px;font-weight:800;color:#1f2937;">${escapeHtml(content.sezon.title)}</p>
        ${seasonItems.map((i) => miniRow(i, number)).join("\n")}
        <div style="margin:4px 0 14px;">${mailButton(utm(`/sezon/${content.sezon.key}/`, number), "Wszystkie przepisy sezonu →")}</div>
      </div>`);
    }
  }

  // Skip the hit if that recipe is already on screen (hero/nowości/sezon)
  const shownUris = new Set<string>([
    ...(hero ? [hero.item.uri] : []),
    ...nowosciRest.map((i) => i.uri),
    ...(content.sezon?.enabled ? content.sezon.items.map((i) => i.uri) : []),
  ]);
  if (content.hit.enabled && content.hit.item && !hitUsedAsHero && !shownUris.has(content.hit.item.uri)) {
    parts.push(sectionTitle("Hit ostatnich dni"));
    if (content.hit.views) {
      parts.push(
        `<p style="${FONT}margin:-6px 0 10px;color:#78716c;font-size:13px;">${content.hit.views.toLocaleString("pl-PL")} osób już to widziało. Dołączasz?</p>`
      );
    }
    parts.push(miniRow(content.hit.item, number));
  }

  if (content.pytanie.enabled && content.pytanie.q.trim()) {
    parts.push(sectionTitle("Pytanie od Was"));
    parts.push(
      `<p style="${FONT}margin:0 0 6px;font-weight:700;font-size:15px;color:#111827;">„${escapeHtml(content.pytanie.q.trim())}"</p>
       <p style="${FONT}margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(content.pytanie.a.trim())}</p>`
    );
  }

  if (content.promo.enabled && content.promo.kind) {
    const m = MAGNETS[content.promo.kind];
    if (m) {
      const href = m.file
        ? `${SITE_URL}${m.file}`
        : utm("/kalkulator-kalorii/", number);
      parts.push(`<div style="background:#f5f5f4;border-radius:16px;padding:18px;margin:26px 0 8px;text-align:center;">
        <p style="${FONT}margin:0 0 10px;font-size:15px;font-weight:700;color:#1f2937;">${escapeHtml(m.title)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td>${mailButton(href, m.file ? "Pobieram 🎁" : "Zapisuję się →")}</td></tr></table>
      </div>`);
    }
  }

  // P.S. - statistically the most-read line; reply prompt doubles as a
  // deliverability signal (replies teach inboxes this sender matters)
  parts.push(
    `<p style="${FONT}margin:26px 0 20px;color:#57534e;font-size:14px;line-height:1.6;border-top:1px solid #f5f5f4;padding-top:18px;"><strong>PS.</strong> Masz pytanie o któryś przepis albo pomysł, co mam ugotować następne? Po prostu odpisz na tego maila, czytam wszystko.</p>`
  );

  const preheader =
    hero
      ? `${hero.item.title}${hero.item.kcal ? `, ${hero.item.kcal} kcal/porcję` : ""} i inne nowości w środku`
      : "Nowe przepisy i sezonowe pomysły w środku";

  return mailShell(parts.join("\n"), unsubToken, preheader);
}

export function editionPreviewHtml(number: number, content: EditionContent) {
  // Preview in the admin uses a dummy token (links render, unsub goes nowhere)
  return renderEditionHtml(number, content, "0".repeat(48));
}
