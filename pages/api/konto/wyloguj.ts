import type { NextApiRequest, NextApiResponse } from "next";
import { clearUserCookieHeader } from "../../../lib/user-auth";

// Wylogowanie czytelnika: czyścimy cookie sesji (token w cookie jest
// samowystarczalny, nie ma nic do skasowania w bazie).
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Set-Cookie", clearUserCookieHeader());
  return res.status(200).json({ ok: true });
}
