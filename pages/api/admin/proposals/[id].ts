import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../../lib/admin-auth";
import { db } from "../../../../lib/db";
import { applyProposal, rejectProposal } from "../../../../lib/server/apply-proposal";
import { syncRecipeToSearch } from "../../../../lib/search-sync";
import { notifyIndexNow } from "../../../../lib/server/indexnow";

// POST {action: "apply" | "reject" | "revert"} dla jednej propozycji z audytu.
// Zapis punktowy + kontrola QC w lib/server/apply-proposal; tu dochodzi
// resync wyszukiwarki, revalidate strony i ping IndexNow (jak przy zapisie
// w edytorze).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Bad id" });
  const action = req.body?.action;

  try {
    if (action === "reject") {
      await rejectProposal(db, id);
      return res.json({ ok: true, status: "rejected" });
    }
    if (action !== "apply" && action !== "revert") return res.status(400).json({ error: "action?" });

    const result = await applyProposal(db, id, action);
    if (result.ok) {
      await syncRecipeToSearch(db, result.recipeId).catch(() => {});
      if (result.uri) {
        try {
          await res.revalidate(result.uri);
        } catch {}
        void notifyIndexNow([result.uri]);
      }
    }
    return res.status(result.ok ? 200 : 409).json(result);
  } catch (e: any) {
    return res.status(400).json({ error: e.message?.slice(0, 300) || "Błąd" });
  }
}
