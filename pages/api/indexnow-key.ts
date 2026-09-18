import type { NextApiRequest, NextApiResponse } from "next";

// Plik klucza IndexNow, publicznie dostępny jako /<klucz>.txt w ROOTCIE domeny
// (rewrite w next.config.js) - katalog pliku klucza wyznacza zakres URL-i,
// które można zgłaszać, więc root obejmuje całą witrynę.
// Klucz nie jest sekretem - służy tylko do potwierdzenia własności domeny.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return res.status(404).end();
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=86400");
  res.send(key);
}
