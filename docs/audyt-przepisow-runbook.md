# Runbook: jednorazowy audyt wszystkich opublikowanych przepisów

Cel: przepuścić każdy opublikowany przepis przez sesję Claude (Opus 5.5 w Claude Code) i wyłapać błędne dane: kalorie i makra, liczbę porcji, składniki bez ilości, czasy, sprzeczności między składnikami a krokami, literówki. Dane są kluczem istnienia platformy, więc protokół stawia kontrolę wyniku ponad szybkość.

Zasada nadrzędna: **sesja Claude nigdy nie pisze do bazy.** Produkuje pliki z propozycjami. Na prod trafiają one wyłącznie jako wiersze tabeli `recipe_proposals`, a każdą zmianę w przepisie wykonuje operator w `/admin/propozycje`, z diffem przed/po, kontrolą QC i przyciskiem „Cofnij".

## 0. Warunki wstępne

- Wdrożony i zweryfikowany nowy pipeline importu (silnik odżywczy `lib/server/nutrition-ai.ts`, tabela `recipe_proposals`, strona `/admin/propozycje`). Na prod wykonane `npm run db:push`.
- Lokalna kopia prod: pobierz ostatni `db-*.sql.gz` z `/admin/backupy`, odtwórz do lokalnego Postgresa (`docker compose -f docker-compose.dev.yml up -d`, potem `gunzip -c db-....sql.gz | psql "$DATABASE_URL"`).
- `.env` lokalnie z `OPENAI_API_KEY` (eksport liczy rozbicie odżywcze mocnym modelem; ~0,03 $ za przepis, ~4 $ za całość).
- Na prod: `npm run qc:recipes` daje 0 błędów (punkt odniesienia) i świeży backup z `/admin/backupy`.

## 1. Eksport (lokalnie, na kopii prod)

```bash
npm run audit:export            # audit/recipes/<id>.json + audit/INDEX.json + audit/README-batch.md
```

Każdy plik ma pełną treść przepisu oraz dwie niezależne opinie liczone w kodzie: `qc` (reguły z `lib/recipe-qc.ts`) i `nutritionAi` (rozbicie składników na gramy i per 100 g, z `deltaKcalPct` względem zapisanych kcal). Katalog `audit/` jest w `.gitignore`.

## 2. Przegląd w sesji Claude Code (Opus 5.5)

Otwórz sesję w repo i wklej poniższy protokół. Pracuj partiami z `audit/README-batch.md` (8 przepisów na partię), subagentami w tle.

### Protokół dla sesji (do wklejenia)

