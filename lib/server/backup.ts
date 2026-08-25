// Backups: Postgres dump (pg_dump | gzip) + media tarball, written to BACKUP_DIR.
// Runs inside the web container, which mounts the media (ro) and the backups dir
// (rw) and has pg_dump on PATH + DATABASE_URL. The every-3-days host cron writes
// to the same directory with the same naming, so the admin list shows both.
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import zlib from "zlib";
import fs from "fs";
import path from "path";

const execFileP = promisify(execFile);
const BACKUP_DIR = process.env.BACKUP_DIR || "/srv/backups";
const MEDIA_DIR = process.env.BACKUP_MEDIA_DIR || "/srv/media";
// Retention by value, not by file type: DB dumps are the irreplaceable part
// (recipes, subscribers, ratings, comments) and cost ~160 KB each, so we keep
// weeks of history - protects against corruption noticed late. Media tarballs
// are ~330 MB and mostly re-derivable, so only previous + freshly created.
const KEEP: Record<"db" | "media", number> = { db: 14, media: 2 };

export type BackupFile = {
  name: string;
  kind: "db" | "media";
  size: number;
  mtime: string;
};

// Only these exact shapes are ever listed/served - guards path traversal.
const NAME_RE = /^(db|media)-[0-9T:-]+\.(sql\.gz|tar\.gz)$/;

export function listBackups(): BackupFile[] {
  let files: string[];
  try {
    files = fs.readdirSync(BACKUP_DIR);
  } catch {
    return [];
  }
  return files
    .filter((f) => NAME_RE.test(f))
    .map((f) => {
      const s = fs.statSync(path.join(BACKUP_DIR, f));
      return {
        name: f,
        kind: f.startsWith("media-") ? ("media" as const) : ("db" as const),
        size: s.size,
        mtime: s.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

// Resolve a requested filename to a safe absolute path (or null).
export function backupFilePath(name: string): string | null {
  const base = path.basename(name || "");
  if (!NAME_RE.test(base)) return null;
  const full = path.join(BACKUP_DIR, base);
  return fs.existsSync(full) ? full : null;
}

function stamp(): string {
  // 2026-08-05T14-30-45 - filesystem-safe, sortable, matches the host cron
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function dumpDb(outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = process.env.DATABASE_URL;
    if (!url) return reject(new Error("Brak DATABASE_URL"));
    const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", url]);
    const out = fs.createWriteStream(outPath);
    let exited = false;
    let finished = false;
    let err: Error | null = null;
    const done = () => {
      if (exited && finished) (err ? reject(err) : resolve());
    };
    dump.on("error", reject);
    dump.stderr.on("data", (d) => {
      const s = String(d).trim();
      if (s) console.error("pg_dump:", s.slice(0, 200));
    });
    dump.on("close", (code) => {
      exited = true;
      if (code !== 0) err = new Error(`pg_dump zakończył się kodem ${code}`);
      done();
    });
    out.on("error", reject);
    out.on("finish", () => {
      finished = true;
      done();
    });
    dump.stdout.pipe(zlib.createGzip()).pipe(out);
  });
}

function prune() {
  const byKind: Record<"db" | "media", BackupFile[]> = { db: [], media: [] };
  for (const b of listBackups()) byKind[b.kind].push(b); // newest-first
  for (const kind of ["db", "media"] as const) {
    for (const b of byKind[kind].slice(KEEP[kind])) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, b.name));
      } catch {
        /* ignore */
      }
    }
  }
}

export async function createBackup(): Promise<{ db: string; media: string }> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const s = stamp();
  const dbName = `db-${s}.sql.gz`;
  const mediaName = `media-${s}.tar.gz`;
  await dumpDb(path.join(BACKUP_DIR, dbName));
  // busybox tar (alpine) supports -z; media dir is read-only, output goes to BACKUP_DIR
  await execFileP(
    "tar",
    ["czf", path.join(BACKUP_DIR, mediaName), "-C", MEDIA_DIR, "."],
    { maxBuffer: 4 * 1024 * 1024 }
  );
  prune();
  return { db: dbName, media: mediaName };
}
