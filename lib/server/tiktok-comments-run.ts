// Pobieranie komentarzy pod filmem TikTok headless Chromium (puppeteer-core):
// otwiera stronę filmu, klika ikonę komentarzy i przechwytuje odpowiedzi
// /api/comment/list/ (strona sama podpisuje requesty X-Bogus). UWAGA: TikTok
// zwraca komentarze TYLKO zalogowanym - bez pliku cookies (TIKTOK_COOKIES_PATH,
// eksport z przeglądarki autorki w formacie Netscape "cookies.txt") wynik
// będzie pusty i zlecenie kończy się czytelnym błędem.
// yt-dlp odpada: jego ekstraktor TikToka w ogóle nie wspiera komentarzy.
import { existsSync, readFileSync } from "fs";
import { eq, sql } from "drizzle-orm";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import * as schema from "../db/schema";

const { tiktokCatalog, tiktokComments } = schema;

const MAX_COMMENTS = 1000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

type RawComment = {
  cid?: string;
  text?: string;
  digg_count?: number;
  create_time?: number;
  reply_id?: string;
  user?: { nickname?: string; unique_id?: string };
};

function chromiumPath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  // dev na macu
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  return "/usr/bin/chromium-browser";
}

// Netscape cookies.txt (eksport np. rozszerzeniem "Get cookies.txt LOCALLY").
function loadCookies(): { name: string; value: string; domain: string; path: string }[] {
  const file = process.env.TIKTOK_COOKIES_PATH;
  if (!file || !existsSync(file)) return [];
  const out: { name: string; value: string; domain: string; path: string }[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const f = line.split("\t");
    if (f.length >= 7 && f[0].includes("tiktok.com")) {
      out.push({ domain: f[0], path: f[2], name: f[5], value: f[6].trim() });
    }
  }
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function clickAt(page: Page, pos: { x: number; y: number } | null) {
  if (pos) await page.mouse.click(pos.x, pos.y);
}

export async function runTiktokComments(
  db: any,
  videoId: string,
  log: (s: string) => void = () => {}
): Promise<{ fetched: number; stored: number }> {
  const [video] = await db
    .select({ url: tiktokCatalog.url, commentCount: tiktokCatalog.commentCount })
    .from(tiktokCatalog)
    .where(eq(tiktokCatalog.videoId, videoId));
  if (!video) throw new Error(`Filmu ${videoId} nie ma w katalogu`);

  const cookies = loadCookies();
  log(
    cookies.length
      ? `Sesja TikTok: ${cookies.length} ciasteczek z ${process.env.TIKTOK_COOKIES_PATH}.`
      : "Brak pliku cookies (TIKTOK_COOKIES_PATH) - próbuję jako gość (TikTok zwykle ukrywa wtedy komentarze)."
  );

  log(`Otwieram ${video.url} w headless Chromium...`);
  let browser: Browser | null = null;
  const collected = new Map<string, RawComment>();
  try {
    browser = await puppeteer.launch({
      executablePath: chromiumPath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=pl-PL", "--window-size=1440,900"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(UA);
    if (cookies.length) await page.setCookie(...cookies);

    page.on("response", async (res) => {
      if (!res.url().includes("/api/comment/list/")) return;
      try {
        const data = JSON.parse(await res.text());
        for (const c of data.comments ?? []) if (c?.cid && c?.text) collected.set(c.cid, c);
      } catch {
        /* pusta odpowiedź dla gości */
      }
    });

    await page.goto(video.url, { waitUntil: "networkidle2", timeout: 90_000 });
    await wait(2500);

    // Baner cookies TikToka siedzi w shadow DOM i łapie kliknięcia.
    await clickAt(
      page,
      await page.evaluate(() => {
        const root = document.querySelector("tiktok-cookie-banner")?.shadowRoot;
        const b = root && [...root.querySelectorAll("button")].find((x) => /decline/i.test(x.textContent ?? ""));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      })
    );
    await wait(1200);

    // Ikona komentarzy przy filmie - dopiero prawdziwy klik myszą odpala
    // podpisany request listy komentarzy.
    await clickAt(
      page,
      await page.evaluate(() => {
        const r = document.querySelector('[data-e2e="comment-icon"]')?.getBoundingClientRect();
        return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
      })
    );
    await wait(4000);

    // Doładuj kolejne strony przewijaniem listy.
    for (let i = 0; i < 25 && collected.size < MAX_COMMENTS; i++) {
      const before = collected.size;
      await page.evaluate(() => {
        const items = document.querySelectorAll('[data-e2e="comment-level-1"]');
        if (items.length) items[items.length - 1].scrollIntoView({ block: "end" });
        const panel = document.querySelector('[data-e2e="comment-list"], [class*="DivCommentListContainer"]');
        if (panel) panel.scrollTop = panel.scrollHeight;
      });
      await wait(2200);
      if (collected.size === before && i > 2) break;
      if (i % 5 === 4) log(`Zebrano ${collected.size} komentarzy...`);
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  if (collected.size === 0) {
    if ((video.commentCount ?? 0) > 0) {
      throw new Error(
        cookies.length
          ? "TikTok nie zwrócił komentarzy mimo cookies - sesja mogła wygasnąć, wyeksportuj świeży plik."
          : "TikTok ukrywa komentarze dla niezalogowanych. Wgraj cookies sesji (patrz DEPLOY.md, sekcja komentarze TikTok)."
      );
    }
    log("Film nie ma komentarzy.");
    return { fetched: 0, stored: 0 };
  }

  const top = [...collected.values()]
    .sort((a, b) => (b.digg_count ?? 0) - (a.digg_count ?? 0))
    .slice(0, MAX_COMMENTS);

  for (const c of top) {
    await db
      .insert(tiktokComments)
      .values({
        videoId,
        commentId: String(c.cid),
        author: c.user?.nickname ?? c.user?.unique_id ?? null,
        text: c.text!.trim(),
        likeCount: c.digg_count ?? null,
        isReply: c.reply_id != null && c.reply_id !== "0",
        publishedAt: c.create_time != null ? new Date(c.create_time * 1000) : null,
      })
      .onConflictDoUpdate({
        target: tiktokComments.commentId,
        set: { likeCount: c.digg_count ?? null, fetchedAt: new Date() },
      });
  }
  await db
    .update(tiktokComments)
    .set({ fetchedAt: new Date() })
    .where(sql`${tiktokComments.videoId} = ${videoId}`);

  log(`Zapisano/zaktualizowano ${top.length} komentarzy (zebranych: ${collected.size}).`);
  return { fetched: collected.size, stored: top.length };
}
