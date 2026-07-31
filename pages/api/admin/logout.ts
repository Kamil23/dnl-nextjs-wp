import type { NextApiRequest, NextApiResponse } from "next";
import { adminCookieHeader } from "../../../lib/admin-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Set-Cookie", adminCookieHeader("", 0));
  return res.status(200).json({ ok: true });
}
