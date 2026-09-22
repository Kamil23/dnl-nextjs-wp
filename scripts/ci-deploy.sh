#!/usr/bin/env bash
# Deploy uruchamiany NA VPS (przez GitHub Actions po ssh, albo ręcznie:
# bash /opt/dnl/scripts/ci-deploy.sh). Realizuje ścieżki A/B/C z DEPLOY.md:
# pull → świeży tools + db:push → build web worker → podmiana kontenerów
# (+ reindeks wyszukiwarki, gdy zmienił się kod wyszukiwania).
set -euo pipefail

# Całość w main(): git pull podmienia TEN plik w trakcie działania, a bash
# doczytuje skrypt z dysku na bieżąco. Funkcja sparsowana przed pullem
# wykonuje się w całości ze starej wersji - bez ryzyka wykonania "sklejki".
main() {
  cd /opt/dnl

  local old new
  old=$(git rev-parse HEAD)
  git pull --ff-only origin main
  new=$(git rev-parse HEAD)
  echo "== Deploy ${old:0:7} -> ${new:0:7}"

  # Zawsze świeży obraz tools + db:push, w kolejności z DEPLOY.md (schemat
  # PRZED buildem web, bo next build prerenderuje strony czytające bazę).
  # db:push jest idempotentne ("No changes detected" = no-op). Przy
  # DESTRUKCYJNEJ zmianie drizzle-kit pyta o potwierdzenie, a w CI nie ma
  # TTY, więc deploy PADNIE - wtedy schemat wdrażasz ręcznie (DROP = STOP).
  docker compose build tools
  docker compose run --rm -T tools npm run db:push

  # Build web czyta bazę przez sieć hosta - db musi być up (jest, skoro
  # db:push przeszło).
  docker compose build web worker
  docker compose up -d web worker

  # Reindeks tylko gdy zmienił się kod wyszukiwarki (ścieżka C z DEPLOY.md).
  if ! git diff --quiet "$old" "$new" -- lib/search.ts lib/search-sync.ts scripts/reindex-search.ts; then
    echo "== Zmiana w wyszukiwarce - reindeks Meilisearch"
    docker compose run --rm -T tools npm run search:reindex
  fi

  # Smoke-test przez Caddy z pominięciem hairpin NAT (--resolve na loopback).
  sleep 5
  curl -fsS -o /dev/null --resolve "dietanaluzie.pl:443:127.0.0.1" \
    "https://dietanaluzie.pl/" && echo "== Smoke OK (strona główna 200)"
  docker compose ps --format '{{.Name}} {{.Status}}'
}

main "$@"
