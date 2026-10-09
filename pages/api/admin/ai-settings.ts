import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminApi } from "../../../lib/admin-auth";
import { db } from "../../../lib/db";
import { defaultAiModels, getAiModels, saveAiModels } from "../../../lib/server/ai-models";
import { listChatModels } from "../../../lib/server/ai-chat";

// GET: modele per etap + domyślne z env + lista modeli dostępnych na kluczu.
// POST {models: {draft?, refine?, nutrition?}}: zapis do app_settings.
// Worker czyta ustawienia na początku każdego przebiegu kolejki.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdminApi(req, res)) return;

  if (req.method === "GET") {
    const [models, available] = await Promise.all([getAiModels(db), listChatModels()]);
    return res.json({ models, defaults: defaultAiModels(), available, hasKey: !!process.env.OPENAI_API_KEY });
  }

  if (req.method === "POST") {
    const patch = req.body?.models ?? {};
    try {
      const models = await saveAiModels(db, patch);
      return res.json({ ok: true, models });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
