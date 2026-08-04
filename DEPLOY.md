# Wdrożenie i utrzymanie — dietanaluzie.pl

Self-hosting na VPS (Hetzner) w Docker Compose: **Postgres + Meilisearch + Next.js (standalone) + Caddy** (TLS/reverse proxy). Cały ruch idzie przez Caddy → `web:3000`. Aplikacja sama proxuje `/wp-content/uploads/*` do WordPressa na subdomenie.

```
Internet ──▶ Caddy (:80/:443, auto-TLS)
                 └─▶ web (Next.js :3000) ──▶ db (Postgres :5432)
                          │                └─▶ meili (:7700)
                          └─ /wp-content/uploads/* ─▶ https://wp.dietanaluzie.pl  (stary WP, tylko media)
```

> Pełny audyt pre-prod i szczegółowy runbook cutover: **[Artifact](https://claude.ai/code/artifact/cbb072f2-e7f4-45a8-a9a3-0e0cf5468b6b)**.

---

## ⚠️ Zasada nr 1 (bez tego wszystko pada)

WordPress musi żyć na **subdomenie** `wp.dietanaluzie.pl`, a `WORDPRESS_API_URL` musi wskazywać na nią — **nigdy** na apex `dietanaluzie.pl`. Inaczej proxy mediów zapętla się na aplikację i wszystkie obrazy przepisów zwracają 5xx. Build celowo **przerywa się** (guard w `next.config.js`), jeśli `WORDPRESS_API_URL` == `APP_ORIGIN`.

---

## Wymagania na VPS

- Docker Engine + Docker Compose v2 (`docker compose version`)
- Otwarte porty 80 i 443
- Kontrola DNS dla `dietanaluzie.pl` (rekordy A/AAAA + subdomena `wp`)
- Stary WordPress przeniesiony na `wp.dietanaluzie.pl` (serwuje tylko `/wp-content/uploads/*`)

---

## Pierwsze wdrożenie (cutover)

```bash
# 0. Kod na serwerze
git clone <repo> dnl && cd dnl
git checkout <tag-lub-main>

# 1. Konfiguracja
cp .env.production.example .env
nano .env          # uzupełnij WSZYSTKO; ADMIN_SECRET/MEILI_MASTER_KEY: openssl rand -hex 32
                   # WORDPRESS_API_URL = https://wp.dietanaluzie.pl/graphql  (subdomena!)

# 2. Baza + search
docker compose up -d db meili

# 3. Schemat + dane (kolejność ważna — build pre-renderuje strony z bazy)
docker compose run --rm tools npm run db:push          # migracje (Drizzle)
docker compose run --rm tools npm run import:wp         # import 113 przepisów z WP (subdomena)
docker compose run --rm tools npm run search:reindex    # indeks Meilisearch

# 4. Build aplikacji (czyta zapełnioną bazę przez sieć hosta) + start
docker compose build web
docker compose up -d web caddy

# 5. Smoke-test (patrz sekcja "Weryfikacja po starcie")
```

> **Rollback:** przełącz rekordy A/AAAA apexu z powrotem na IP starego WP. WP jest nietknięty. Trzymaj niski TTL (300s) na czas cutoveru.

---

## 🔄 Jak robić aktualizacje

### A. Zmiana w kodzie (najczęstsze)
```bash
cd dnl
git pull
docker compose build web        # rebuild obrazu (build czyta bazę → db musi być up)
docker compose up -d web         # podmiana kontenera, reszta bez restartu
```
Caddy, db i meili zostają nietknięte. `web` wstaje z nowym obrazem w kilka sekund.

### B. Zmiana schematu bazy (nowe kolumny/tabele)
```bash
git pull
docker compose run --rm tools npm run db:push   # najpierw migracja
docker compose build web
docker compose up -d web
```

### C. Zmiana w wyszukiwarce (pola indeksu / nowe przepisy masowo)
```bash
docker compose run --rm tools npm run search:reindex
```

### D. Aktualizacja wszystkiego naraz (skrót)
```bash
git pull
docker compose run --rm tools npm run db:push
docker compose build web
docker compose up -d web
docker compose run --rm tools npm run search:reindex
```

> **ISR:** treść przepisów odświeża się sama (`revalidate: 60`) — edycje w panelu admina nie wymagają redeploya. Redeploy potrzebny tylko przy zmianach **kodu** lub **schematu**.

---

## Operacje codzienne

| Zadanie | Komenda |
|---|---|
| Dodanie/edycja przepisu | Panel: `https://dietanaluzie.pl/admin` (edycja robi on-demand ISR) |
| Moderacja ocen | Panel: `/admin/oceny` (tylko zatwierdzone liczą się do JSON-LD) |
| Import z TikToka | `/admin/tiktok` (wklej link) → `docker compose run --rm tools npm run imports:process` |
| Reindeks wyszukiwarki | `docker compose run --rm tools npm run search:reindex` |
| Logi aplikacji | `docker compose logs -f web` |
| Logi proxy/TLS | `docker compose logs -f caddy` |
| Restart aplikacji | `docker compose restart web` |
| Status | `docker compose ps` |

### Backup bazy (rób regularnie / przed każdą aktualizacją schematu)
```bash
docker compose exec db pg_dump -U dnl dietanaluzie | gzip > backup-$(date +%F).sql.gz
# odtworzenie:
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U dnl dietanaluzie
```

---

## Weryfikacja po starcie

```bash
# Media proxy działa i NIE zapętla się (najważniejsze):
curl -sI https://dietanaluzie.pl/wp-content/uploads/2019/11/20191027_103430-1-scaled.jpg | head -5
# oczekiwane: HTTP/2 200, image/jpeg  —  NIE 508/502

# Przykładowy przepis 200 + poprawny <title>/canonical/JSON-LD:
curl -s https://dietanaluzie.pl/przepisy/ciastka-owsiane-z-gorzka-czekolada/ | grep -E '<title>|canonical'

# Redirecty sklepu (301 → /):
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://dietanaluzie.pl/sklep/

# Sitemap + robots:
curl -s https://dietanaluzie.pl/sitemap.xml | grep -c '<loc>'
curl -s https://dietanaluzie.pl/robots.txt

# Rich Results: wklej URL przepisu do https://search.google.com/test/rich-results
# GSC: zgłoś https://dietanaluzie.pl/sitemap.xml, monitoruj 404 przez 7-14 dni.
```

---

## Troubleshooting

**Build przerywa się: „Media proxy loop…”** — `WORDPRESS_API_URL` wskazuje na apex. Ustaw subdomenę `wp.` w `.env` i rebuild.

**Obrazy 404 / `508 Loop Detected`** — WP nie jest na subdomenie albo `WORDPRESS_API_URL` zły. Sprawdź `curl -I https://wp.dietanaluzie.pl/wp-content/uploads/…jpg` = 200.

**next/image: „hostname not configured”** — apex musi być w `images.domains`; dzieje się to automatycznie, gdy `APP_ORIGIN` jest ustawione w `.env`. Zweryfikuj `.env` i rebuild.

**`docker compose build web` nie widzi bazy** — db musi być `up` i zdrowe przed buildem (`docker compose up -d db && docker compose ps`). Build używa `network: host` i łączy się z `127.0.0.1:5432`.

**Caddy nie dostaje certu** — DNS apexu musi już wskazywać na VPS, porty 80/443 otwarte. Do testów przed cutoverem używaj IP/`/etc/hosts` i `curl -k`.

**Homepage bez „Hitów czytelników” z GA** — brak `GA4_*`; działa fallback na najlepiej oceniane. To nie błąd.

---

## Uwagi

- `.env` jest w `.gitignore` — sekrety nigdy nie trafiają do repo.
- `DATABASE_URL` przekazywany jako build-arg trafia do warstw obrazu (`docker history`). To lokalne dane dostępowe do bazy na Twoim VPS — nie współdziel obrazu publicznie.
- **Nie wyłączaj** `wp.dietanaluzie.pl` — to źródło wszystkich obrazów przepisów. Osobny, późniejszy projekt: przeniesienie `uploads` na VPS/obiektowy storage i przepięcie proxy.
- Panel admina: zrotuj `ADMIN_PASSWORD` na mocne hasło przed startem (login ma limit prób: 5 → blokada 15 min).
