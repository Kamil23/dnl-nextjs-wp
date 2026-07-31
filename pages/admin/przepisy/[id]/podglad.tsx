import { GetServerSideProps } from "next";
import Link from "next/link";
import Content from "../../../[...uri]";
import { isAdminRequest } from "../../../../lib/admin-auth";
import {
  getRecipeById,
  listPublishedRecipes,
  toLegacyPost,
  toListingEdge,
} from "../../../../lib/queries";
import { buildSeoForRecipe } from "../../../../lib/seo";
import { stripRecipeBlocks } from "../../../../lib/recipe-parser";
import { SITE_URL } from "../../../../lib/constants";

// Admin-only preview: renders the REAL public recipe page for any status
// (drafts included), with a bar linking back to the editor.
export default function DraftPreview({ id, status, ...props }: any) {
  return (
    <>
      <div className="bg-gray-900 text-white text-sm px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <span>
          👁 Podgląd {status !== "published" ? "szkicu" : "wpisu"} — tak będzie wyglądać strona
        </span>
        <Link href={`/admin/przepisy/${id}`} className="underline hover:no-underline">
          ← Wróć do edytora
        </Link>
      </div>
      <Content {...props} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const id = parseInt(params.id as string, 10);
  if (!Number.isInteger(id)) return { notFound: true };

  const recipe = await getRecipeById(id);
  if (!recipe) return { notFound: true };

  const all = await listPublishedRecipes();
  const morePosts = all
    .filter((r) => r.uri !== recipe.uri)
    .slice(0, 4)
    .map(toListingEdge);

  return {
    props: JSON.parse(
      JSON.stringify({
        id,
        status: recipe.status,
        kind: "recipe",
        recipe,
        post: toLegacyPost(recipe, SITE_URL),
        morePosts,
        introHtml: recipe.contentHtml ? stripRecipeBlocks(recipe.contentHtml) : null,
        seo: buildSeoForRecipe(recipe),
      })
    ),
  };
};
