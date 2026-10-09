// Klatki z rolki: 1 klatka na sekundę, potem deduplikacja (dHash) i pomiar
// ostrości (wariancja Laplasjanu) przez sharp. Zostają tylko klatki, które
// pokazują coś nowego; z grupy podobnych najostrzejsza. Każda ma czas `t`.
// Dla modelu powstają miniatury 512 px (tańsze tokeny); publikowane są
// wyłącznie pełne 1080 px.
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const run = promisify(execFile);

export type ExtractedFrame = {
  path: string;
  thumbPath: string;
  t: number;
  sharpness: number;
  hash: Uint8Array; // 64 bitów dHash jako 0/1
};

export const FRAME_LIMITS = {
  fps: 1,
  hardMax: 48,
  // dystans Hamminga dHash (64 bit) poniżej którego klatki uznajemy za tę samą scenę
  similar: 8,
  thumbWidth: 512,
};

async function dHash(file: string): Promise<Uint8Array> {
  const buf = await sharp(file).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  const bits = new Uint8Array(64);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits[y * 8 + x] = buf[y * 9 + x] > buf[y * 9 + x + 1] ? 1 : 0;
    }
  }
  return bits;
}

function hamming(a: Uint8Array, b: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) n++;
  return n;
}

// Wariancja Laplasjanu na 320 px: wyższa = ostrzejsza klatka
async function sharpness(file: string): Promise<number> {
  const { data, info } = await sharp(file)
    .grayscale()
    .resize(320, null, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * data[i] - data[i - 1] - data[i + 1] - data[i - w] - data[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return Math.round(sumSq / n - mean * mean);
}

export async function probeDuration(videoPath: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath,
  ]);
  return Math.max(1, parseFloat(stdout.trim()) || 30);
}

export async function extractFrames(videoPath: string, dir: string): Promise<ExtractedFrame[]> {
  const framesDir = path.join(dir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });
  await run(
    "ffmpeg",
    ["-i", videoPath, "-vf", `fps=${FRAME_LIMITS.fps},scale=1080:-2`, "-q:v", "3", path.join(framesDir, "frame-%03d.jpg")],
    { timeout: 180_000 }
  );
  const files = fs
    .readdirSync(framesDir)
    .filter((f) => /^frame-\d{3}\.jpg$/.test(f))
    .sort();

  // fps=1 -> klatka k reprezentuje sekundę k (środek przedziału)
  const all: ExtractedFrame[] = [];
  for (let i = 0; i < files.length; i++) {
    const p = path.join(framesDir, files[i]);
    all.push({ path: p, thumbPath: "", t: i + 0.5, sharpness: await sharpness(p), hash: await dHash(p) });
  }

  // Deduplikacja: klatka podobna do ostatniej zachowanej zastępuje ją tylko
  // wtedy, gdy jest wyraźnie ostrzejsza (ta sama scena, lepszy kadr)
  const keep = (threshold: number): ExtractedFrame[] => {
    const out: ExtractedFrame[] = [];
    for (const f of all) {
      const last = out[out.length - 1];
      if (last && hamming(last.hash, f.hash) <= threshold) {
        if (f.sharpness > last.sharpness * 1.25) out[out.length - 1] = f;
        continue;
      }
      out.push(f);
    }
    return out;
  };
  let threshold = FRAME_LIMITS.similar;
  let kept = keep(threshold);
  while (kept.length > FRAME_LIMITS.hardMax && threshold < 24) {
    threshold += 2;
    kept = keep(threshold);
  }
  if (kept.length > FRAME_LIMITS.hardMax) {
    // nadal za dużo: równomierna próbka
    const step = kept.length / FRAME_LIMITS.hardMax;
    kept = Array.from({ length: FRAME_LIMITS.hardMax }, (_, i) => kept[Math.floor(i * step)]);
  }
  if (kept.length === 0 && all.length) kept = [all[0]];

  for (const f of kept) {
    f.thumbPath = f.path.replace(/\.jpg$/, ".s.jpg");
    await sharp(f.path).resize(FRAME_LIMITS.thumbWidth, null, { fit: "inside" }).jpeg({ quality: 80 }).toFile(f.thumbPath);
  }
  // usuń odrzucone pełne klatki, żeby nie trafiły do publikacji
  const keptPaths = new Set(kept.map((f) => f.path));
  for (const f of all) if (!keptPaths.has(f.path)) fs.rmSync(f.path, { force: true });
  return kept;
}

// Równomierna próbka z unikalnych klatek (kontekst dla etapu draftu)
export function sampleFrames<T>(frames: T[], n: number): T[] {
  if (frames.length <= n) return frames;
  const step = frames.length / n;
  return Array.from({ length: n }, (_, i) => frames[Math.floor(i * step)]);
}
