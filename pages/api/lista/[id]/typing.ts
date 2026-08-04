import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { uuidSchema } from "../../../../lib/server/list-validation";
import { publish } from "../../../../lib/server/list-bus";

// Ephemeral typing indicator (freshlist's START_TYPING/STOP_TYPING):
// broadcast-only, nothing persisted.
const bodySchema = z.object({
  clientId: z.string().min(1).max(64),
  typing: z.boolean(),
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = uuidSchema.safeParse(req.query.id);
  const body = bodySchema.safeParse(req.body);
  if (!id.success || !body.success) {
    return res.status(400).json({ error: "Bad request" });
  }
  publish(id.data, "typing", body.data);
  return res.status(204).end();
}