> Pracujesz w repo dietanaluzie. Audytujesz opublikowane przepisy z plików `audit/recipes/<id>.json` (patrz `audit/README-batch.md`). Dla każdej partii uruchom subagenta „audytor", który czyta JSON-y partii i dla KAŻDEGO przepisu pisze `audit/proposals/<id>.json` w schemacie:
>
> ```json
> { "recipeId": 123, "findings": [ { "path": "servings", "severity": "error|warning|polish", "before": <aktualna wartość>, "after": <proponowana>, "reason": "...", "confidence": "high|medium|low", "basis": "ingredients-math|source-text|knowledge" } ] }
> ```
>
> Dozwolone `path`: `servings`, `kcal`, `protein`, `fat`, `carbs`, `prepTimeMin`, `cookTimeMin`, `totalTimeMin`, `title`, `lead`, `difficulty`, `ingredientGroups[g].items[i]`, `steps[n].body`, `steps[n].title`, `steps[n].tip`. Nic innego (w szczególności nie `slug`, `uri`, `seoTitle`, `seoDescription`: SEO 1:1 jest nienaruszalne).
>
> Reguły audytora:
> 1. Nie dodawaj składników, których nie ma w przepisie; możesz doprecyzować ilość w istniejącej linii („jabłko" → „1 duże jabłko (ok. 200 g)").
> 2. Każda propozycja zmiany `kcal`/`protein`/`fat`/`carbs` musi mieć w `reason` rozbicie per składnik (gramy × per 100 g) i wynik na porcję; porównaj z `nutritionAi` w pliku. Gdy `deltaKcalPct` mieści się w ±15 %, nie proponuj zmiany.
> 3. Zmiana `servings` tylko z uzasadnieniem: łączna masa ÷ typowa porcja dla typu dania; w `reason` podaj liczby.
> 4. Tekst (`steps`, `lead`, `title`) tylko przy błędach: literówki, sprzeczność składnik ↔ krok (krok używa czegoś, czego nie ma w składnikach), długi myślnik lub półpauza (zamień na przecinek/kropkę). Nie przepisuj stylu, nie skracaj, nie „ulepszaj".
> 5. `confidence: high` tylko gdy wartość wynika z arytmetyki lub tekstu przepisu; `medium` gdy z typowych wartości; `low` gdy to przypuszczenie.
> 6. Puste `findings: []` jest poprawnym wynikiem dla dobrego przepisu.
>
> Po audytorze uruchom dla tej samej partii subagenta „weryfikator" (adwersarialnego): dostaje przepis i propozycje, dla każdej dopisuje `"verdict": "CONFIRMED"` albo `"REJECTED"` z `"verdictReason"`. Odrzuca, gdy: arytmetyka się nie zgadza, propozycja zmienia coś, co jest poprawne, propozycja dodaje składnik, `after` nie pasuje do typu pola, lub `reason` nie uzasadnia zmiany. Weryfikator nadpisuje plik propozycji.
>
> Na końcu napisz `audit/REPORT.md`: liczba propozycji per `severity` i `confidence`, lista przepisów z `error`, rozkład `deltaKcalPct` z INDEX.json, przepisy, których nie udało się ocenić.

Wskazówki: partie po 8, audytor i weryfikator jako osobni subagenci (świeży kontekst = niezależny osąd); całość to ok. 30 subagentów i kilka godzin pracy w tle; koszt w ramach subskrypcji, nie API.

## 3. Załadunek propozycji na prod

Skopiuj `audit/proposals/` na serwer (albo uruchom import lokalnie z `DATABASE_URL` wskazującym prod przez tunel SSH), potem:

```bash
npm run audit:import -- --source claude-audit-2026-10 --dry   # podgląd: co wejdzie, co odpadnie i dlaczego
npm run audit:import -- --source claude-audit-2026-10
```

Import pomija propozycje bez `CONFIRMED`, o niedozwolonej ścieżce, bez zmiany i już załadowane. `before` bierze z aktualnej bazy (nie z pliku), żeby „Cofnij" przywracało prawdziwy stan.

## 4. Zastosowanie w `/admin/propozycje`

Kolejność, która minimalizuje ryzyko na stronie:

1. Backup z `/admin/backupy` i `npm run qc:recipes` = 0 błędów.
2. Filtr: pewność `high`. Najpierw 10 przepisów z największym ruchem (GA4: top strony to ~50 % ruchu). Po zastosowaniu: otwórz stronę publiczną, sprawdź tabelę makr i Rich Results Test dla 2–3 URL-i.
3. Reszta `high` („Zastosuj wszystkie high" per przepis).
4. `medium` pojedynczo, z czytaniem `reason`. `low` tylko do wglądu; domyślnie odrzucaj.
5. Po każdej partii `npm run qc:recipes`. Propozycja, która wprowadziłaby nowy błąd QC, i tak zostaje odrzucona automatycznie (status `failed` z powodem).
6. Tabela `recipe_proposals` zostaje jako dziennik audytu (co, kiedy, dlaczego, czy cofnięte).

## 5. Co robić, gdy coś poszło nie tak

- Pojedyncza zmiana: „Cofnij" przy propozycji (przywraca `before`).
- Wiele zmian: przywróć backup z `/admin/backupy` (`DEPLOY.md`, sekcja backupów), potem `npm run search:reindex`.
