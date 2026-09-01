# Backlog ficzerów - dietanaluzie.pl

Rama nadrzędna: `docs/dietanaluzie_2026_2030_2035_strategia.md` (Meal Decision Platform).
Zasada przewodnia: **narzędzie → stan użytkownika → dane → produkt płatny (Planer)**.
North Star: tygodniowo aktywni, którzy podjęli decyzję żywieniową (zapis / lista zakupów / ugotowane),
nie pageviews. Przy naszej skali (~115 przepisów) odpowiedzi AI **prekomputujemy do bazy**:
jednorazowy koszt kilku dolarów, zero kosztów bieżących, natychmiastowy UX, brak rate-limitów.
AI na żywo tylko tam, gdzie wejście użytkownika jest nieprzewidywalne.

## 0. FUNDAMENT: dane (buduj PIERWSZE - dane rosną tylko w przód)

- [x] **Log wyszukiwań** (`search_log`) + widok `/admin/wyszukiwania`: top frazy i szukania bez
      wyników = luki w treści = gotowy brief na rolki Roksany.
- [x] **Eventy GA4** (gtag po zgodzie): `cook_mode_start`, `cooked`, `add_to_list`, `scale_servings`,
      `rating_given`, `newsletter_signup{source}`, `recipe_saved`, `substitution_click`,
      `ingredient_search`. (`pdf_download` odpuszczone: magnesy schodzą mailem, poza gtag.)
- [ ] **Log celów z kalkulatora** (kubełek kcal, anonimowo) - rozkład celów = projektowanie Planera.
- [ ] **Zakupy jako sygnał intencji**: które przepisy trafiają do listy zakupów (serwerowo, nie tylko GA).

## 1. Zrobione narzędzia i akwizycja (sprint 2026-08/09)

- [x] Kalkulatory (kalorie/BMR, deficyt, makro, BMI, ładunek glikemiczny) + hub `/kalkulatory`
      - wg strategii to WEJŚCIA do flow, nie endpointy: wynik ma zasilać profil (TODO niżej).
- [x] Wyszukiwarka instant (Meilisearch-only) z facetami + szukanie po składnikach (`/szukaj`).
- [x] `/co-na-obiad` losownik (do 3 propozycji, chipy czas/białko).
- [x] `/z-lodowki` MVP: "mam kurczaka, ryż, brokuła" → ranking przepisów po trafieniach.
- [x] Kolekcje (wysokie białko, GLP-1), konwerter miar, strona autorki, QC danych + auto-poprawki.
- [x] **Konto lekkie (magic link) + "Zapisz przepis" + `/moje-przepisy`** - odblokowuje stan użytkownika.
- [x] **Zamienniki składników**: AI generuje szkice (skrypt), Roksana akceptuje w `/admin/zamienniki`,
      na przepisie karta "Czym zastąpić?" (tylko approved; moat = zweryfikowane).

## 2. Następne wg strategii (P0/P1)

| Ficzer | Dlaczego teraz | Notatki |
|---|---|---|
| **Kalkulator → profil**: zapis celu kcal/makro na koncie | domyka "narzędzie jako wejście do flow" | wynik kalkulatora + 1 klik "zapisz mój cel" |
| **Prywatne notatki przy przepisie** | powracający wracają DO SWOICH poprawek | localStorage → konto |
| **"Dodaj do tygodnia"** na przepisie i w `/co-na-obiad` | pierwszy krok do planera; A/B vs "zapisz" | MealPlan w schemacie |
| **Lista zakupów: działy sklepowe** | ostatni brak w liście 2.0 | mamy parser ilości |
| **Warianty przepisu** (bez laktozy/glutenu/-20% kcal, prekomputowane) | 1 przepis = 4 strony wartości | akcept Roksany |
| **Tagi dietetyczne przepisów** | odblokują filtry diet w /szukaj i /co-na-obiad (auto-ukryte) | dołożyć do importu TikTok |

## 3. Porcja ANGAŻUJĄCA (nawyk, społeczność, powroty)

| Ficzer | Mechanika |
|---|---|
| **"Pokaż swoje wykonanie"** | zdjęcie wykonania, moderacja vision-AI, galeria + wyróżnienie w newsletterze; UGC = social proof |
| **Wyzwania tygodniowe + seria** ("Tydzień fit śniadań") | odhaczasz ugotowane → streak; odznaki; wspólna rolka |
| **Głosowanie "co Roksana nagra w niedzielę?"** | poll na stronie i w newsletterze; darmowy research contentu |
| **Quiz "Twój profil smakowy"** | 6 pytań → starter-pack → zapis na newsletter; viral + dane o preferencjach |
| **Kalendarz adwentowy przepisów** (grudzień) | coroczny event; wcześniejsze okienka dla zapisanych |
| **Głosowy cook mode** ("dalej", "ile czasu?") - Web Speech, zero API | rolka: gotuję nie dotykając telefonu |
| **"Z lodówki" foto** (zdjęcie zamiast wpisywania) | v2 obecnego MVP |

## Czego NIE robić teraz (strategia, sekcja 13)

Aplikacja mobilna bez potwierdzonej retencji webowej; chatbot dietetyczny; system agentowy/MCP;
masowe artykuły generowane AI; pełna baza produktów 1:1 z Fitatu/KalkulatorKalorii.

## Zrobione wcześniej (kontekst)

- Newsletter: capture (7 wariantów) + magnesy PDF + kompozytor wydań + live podgląd
- Detoks ocen (≥15 realnych głosów), ekran finiszu cook-mode (ocena + mail)
- Baner cookies (GA po zgodzie), polityka prywatności
- Waitlista Planera na kalkulatorze (walidacja flagowca płatnego)
