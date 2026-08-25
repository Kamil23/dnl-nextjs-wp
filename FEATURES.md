# Backlog ficzerów - dietanaluzie.pl

Zasada przewodnia: **narzędzie → stan użytkownika → dane → produkt płatny (Planer)**.
Każdy ficzer ma trzymać czyjś stan albo uczyć nas czegoś o użytkownikach.
Przy naszej skali (~115 przepisów) odpowiedzi AI **prekomputujemy do bazy**:
jednorazowy koszt kilku dolarów, zero kosztów bieżących, natychmiastowy UX,
brak rate-limitów. AI na żywo tylko tam, gdzie wejście użytkownika jest nieprzewidywalne.

## 0. FUNDAMENT: dane (buduj PIERWSZE - dane rosną tylko w przód)

- [ ] **Log wyszukiwań** (`search_log`: fraza, liczba wyników, źródło hero/szukaj, ts, bez ID usera).
      Widok w adminie: top frazy + **szukania bez wyników** = luki w treści = gotowy brief na rolki Roksany.
- [ ] **Eventy GA4** (gtag po zgodzie): `cook_mode_start`, `add_to_list`, `scale_servings`,
      `rating_given`, `newsletter_signup{source}`, `substitution_click`, `pdf_download`.
      Odpowiadają na pytanie: które narzędzia realnie żyją.
- [ ] **Log celów z kalkulatora** (kubełek kcal, anonimowo) - rozkład celów = projektowanie Planera.
- [ ] **Zakupy jako sygnał intencji**: które przepisy trafiają do listy zakupów (mocniejsze niż pageview).

## 1. Porcja AI-narzędzia (tanio dzięki prekomputacji)

| Ficzer | Hook | Koszt |
|---|---|---|
| **„Czym zastąpić?"** dymek przy każdym składniku, głosem Roksany, z wpływem na kcal | #1 pytanie z komentarzy; SEO long-tail | 1 wieczór + ~$ (prekomputacja par przepis×składnik) |
| **„Twój dzień z Roksaną"** na kalkulatorze: przykładowy dzień pod cel kcal → waitlista Planera | konwersja najcenniejszego wlotu | 1 wieczór (cache kubełkami co 100 kcal) |
| **„Z lodówki"**: wpisz/zdjęcie składników → jej przepisy z tego | format rolki: „pokażcie lodówki" | 2 wieczory (tekst), foto v2 |
| **Głosowy cook mode** („dalej", „ile czasu?") - Web Speech, zero API | rolka: gotuję nie dotykając telefonu | 1-2 wieczory |
| **„Kuchenne pogotowie Roksany"**: przypalone/rozwarstwione → ratunek | zabawne, brandowe | 1 wieczór (top 50 prekomputowane) |
| **Warianty przepisu**: bez laktozy/glutenu/wege/−20% kcal (prekomputowane, oznaczone) | 1 przepis = 4 strony wartości | 2 wieczory + akcept Roksany |

## 2. Porcja MAKSYMALNIE UŻYTECZNA (codzienna wartość, buduje stan)

| Ficzer | Dlaczego | Notatki |
|---|---|---|
| **Ulubione + „Moje przepisy"** | rdzeń stanu użytkownika; wymaga lekkich kont (magic link) | odblokowuje wszystko niżej |
| **Prywatne notatki przy przepisie** („dałam pół cukru, 25 min zamiast 30") | powracający kucharze wracają DO SWOICH poprawek | localStorage → konto |
| **Lista zakupów 2.0: scalanie ilości z wielu przepisów + działy sklepowe** | „2 przepisy = razem 8 jajek", sortowanie nabiał/warzywa/sypkie | mamy parser ilości (lib/quantity)! |
| **Globalne „gotuję dla N osób"** | ustawiasz raz, każdy przepis otwiera się przeskalowany | stan, trywialne |
| **Konwerter szklanka→gramy per składnik** | mąka ≠ cukier ≠ płatki; ból polskiej kuchni | tabela gęstości prekomputowana AI |
| **„Co podać do tego?"** - dobrane pary (obiad→surówka, ciasto→krem) | użyteczne + wewnętrzne linkowanie (SEO) | prekomputacja par |
| **Zapisz przepis offline (PWA) + „Pobierz PDF przepisu"** | działka/bez zasięgu; drukujące mamy | print CSS już jest |

## 3. Porcja ANGAŻUJĄCA (nawyk, społeczność, powroty)

| Ficzer | Mechanika |
|---|---|
| **„Pokaż swoje wykonanie"** | zdjęcie wykonania przy przepisie, moderacja vision-AI (wykonalne we 2 osoby), galeria + wyróżnienie tygodnia w newsletterze; UGC = social proof + efekt sieciowy |
| **Wyzwania tygodniowe + seria** („Tydzień fit śniadań") | odhaczasz ugotowane → streak; odznaki; wspólna rolka na koniec |
| **Głosowanie „co Roksana nagra w niedzielę?"** | poll na stronie+w newsletterze; publiczność współtworzy (i to jest darmowy research contentu) |
| **Quiz „Twój profil smakowy"** | 6 pytań → starter-pack przepisów → zapis na newsletter; viral + dane o preferencjach |
| **Kalendarz adwentowy przepisów** (grudzień: 24 okienka) | coroczny event; wracasz codziennie przez miesiąc; wcześniejsze okienka tylko dla zapisanych |
| **Komentarze/pytania pod przepisem** (AI-szkic odpowiedzi, akcept Roksany) | odzyskujemy społeczność z czasów WP bez kosztu czasowego |

## Zrobione (dla kontekstu)
- Newsletter: capture (4 warianty) + magnesy PDF + kompozytor wydań + live podgląd
- Detoks ocen (≥15 realnych głosów), ekran finiszu cook-mode (ocena+mail)
- Baner cookies (GA po zgodzie), nowa polityka prywatności
- Waitlista Planera na kalkulatorze (walidacja flagowca płatnego)
