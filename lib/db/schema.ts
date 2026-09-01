import {
  pgTable,
  serial,
  text,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// `uri` columns hold the exact WordPress permalinks (e.g. /przepisy/fit-rafaello/)
// - they are the SEO contract and must never change for imported content.

export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    uri: text("uri").notNull(),
    status: text("status", { enum: ["draft", "review", "published"] })
      .notNull()
      .default("published"),
    title: text("title").notNull(),
    lead: text("lead"),
    excerpt: text("excerpt"),
    // Full WP-rendered article HTML; used to render the page until the
    // structured redesign fully replaces it, and to keep intro/story text
    contentHtml: text("content_html"),
    heroImage: text("hero_image"),
    videoUrl: text("video_url"),
    videoDurationSec: integer("video_duration_sec"),
    // TikTok play count, captured at import and refreshed by
    // scripts/refresh-tiktok-stats.ts; editable in the admin as a fallback
    videoViews: integer("video_views"),
    authorName: text("author_name"),
    prepTimeMin: integer("prep_time_min"),
    cookTimeMin: integer("cook_time_min"),
    totalTimeMin: integer("total_time_min"),
    servings: integer("servings"),
    servingsText: text("servings_text"),
    difficulty: text("difficulty", { enum: ["latwy", "sredni", "trudny"] }),
    kcal: integer("kcal"),
    protein: numeric("protein"),
    fat: numeric("fat"),
    carbs: numeric("carbs"),
    keywords: text("keywords"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    legacyRatingValue: numeric("legacy_rating_value"),
    legacyRatingCount: integer("legacy_rating_count"),
    // Paid collaboration shown (and legally marked) on the recipe page:
    // { brand, code, note }
    sponsor: jsonb("sponsor"),
    source: text("source", { enum: ["manual", "tiktok", "wp_import"] })
      .notNull()
      .default("manual"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("recipes_uri_idx").on(t.uri),
    uniqueIndex("recipes_slug_idx").on(t.slug),
    index("recipes_status_published_idx").on(t.status, t.publishedAt),
  ]
);

export const ingredientGroups = pgTable("ingredient_groups", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  title: text("title"),
  position: integer("position").notNull().default(0),
});

export const ingredients = pgTable(
  "ingredients",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => ingredientGroups.id, { onDelete: "cascade" }),
    rawText: text("raw_text").notNull(),
    amount: numeric("amount"),
    unit: text("unit"),
    name: text("name"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("ingredients_group_idx").on(t.groupId)]
);

export const steps = pgTable(
  "steps",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    title: text("title"),
    body: text("body").notNull(),
    image: text("image"),
    tip: text("tip"),
  },
  (t) => [index("steps_recipe_idx").on(t.recipeId)]
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    uri: text("uri").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    description: text("description"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
  },
  (t) => [
    uniqueIndex("categories_slug_idx").on(t.slug),
    uniqueIndex("categories_uri_idx").on(t.uri),
  ]
);

export const recipeCategories = pgTable(
  "recipe_categories",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.categoryId] })]
);

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Curated vocabulary: tags with a group are the only ones the import
    // AI may assign (sezon powers the homepage calendar and /sezon/ pages).
    // Legacy WP tags keep group = null until reviewed.
    group: text("group", { enum: ["sezon", "skladnik", "rodzaj", "okazja"] }),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug)]
);

export const recipeTags = pgTable(
  "recipe_tags",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.tagId] })]
);

export const ratings = pgTable(
  "ratings",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    value: smallint("value").notNull(),
    fingerprint: text("fingerprint").notNull(),
    // Every vote is moderated in the admin before it counts publicly
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("ratings_recipe_fp_idx").on(t.recipeId, t.fingerprint)]
);

// Reader comments under a recipe/article. Same trust model as ratings:
// everything lands as `pending` and only admin-approved comments render
// publicly (and count towards commentCount in the JSON-LD).
// `parentId` holds one level of nesting - replies (typically Roksana
// answering from the admin, marked with isAuthor) render indented.
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    // Admin replies are published as the blog author (highlighted in the UI)
    isAuthor: boolean("is_author").notNull().default(false),
    fingerprint: text("fingerprint").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("comments_recipe_status_idx").on(t.recipeId, t.status),
    index("comments_status_idx").on(t.status),
  ]
);

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    uri: text("uri").notNull(),
    title: text("title").notNull(),
    contentHtml: text("content_html"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("pages_uri_idx").on(t.uri)]
);

