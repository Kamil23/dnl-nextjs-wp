# Wdrożenie i utrzymanie — dietanaluzie.pl

Self-hosting na VPS (Hetzner) w Docker Compose: **Postgres + Meilisearch + Next.js (standalone) + Caddy** (TLS/reverse proxy). **WordPress jest wyłączony** — wszystkie media hostujemy u siebie, Caddy serwuje je bezpośrednio z dysku.

```
Internet ──▶ Caddy (:80/:443, auto-TLS)
                 ├─ /wp-content/uploads/*  ─▶ pliki z /srv/dnl/media  (legacy, Google Images)
                 ├─ /uploads/*             ─▶ pliki z /srv/dnl/media  (klatki TikTok)
                 └─ reszta                 ─▶ web (Next.js :3000) ──▶ db (Postgres)
                                                                   └─▶ meili (:7700)
             worker (import TikTok) ─▶ db + /srv/dnl/media  (poll kolejki co 10 s)
```

> Pełny audyt pre-prod: **[Artifact](https://claude.ai/code/artifact/cbb072f2-e7f4-45a8-a9a3-0e0cf5468b6b)**.

WordPress (stary box Plesk) nie jest już częścią architektury. Trzymamy go **włączonego, ale nieużywanego** przez kilka tygodni po cutoverze jako rollback-safety, potem można go wygasić.

---

## Wymagania na VPS

- Docker Engine + Docker Compose v2 (`docker compose version`)
- Otwarte porty 80 i 443 (uwaga: jeśli działa tam już inna appka z własnym reverse proxy — patrz "Współdzielenie serwera")
- Kontrola DNS dla `dietanaluzie.pl` (rekord A/AAAA apex + www)
- Katalog na media, np. `/srv/dnl/media`, z podkatalogami `wp-content/uploads/` (legacy) i `uploads/` (nowe)

---

## Pierwsze wdrożenie

```bash
# 0. Kod
git clone <repo> dnl && cd dnl
git checkout <tag-lub-main>

# 1. Konfiguracja
cp .env.production.example .env
nano .env    # uzupełnij; ADMIN_SECRET/MEILI_MASTER_KEY: openssl rand -hex 32
             # WORDPRESS_API_URL zostaw PUSTE (WP jest wyłączony)
             # MEDIA_DIR=/srv/dnl/media

# 2. Media: skopiuj katalog uploads ze starego WP na serwer (patrz niżej "Transfer mediów")
#    Docelowo: /srv/dnl/media/wp-content/uploads/...   (legacy)
#              /srv/dnl/media/uploads/...              (nowe/TikTok, tworzone później)
mkdir -p /srv/dnl/media/wp-content/uploads /srv/dnl/media/uploads

# 3. Baza + search
docker compose up -d db meili
docker compose run --rm tools npm run db:push        # schemat (Drizzle)

# 4. Dane: załaduj gotową bazę (zrzut z lokalnego/dev Postgresa — 114 przepisów).
#    Na maszynie z danymi:  pg_dump "$DATABASE_URL" | gzip > dnl.sql.gz
#    Skopiuj dnl.sql.gz na VPS, potem:
gunzip -c dnl.sql.gz | docker compose exec -T db psql -U dnl dietanaluzie
docker compose run --rm tools npm run search:reindex # indeks Meilisearch z DB

# 5. Build aplikacji (czyta zapełnioną bazę przez sieć hosta) + start
docker compose build web worker
docker compose up -d web worker caddy

# 6. Smoke-test (sekcja "Weryfikacja po starcie")
```

> **Alternatywa dla kroku 4** (jeśli nie robisz zrzutu): `docker compose run --rm tools npm run import:wp` — ale wymaga ŻYWEGO WordPressa (skrypt scrapuje apex po ocenach), więc uruchom PRZED przełączeniem DNS i ustaw `WORDPRESS_API_URL` na stary apex.

---

## Transfer mediów (~0,3 GB, jednorazowo)

Kopiujemy **cały** katalog `wp-content/uploads/` (z wariantami rozmiarów — inline `<img>` i `next/image` odwołują się do konkretnych nazw plików).

**Opcja A — rsync (jeśli masz SSH do Plesku):**
```bash
rsync -avz --progress \
  plesk-user@51.75.54.187:/var/www/vhosts/dietanaluzie.pl/httpdocs/wp-content/uploads/ \
  /srv/dnl/media/wp-content/uploads/
# (ścieżkę źródłową zweryfikuj `ls` na Plesku — układ vhostów bywa różny)
```

**Opcja B — panel Plesk (bez SSH):** File Manager → spakuj `wp-content/uploads/` do ZIP → pobierz → wgraj na VPS → rozpakuj do `/srv/dnl/media/wp-content/uploads/`.

Weryfikacja kompletności:
```bash
find /srv/dnl/media/wp-content/uploads -type f | wc -l   # liczba plików
du -sh /srv/dnl/media                                     # rozmiar
```

---

## 🔄 Jak robić aktualizacje

### A. Zmiana w kodzie (najczęstsze)
```bash
cd dnl
git pull
docker compose build web worker # rebuild obrazów (build web czyta bazę → db musi być up)
docker compose up -d web worker # podmiana kontenerów; caddy/db/meili/media nietknięte
```

### B. Zmiana schematu bazy
```bash
git pull
docker compose run --rm tools npm run db:push
docker compose build web
docker compose up -d web
```

### C. Zmiana w wyszukiwarce / masowa zmiana przepisów
```bash
docker compose run --rm tools npm run search:reindex
```

> **ISR:** edycje treści w panelu admina odświeżają się same (`revalidate: 60`) — redeploy tylko przy zmianach **kodu** lub **schematu**. Media dodane w panelu/imporcie lądują na wolumenie `/srv/dnl/media` i są od razu serwowane przez Caddy (bez rebuildu).

---

## Operacje codzienne

| Zadanie | Komenda |
|---|---|
| Dodanie/edycja przepisu | Panel `https://dietanaluzie.pl/admin` (edycja robi on-demand ISR) |
| Moderacja ocen | `/admin/oceny` (tylko zatwierdzone liczą się do JSON-LD) |
| Import z TikToka | `/admin/tiktok` (wklej link) — serwis `worker` podejmuje kolejkę sam w ~10 s (`docker compose logs -f worker`) |
| Reindeks wyszukiwarki | `docker compose run --rm tools npm run search:reindex` |
| Logi aplikacji / proxy | `docker compose logs -f web` / `docker compose logs -f caddy` |
| Restart aplikacji | `docker compose restart web` |
| Status | `docker compose ps` |

### Backupy (DB **oraz** media — jedyne źródło prawdy)

Backupy lądują w **`/srv/dnl/backups`** (DB dump + tar mediów). Trzy drogi tworzenia, wszystkie do tego samego katalogu:

- **Panel admina** `/admin/backupy` — lista, przycisk „Zrób backup teraz", pobieranie plików. (Kontener `web` ma `pg_dump` i zamontowane media + katalog backupów.)
- **Cron co 3 dni** (host) — patrz niżej.
- **Ręcznie z hosta** (awaryjnie): `/opt/dnl/backup.sh`.

**Jednorazowy setup katalogu** (musi być zapisywalny przez usera kontenera, uid 1001):
```bash
mkdir -p /srv/dnl/backups && chown 1001:1001 /srv/dnl/backups
```

**Skrypt hosta + cron co 3 dni:**
```bash
cat > /opt/dnl/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/dnl
DEST=/srv/dnl/backups; mkdir -p "$DEST"
STAMP=$(date +%Y-%m-%dT%H-%M-%S)
docker compose exec -T db pg_dump --no-owner --no-privileges -U dnl dietanaluzie | gzip > "$DEST/db-$STAMP.sql.gz"
tar czf "$DEST/media-$STAMP.tar.gz" -C /srv/dnl/media .
ls -1t "$DEST"/db-*.sql.gz    2>/dev/null | tail -n +9 | xargs -r rm -f
ls -1t "$DEST"/media-*.tar.gz 2>/dev/null | tail -n +9 | xargs -r rm -f
EOF
chmod +x /opt/dnl/backup.sh
( crontab -l 2>/dev/null | grep -v '/opt/dnl/backup.sh'; echo "0 3 */3 * * /opt/dnl/backup.sh >> /var/log/dnl-backup.log 2>&1" ) | crontab -
```
(nazwy `db-<stamp>.sql.gz` / `media-<stamp>.tar.gz` są wspólne z panelem, więc lista w adminie pokazuje jedno i drugie; trzymane ostatnie 8 z każdego rodzaju.)

**Odtworzenie:**
```bash
gunzip -c /srv/dnl/backups/db-<stamp>.sql.gz | docker compose exec -T db psql -U dnl dietanaluzie
tar xzf /srv/dnl/backups/media-<stamp>.tar.gz -C /srv/dnl/media
```
**Pełny restore wymaga OBU** — sama baza bez mediów = strony bez obrazów. Dla DR co jakiś czas ściągnij `db-*.sql.gz` off-box.

---

## Weryfikacja po starcie

```bash
# Legacy media serwowane lokalnie z dysku (NIE z WP):
curl -sI https://dietanaluzie.pl/wp-content/uploads/2019/11/20191027_103430-1-scaled.jpg | head -5
# oczekiwane: HTTP/2 200, image/jpeg  (w `docker compose logs caddy` widać file_server)

# Przepis 200 + <title>/canonical/og:image (absolutny):
curl -s https://dietanaluzie.pl/przepisy/ciastka-owsiane-z-gorzka-czekolada/ | grep -E '<title>|canonical|og:image'

# Redirecty sklepu (301 → /):
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://dietanaluzie.pl/sklep/

# Sitemap + robots:
curl -s https://dietanaluzie.pl/sitemap.xml | grep -c '<loc>'

# Rich Results: wklej URL przepisu do https://search.google.com/test/rich-results
# GSC: zgłoś https://dietanaluzie.pl/sitemap.xml, monitoruj 404 przez 7-14 dni.
```

---

## Współdzielenie serwera (inna appka już działa na tym Dockerze)

Jeśli na VPS działa już inna aplikacja z **własnym reverse proxy** na 80/443, NIE uruchamiaj naszego Caddy na tych portach. Dwa wyjścia:
- Wepnij nasz `web` (i serwowanie mediów) w istniejące proxy — skieruj `dietanaluzie.pl` na `web:3000`, a `/wp-content/uploads/*` i `/uploads/*` na katalog `/srv/dnl/media` (statyczny root w tamtym proxy). Wtedy usuń serwis `caddy` z compose.
- Albo daj naszemu Caddy inne porty i postaw je za tamtym proxy.

Jeśli 80/443 są wolne — zostaje nasze Caddy bez zmian. (Ustalimy na podstawie rekonesansu: `docker ps`, `sudo ss -tlnp | grep -E ':80|:443'`.)

---

## Troubleshooting

**Obrazy 404** — sprawdź, czy pliki są w `/srv/dnl/media/wp-content/uploads/...` i czy `MEDIA_DIR` w `.env` wskazuje właściwy katalog; `docker compose logs caddy` pokaże, czy `file_server` je znajduje.

**`next/image` nie ładuje hero** — apex musi być w `images.domains` (dzieje się automatycznie z `APP_ORIGIN`). Jeśli optymalizator w kontenerze `web` nie dosięga publicznego hosta (brak hairpin NAT), dodaj alias sieciowy `dietanaluzie.pl` na serwis `caddy` w compose, żeby self-fetch rozwiązał się wewnątrz sieci Dockera.

**Klatki TikTok znikają po imporcie** — `worker`/`tools` musi mieć zamontowany wolumen `/srv/dnl/media` i `UPLOADS_DIR=/srv/media/uploads` (jest w compose). Pliki mają lądować w `/srv/dnl/media/uploads/imports/<id>/`.

**Import z TikToka wisi w „W kolejce"** — sprawdź `docker compose ps worker` (musi być up) i `docker compose logs -f worker`; najczęstsza przyczyna to brak klucza AI w `.env` (`OPENAI_API_KEY` lub `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`).

**`docker compose build web` nie widzi bazy** — db musi być `up`/healthy przed buildem. Build używa `network: host` i łączy się z `127.0.0.1:5432`.

**Caddy nie dostaje certu** — DNS apexu musi już wskazywać na VPS, porty 80/443 otwarte. Do testów przed cutoverem: IP/`/etc/hosts` + `curl -k`.

---

## Uwagi

- `.env` jest w `.gitignore` — sekrety nigdy nie trafiają do repo.
- `DATABASE_URL` jako build-arg trafia do warstw obrazu (`docker history`) — to lokalne dane dostępowe do bazy na Twoim VPS, nie współdziel obrazu publicznie.
- Panel admina: zrotuj `ADMIN_PASSWORD` na mocne hasło przed startem (login ma limit prób: 5 → blokada 15 min).
- Importy TikTok na VPS wymagają `ffmpeg` + `yt-dlp` — są w obrazie `tools` (Dockerfile, warstwa `source`).

---

## Ruch server-side (niezależny od zgód cookies)

Caddy pisze access log (JSON) do wolumenu. Szybka analiza dziennych wejść na strony
(bez assetów, botów nie filtruje — trендy i tak widać):

```bash
# odsłony HTML dziś (bez /_next, mediów i API)
docker compose exec caddy sh -c 'cat /data/access/access.log' \
 | grep '"status":200' \
 | grep -vE '"uri":"/(_next|wp-content|uploads|pobrane|api|favicon)' \
 | grep -oE '"uri":"[^"]*"' | sort | uniq -c | sort -rn | head -20

# unikalne IP dziś
docker compose exec caddy sh -c 'cat /data/access/access.log' \
 | grep -oE '"client_ip":"[^"]*"' | sort -u | wc -l
```

Po co: GA po banerze cookies liczy tylko osoby, które kliknęły „Akceptuję"
(zwykle 50-70%). Prawdziwy poziom ruchu odczytujemy z logów serwera.
