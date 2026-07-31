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
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// `uri` columns hold the exact WordPress permalinks (e.g. /przepisy/fit-rafaello/)
// — they are the SEO contract and must never change for imported content.

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

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  tiktokUrl: text("tiktok_url").notNull(),
  videoPath: text("video_path"),
  transcript: text("transcript"),
  aiDraft: jsonb("ai_draft"),
  status: text("status", {
    enum: ["pending", "processing", "ready", "approved", "rejected", "failed"],
  })
    .notNull()
    .default("pending"),
  // Live progress while processing: { step, total, label }
  progress: jsonb("progress"),
  recipeId: integer("recipe_id").references(() => recipes.id),
  operatorNotes: text("operator_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
