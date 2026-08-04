import { z } from "zod";
import { MAX_ITEM_LENGTH, MAX_NAME_LENGTH, MAX_TOTAL_ITEMS } from "../shopping-list-ops";

const recipeRefSchema = z
  .object({
    id: z.number().int(),
    title: z.string().min(1).max(200),
    uri: z.string().min(1).max(300).startsWith("/"),
  })
  .nullish();

export const newItemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(MAX_ITEM_LENGTH),
  recipe: recipeRefSchema,
});

const fullItemSchema = newItemSchema.extend({
  checked: z.boolean(),
  checkedAt: z.number().nullish(),
});

export const listDataSchema = z.array(fullItemSchema).max(MAX_TOTAL_ITEMS);

export const listOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("addItems"),
    items: z.array(newItemSchema).min(1).max(MAX_TOTAL_ITEMS),
    replaceRecipeId: z.number().int().nullish(),
    at: z.enum(["start", "end"]).optional(),
  }),
  z.object({
    op: z.literal("updateItem"),
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(MAX_ITEM_LENGTH),
  }),
  z.object({ op: z.literal("removeItem"), id: z.string().min(1).max(64) }),
  z.object({
    op: z.literal("toggleItem"),
    id: z.string().min(1).max(64),
    checked: z.boolean(),
  }),
  z.object({
    op: z.literal("reorder"),
    ids: z.array(z.string().min(1).max(64)).max(MAX_TOTAL_ITEMS),
  }),
  z.object({ op: z.literal("clearChecked"), checkedBefore: z.number().optional() }),
  z.object({ op: z.literal("replaceAll"), items: z.array(fullItemSchema).max(MAX_TOTAL_ITEMS) }),
  z.object({ op: z.literal("rename"), name: z.string().min(1).max(MAX_NAME_LENGTH) }),
]);

export const uuidSchema = z.string().uuid();