export const imports = pgTable(
  "imports",
  {
    id: serial("id").primaryKey(),
    tiktokUrl: text("tiktok_url").notNull(),
    // Canonical TikTok video id (the digits in .../video/<id>) - the dedup key.
    // Filled at submit time when resolvable (short vm./vt. links get followed),
    // and always after yt-dlp downloads the clip.
    videoId: text("video_id"),
    // Operator override: process even though the video was flagged a duplicate
    force: boolean("force").notNull().default(false),
    videoPath: text("video_path"),
    caption: text("caption"),
    transcript: text("transcript"),
    aiDraft: jsonb("ai_draft"),
    status: text("status", {
      enum: ["pending", "processing", "ready", "approved", "rejected", "failed", "duplicate"],
    })
      .notNull()
      .default("pending"),
    // Live progress while processing: { step, total, label }
    progress: jsonb("progress"),
    recipeId: integer("recipe_id").references(() => recipes.id),
    operatorNotes: text("operator_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("imports_video_id_idx").on(t.videoId)]
);

// Shared shopping lists: anyone with the UUID link can read and edit
// (same trust model as a shared note). `data` mirrors the localStorage
// shape (ShoppingRecipe[]); stale lists are purged after 60 days.
export const sharedLists = pgTable(
  "shared_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    data: jsonb("data").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("shared_lists_updated_idx").on(t.updatedAt)]
);

// Log wyszukiwań (FEATURES.md §0): fraza + liczba wyników + źródło,
// bez ID użytkownika. Fingerprint służy TYLKO do odszumiania (throttling
// sugestii hero pisanych literka po literce), nie do profilowania.
// Top frazy = popyt; frazy bez wyników = luki w treści = brief na rolki.
export const searchLog = pgTable(
  "search_log",
  {
    id: serial("id").primaryKey(),
    phrase: text("phrase").notNull(),
    results: integer("results").notNull().default(0),
    source: text("source", { enum: ["hero", "szukaj", "lodowka"] }).notNull(),
    fingerprint: text("fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("search_log_phrase_idx").on(t.phrase),
    index("search_log_created_idx").on(t.createdAt),
  ]
);

export const redirects = pgTable(
  "redirects",
  {
    id: serial("id").primaryKey(),
    sourcePath: text("source_path").notNull(),
    targetPath: text("target_path").notNull(),
    permanent: boolean("permanent").notNull().default(true),
  },
  (t) => [uniqueIndex("redirects_source_idx").on(t.sourcePath)]
);

// Newsletter: the list lives HERE (owned data), Resend only delivers mail.
// Double opt-in: signup inserts `pending` + token, the confirmation link
// flips to `confirmed`; every mail carries an unsubscribe link with the same
// token. consentedAt/confirmedAt are the GDPR consent trail.
export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    status: text("status", { enum: ["pending", "confirmed", "unsubscribed"] })
      .notNull()
      .default("pending"),
    // Where the signup happened: recipe-slodkie | recipe-slone | kalkulator |
    // cook-mode | stopka - drives which magnet the welcome mail links
    source: text("source").notNull(),
    magnet: text("magnet"),
    token: text("token").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("subscribers_email_idx").on(t.email),
    uniqueIndex("subscribers_token_idx").on(t.token),
    index("subscribers_status_idx").on(t.status),
  ]
);

// Composed newsletter editions: `content` holds the section JSON the admin
// approved (sources: new recipes, seasonal window, top-read, "od Roksany").
export const newsletterEditions = pgTable("newsletter_editions", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["draft", "sent"] }).notNull().default("draft"),
  content: jsonb("content").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  recipientCount: integer("recipient_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Lekkie konta użytkowników (magic link, bez haseł) - odblokowują "zapisz
// przepis", a docelowo plan tygodnia i preferencje (strategia: owned audience).
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const loginTokens = pgTable(
  "login_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("login_tokens_token_idx").on(t.token)]
);

export const savedRecipes = pgTable(
  "saved_recipes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("saved_recipes_user_recipe_idx").on(t.userId, t.recipeId)]
);

// Zamienniki składników (strategia: Substitution z weryfikacją; FEATURES.md
// "Czym zastąpić?"). AI generuje szkice (source=ai, status=draft), Roksana
// akceptuje w adminie - na stronę trafiają wyłącznie approved.
export const substitutions = pgTable(
  "substitutions",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientText: text("ingredient_text").notNull(),
    substitute: text("substitute").notNull(),
    // wpływ na smak/teksturę jedną frazą + orientacyjna zmiana kcal na porcję
    effect: text("effect"),
    kcalDelta: integer("kcal_delta"),
    source: text("source", { enum: ["ai", "author"] }).notNull().default("ai"),
    status: text("status", { enum: ["draft", "approved", "rejected"] })
      .notNull()
      .default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("substitutions_recipe_idx").on(t.recipeId, t.status)]
);
