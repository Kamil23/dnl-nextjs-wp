import type { NextApiRequest, NextApiResponse } from "next";

// Plik klucza IndexNow: protokół wymaga, by klucz był publicznie dostępny na
// tym samym hoście (przekazujemy ten adres jako keyLocation w pingach).
// Klucz nie jest sekretem - służy tylko do potwierdzenia własności domeny.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return res.status(404).end();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=86400");
  res.send(key);
}
