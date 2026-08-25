# Analiza rynku i strategia ruchu — dietanaluzie.pl (2026) — RAPORT PEŁNY

> Kompletny wynik deep-research (2026-08-24/25): pełna lista twierdzeń z cytatami, źródła,
> twierdzenia odrzucone i niezweryfikowane, oraz aneks ze wszystkimi surowymi twierdzeniami z ekstraktorów.
> Synteza / ostateczne wnioski: `docs/analiza-rynku-2026.md`. Ten plik to trwała kopia surowych danych.

## Pytanie badawcze

Analiza rynku i strategii pozyskiwania ruchu dla polskiego serwisu z przepisami dietetycznymi dietanaluzie.pl (Next.js, ~5k UU/mies. z organica, 50% ruchu z 3 stron, pipeline TikTok→przepis, newsletter na starcie, planowana monetyzacja: e-book → planer posiłków). Zbadaj: (1) polski rynek stron kulinarno-dietetycznych — konkurenci (aniagotuje.pl, kwestiasmaku.com, fitatu, poradnikzdrowie, kalkulatorkalorii itp.), ich źródła ruchu i co działa; (2) kanały wzrostu: SEO (luki keywordowe w niszy "dieta/fit przepisy", Google Discover, web stories), Pinterest, TikTok/Instagram/YouTube Shorts, newsletter; (4) jakie funkcje/narzędzia przyciągają ruch i linki: kalkulatory (kalorii, BMI, deficytu, makro), generatory jadłospisów, planery posiłków, listy zakupów, wyszukiwarka po składnikach; (4) trendy 2025-2026: wpływ AI Overviews na ruch recipe-blogów i jak się bronić, popyt na diety (redukcja, insulinooporność, wysokobiałkowa, GLP-1); (5) konkretne rekomendacje feature'ów posortowane wg potencjału ruchu vs koszt wdrożenia. Raport po polsku.

## Metodologia i statystyki

- Kąty analizy: 5 | źródła: 21 | twierdzenia wyekstrahowane: 94
- Zweryfikowane: 25 | potwierdzone: 18 | odrzucone: 1 | niezweryfikowane: 6
- Weryfikacja adwersaryjna: 3 niezależne głosy na twierdzenie (2/3 do odrzucenia).

## 1. Twierdzenia POTWIERDZONE

### 1. Udział wyszukiwania (search) w ruchu Pinch of Yum spadł z 61,17% (marzec 2024) do 57,23% (marzec 2026), a spadek przypisano m.in. AI Overviews i rosnącej konkurencji w wynikach wyszukiwania.

> „Search | 61.17% | 57.23% | -3.94% ... search dipped slightly, attributed to "increased competition, more content overall, and changes in search results like AI overviews."”

- Źródło: https://www.foodbloggerpro.com/blog/pinch-of-yums-traffic-trends-2024-vs-2026/
- Głosy: 3-0

### 2. Udział e-maila w ruchu Pinch of Yum niemal się podwoił (z 3,9% do 6,76% między marcem 2024 a marcem 2026), a newsletter jest wskazywany jako jeden z najcenniejszych aktywów bloga kulinarnego.

> „Email nearly doubled ... Start email list immediately ("one of the most valuable assets over time")”

- Źródło: https://www.foodbloggerpro.com/blog/pinch-of-yums-traffic-trends-2024-vs-2026/
- Głosy: 3-0

### 3. KalkulatorKalorii.net opiera swoją stronę główną na zestawie sześciu darmowych kalkulatorów (kalorii, spalania kalorii, przemiany materii, BMI, odchudzania, idealnej wagi), co potwierdza model 'kalkulatory jako magnes ruchu' w polskiej niszy dietetycznej.

> „Kalkulator Kalorii; Kalkulator spalania kalorii; Kalkulator przemiany materii; Kalkulator BMI; Kalkulator odchudzania; Kalkulator idealnej wagi”

- Źródło: https://kalkulatorkalorii.net/
- Głosy: 3-0

### 4. Darmowe kalkulatory służą jako lejek do płatnych usług: subskrypcyjnego Dziennika Kalorii i gotowych planów diet z osobnym cennikiem, co pokazuje sprawdzoną ścieżkę monetyzacji narzędzi (freemium → plan posiłków).

> „"Dziennik Kalorii" (/landing/dziennik-kalorii); "Dieta Extra Smaczna" (/landing/dieta-extra-smaczna); "Cennik naszych usług" (/cennik/wybierz)”

- Źródło: https://kalkulatorkalorii.net/
- Głosy: 3-0

### 5. Państwowy portal diety.nfz.gov.pl udostępnia darmowy kalkulator, który w jednym narzędziu liczy BMI i zapotrzebowanie energetyczne (na podstawie płci, wieku, wzrostu, wagi i poziomu aktywności PAL) — czyli państwo konkuruje bezpośrednio z komercyjnymi kalkulatorami kalorii/BMI, na które dietanaluzie.pl mogłoby stawiać jako magnesy ruchu.

> „Wpisz dane do kalkulatora i wylicz swoje BMI. Wynik określi, jakie zapotrzebowanie energetyczne ma Twój organizm.”

- Źródło: https://diety.nfz.gov.pl/twoj-wskaznik-bmi
- Głosy: 3-0

### 6. Portal NFZ oferuje bezpłatne, gotowe jadłospisy o długości do 28 dni dla użytkownika i całej rodziny, co zaniża skłonność Polaków do płacenia za podstawowe plany posiłków i podnosi poprzeczkę dla płatnego planera dietanaluzie.pl (przewaga musi leżeć w personalizacji/UX, nie w samym dostępie do jadłospisu).

> „Bezpłatne diety nawet na 28 dni”

- Źródło: https://diety.nfz.gov.pl/twoj-wskaznik-bmi
- Głosy: 3-0

### 7. Raptive oszacowało, że pierwotna wersja Google SGE (poprzednik AI Overviews) obcięłaby ruch z wyszukiwarki do stron twórców o około 66%.

> „SGE in its original form was likely to have a 66% impact on search traffic.”

- Źródło: https://raptive.com/blog/what-ai-overviews-means-for-raptive-creators-and-publishers/
- Głosy: 3-0

### 8. Według późniejszych danych Raptive (stan na moment startu AI Overviews, maj 2024) przewidywany spadek ruchu z wyszukiwarki dla twórców wynosi około 25%, przy czym część serwisów ucierpi bardziej, a część mniej.

> „our latest data indicated a 25% drop in search traffic, with the possibility that some creators would be hit worse, and others might fare better.”

- Źródło: https://raptive.com/blog/what-ai-overviews-means-for-raptive-creators-and-publishers/
- Głosy: 3-0

### 9. Aniagotuje.pl było liderem polskich serwisów kulinarnych z 5,82 mln realnych użytkowników (19,61% zasięgu) w lutym 2023 wg Mediapanel.

> „Aniagotuje.pl - 5.82 million users (19.61% reach), average session 7 minutes 15 seconds”

- Źródło: https://wirtualnemedia.pl/artykul/przepisy-na-wielkanoc-porady-kulinarne-najlepsze-serwisy-blogi
- Głosy: 3-0

### 10. Pysznosci.pl zyskało w ciągu miesiąca 1,09 mln użytkowników (+32,5%), osiągając 4,45 mln użytkowników, co pokazuje dużą zmienność ruchu w segmencie serwisów kulinarnych.

> „Pyszności.pl: "Gained 1.09 million users (up 32.5%)" ... 4.45 million users (15.01% reach)”

- Źródło: https://wirtualnemedia.pl/artykul/przepisy-na-wielkanoc-porady-kulinarne-najlepsze-serwisy-blogi
- Głosy: 3-0

### 11. Część twórców przepisów kulinarnych raportuje spadki ruchu rzędu kilkudziesięciu procent w ciągu ostatnich dwóch lat (2024-2025), wiązane z wdrożeniem Google AI Mode / odpowiedzi AI w wyszukiwarce.

> „Część twórców mówi o utracie nawet kilkudziesięciu procent ruchu w ciągu ostatnich dwóch lat.”

- Źródło: https://itreseller.pl/google-ai-mode-zagraza-tworcom-przepisow-kulinarnych-blogi-traca-ruch-i-przychody/
- Głosy: 3-0

### 12. Mechanizm spadków: Google AI Mode podaje pełną odpowiedź (przepis) bezpośrednio w wyszukiwarce, przez co użytkownik nie klika do strony źródłowej (zero-click search).

> „Gdy użytkownik otrzymuje pełną odpowiedź bezpośrednio w wyszukiwarce, przestaje odwiedzać stronę źródłową.”

- Źródło: https://itreseller.pl/google-ai-mode-zagraza-tworcom-przepisow-kulinarnych-blogi-traca-ruch-i-przychody/
- Głosy: 3-0

### 13. Rekomendowane strategie obronne dla twórców przepisów to budowanie lojalnej społeczności, treści wideo oraz content oparty na praktycznej wiedzy trudnej do odtworzenia przez algorytmy (plus modele subskrypcyjne i tradycyjne książki kucharskie).

> „Inni na razie utrzymują stabilność, koncentrując się na budowaniu lojalnej społeczności, wideo oraz treściach opartych na wiedzy praktycznej.”

- Źródło: https://itreseller.pl/google-ai-mode-zagraza-tworcom-przepisow-kulinarnych-blogi-traca-ruch-i-przychody/
- Głosy: 3-0

### 14. Według badania ankietowego Inspired Taste (2 008 respondentów w USA) domowi kucharze są o 300% bardziej skłonni sięgać po blogi kulinarne w poszukiwaniu inspiracji przepisowych niż po AI, a tylko 12% deklaruje celowe korzystanie z AI do przepisów.

> „Home cooks are 300% more likely to turn to food blogs for recipe inspiration than to AI ... Only 12% of the 2,008 survey respondents said they would purposefully use AI”

- Źródło: https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/
- Głosy: 3-0

### 15. Badanie Ahrefs na próbie 300 000 słów kluczowych wykazało, że AI Overviews zmniejszają organiczne kliknięcia o 34,5% — co bezpośrednio dotyczy ruchu recipe-blogów z SEO.

> „Research from Ahrefs examining 300,000 keywords found that AI Overviews reduce organic clicks by 34.5%”

- Źródło: https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/
- Głosy: 2-0

### 16. Obroną przed erozją ruchu przez AI ma być wiarygodność redakcyjna i własna publiczność (first-party audience) budowana testowaną treścią na własnych platformach — argument za newsletterem i marką, nie tylko SEO.

> „editorial credibility and first-party audiences - built through consistent, tested content on owned platforms - retain measurable value”

- Źródło: https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/
- Głosy: 3-0

### 17. Publikacja AI Overviews przy zapytaniach kulinarnych powoduje mierzalny spadek klikalności dla blogów z przepisami — Inspired Taste odnotował ok. 30% spadek CTR, gdy AI Overviews pojawiły się przy zapytaniach o koktajle.

> „Adam Gallagher (Inspired Taste): 30% drop in click-through rates when AI Overviews appeared for cocktail queries”

- Źródło: https://fortune.com/2025/11/26/ai-slop-recipes-thanksgiving-food-blog-collapse-traffic
- Głosy: 3-0

### 18. Straty ruchu blogów kulinarnych w latach 2024-2025 sięgają skrajnie 80% w dwa lata — Clean Eating Kitchen (blog o zdrowym odżywianiu, a więc nisza zbliżona do dietanaluzie.pl) stracił 80% ruchu i przychodów, redukując zespół z ok. 10 osób do zera.

> „Carrie Forrest (Clean Eating Kitchen): 80% traffic and revenue loss over two years; went from ~10 employees to zero staff”

- Źródło: https://fortune.com/2025/11/26/ai-slop-recipes-thanksgiving-food-blog-collapse-traffic
- Głosy: 3-0

## 2. Twierdzenia ODRZUCONE

- ~~W późniejszych iteracjach testów Google rzadziej generował odpowiedzi AI dla zapytań kulinarnych (food), co sugeruje, że blogi z przepisami mogą być relatywnie mniej dotknięte niż inne kategorie.~~
  - Źródło: https://raptive.com/blog/what-ai-overviews-means-for-raptive-creators-and-publishers/

## 3. Twierdzenia NIEZWERYFIKOWANE

- Pinterest przestaje być stabilnym kanałem ratunkowym dla blogów z przepisami — The Food Blog odnotował spadek udziału Pinteresta w referralach z ok. 25% do 11% w rok, a miesięczne wyświetlenia spadły z 1,3 mln do 419 tys.; MyDinner raportuje spadek Pinteresta o 50% przy równoczesnym spadku Google o 30%.
  - Źródło: https://fortune.com/2025/11/26/ai-slop-recipes-thanksgiving-food-blog-collapse-traffic
- Food creators reported spadki ruchu z Google rzędu 30-80% w sezonie świątecznym 2025 (Thanksgiving), określając go jako najgorszy sezon w historii swoich blogów kulinarnych.
  - Źródło: https://searchengineland.com/google-ai-slop-thanksgiving-food-bloggers-465200
- Google AI Overviews wyświetlają zmiksowane kroki gotowania z wielu blogów ponad linkami do źródeł, z których czerpią treść, co odbiera kliknięcia blogerom kulinarnym.
  - Źródło: https://searchengineland.com/google-ai-slop-thanksgiving-food-bloggers-465200
- Carrie Forrest (Clean Eating Kitchen, blog o zdrowym odżywianiu) straciła 80% ruchu i przychodów w ciągu dwóch lat, co zmusiło ją do zwolnienia zespołu.
  - Źródło: https://searchengineland.com/google-ai-slop-thanksgiving-food-bloggers-465200
- Inspired Taste zmierzyło ok. 40% spadek kliknięć z Google dla stron z przepisami na koktajle po pojawieniu się AI Overviews na ich zapytaniach (dane cytowane przez Bloomberg).
  - Źródło: https://www.foodbloggerpro.com/podcast/fair-traffic-ai-search/
- Przy AI Overviews liczba wyświetleń (impressions) w Google Search Console pozostała stabilna lub rosła, podczas gdy kliknięcia spadły natychmiast — co oznacza, że spadku CTR nie widać po samych impressions.
  - Źródło: https://www.foodbloggerpro.com/podcast/fair-traffic-ai-search/

## 4. Źródła (21)

- https://www.wirtualnemedia.pl/m/artykul/kwestia-smaku-na-czele-serwisow-kulinarnych-ania-gotuje-moje-wypieki-i-przepisy-pl-z-duzymi-wzrostami-top10
- https://media-panel.pl/pl/aktualnosci/zestawienia-tematyczne-i-funkcjonalne-lipiec-2025/
- https://www.semrush.com/website/kwestiasmaku.com/overview/
- https://wirtualnemedia.pl/artykul/przepisy-na-wielkanoc-porady-kulinarne-najlepsze-serwisy-blogi
- https://itreseller.pl/google-ai-mode-zagraza-tworcom-przepisow-kulinarnych-blogi-traca-ruch-i-przychody/
- https://ppc.land/food-blogs-beat-ai-for-recipes-what-a-2026-study-found/
- https://www.foodbloggerpro.com/blog/pinch-of-yums-traffic-trends-2024-vs-2026/
- https://memberkitchens.com/updates/food-blog-seo-guide
- https://bootstrapped.ventures/seo-for-food-blogs/
- https://workinbees.com/food-blog-2026-playbook/
- https://recipyapp.com/blog/google-ai-mode-recipe-update-2026
- https://linkiseo.co.pl/2025/12/03/tre%C5%9B%C4%87-kt%C3%B3ra-przyci%C4%85ga-linki-zwrotne/
- https://kalkulatorkalorii.net/
- https://bcg.com.pl/link-baiting-jak-tworzyc-tresci-do-ktorych-inni-chca-linkowac-sami/
- https://diety.nfz.gov.pl/twoj-wskaznik-bmi
- https://fortune.com/2025/11/26/ai-slop-recipes-thanksgiving-food-blog-collapse-traffic
- https://raptive.com/blog/what-ai-overviews-means-for-raptive-creators-and-publishers/
- https://searchengineland.com/google-ai-slop-thanksgiving-food-bloggers-465200
- https://www.foodbloggerpro.com/podcast/fair-traffic-ai-search/
- https://dietetycy.org.pl/trendy-w-dietetyce-2026/
- https://zdrowie.interia.pl/diety/news-oto-co-przyniesie-2026-rok-w-zywieniu-wiecej-blonnika-mniej,nId,22502337

## 5. Aneks — wszystkie wyekstrahowane twierdzenia (surowe, przed weryfikacją)

Łącznie 187 unikalnych twierdzeń zebranych przez ekstraktory. Surowe — materiał, nie fakty potwierdzone.

### Kluczowe (central) (66)

- **Blogerzy kulinarni raportują spadki ruchu z Google rzędu 30-80%, przypisywane AI Overviews i zalewowi treści generowanych przez AI ("AI slop").**
  - cytat: „between 30% and 80% drops in Google traffic”
- **Carrie Forrest (Clean Eating Kitchen, blog z przepisami "clean eating", niszowo zbliżony do dietanaluzie.pl) straciła 80% ruchu i przychodów w ciągu dwóch lat.**
  - cytat: „lost 80% of her traffic and revenue in two years”
- **AI Overviews Google miesza składniki z przepisów jednego autora z instrukcjami konkurencji nawet przy wyszukiwaniach brandowych (przypadek Adama Gallaghera z Inspired Taste, którego CTR dla treści koktajlowych spadł o 30%).**
  - cytat: „Google mixes his ingredients with competitors' instructions, even for brand-name searches”
- **Wielu niezależnych blogerów kulinarnych (22 rozmówców Fortune) raportuje, że treści AI zniekształcają praktycznie każdy kanał odkrywania przepisów online.**
  - cytat: „In interviews, 22 independent food creators said that AI-generated 'recipe slop' is distorting nearly every way people find cooking advice online”
- **Blog Clean Eating Kitchen (Carrie Forrest) stracił 80% ruchu i przychodów w ciągu dwóch lat, co wymusiło zwolnienie całego ok. 10-osobowego zespołu.**
  - cytat: „80% of her traffic — and her revenue — has disappeared in two years ... she's gone from employing about ten people to letting everyone go”
- **Po pojawieniu się AI Overviews dla zapytań o koktajle CTR do serwisu Inspired Taste spadł o 30%, a Google prezentuje 'zmiksowane' przepisy AI ponad linkiem do źródła.**
  - cytat: „click-through rates to his site were down 30% ... Google's AI takes Inspired Taste's ingredients and combines them with instructions from other popular food blogs ... presents the mash-up as the answer above his own link”
- **Po wywołaniu AI Overviews w Google niektórzy wydawcy notują spadek CTR nawet o 89% dla określonych zapytań (dane przywoływane za Search Engine Journal).**
  - cytat: „Some publishers report click-through rates declining by as much as 89% for certain queries when AI Overviews are triggered.”
- **Szacowany bazowy spadek ruchu z samych AI Overviews wynosi 25% lub więcej (przywoływane za Builtin.com).**
  - cytat: „Others estimate a baseline traffic drop of 25% or more just from AI Overviews alone.”
- **Raptive's internal analysis estimated that Google SGE (the precursor to AI Overviews) in its original form would reduce publishers' search traffic by about 66%.**
  - cytat: „Our internal data analysis showed that SGE in its original form was likely to have a 66% impact on search traffic.”
- **By the time of Google I/O 2024 (just before AI Overviews launched), Raptive's updated data pointed to a 25% drop in search traffic for publisher sites.**
  - cytat: „Prior to the conference, our latest data indicated a 25% drop in search traffic.”
- **In Raptive's testing, Google's AI answers appeared less often for food/recipe queries than for other content categories, implying recipe sites were comparatively less exposed at that time (May 2024).**
  - cytat: „It was less likely to generate a response around food.”
- **Inspired Taste zanotował ok. 40% spadek kliknięć na przepisy koktajlowe po pojawieniu się Google AI Overviews, mimo utrzymania pozycji #1 i stabilnych lub rosnących wyświetleń (impressions) — AI Overview pokazywał przepis bezpośrednio w SERP.**
  - cytat: „Impressions stay up, if not increase, but the clicks dropped immediately”
- **Ruch odsyłający z ChatGPT do bloga kulinarnego Inspired Taste jest znikomy: 80 kliknięć w ciągu sześciu miesięcy.**
  - cytat: „ChatGPT drove 80 clicks over six months”
- **Według badania Pew Research (lipiec 2025) obecność AI Overview w Google drastycznie obniża klikalność wyników organicznych: tylko 8% użytkowników klika niebieskie linki pod AIO wobec 15% przy braku AIO, a jedynie 1% klika linki cytowane w samym AIO.**
  - cytat: „Just 8% of users click on the blue links under an AIO, compared with 15% who click a link when there's no AIO ... just 1% of users click the links it cites”
- **Małe, niezależne blogi contentowe (analogiczne do blogów z przepisami) notują katastrofalne spadki ruchu po wdrożeniu AI Overviews: blog podróżniczy The Planet D stracił połowę ruchu po starcie AIO, a następnie kolejne 90%; blog DIY Charleston Crafted stracił 70% ruchu między marcem a majem 2024.**
  - cytat: „Travel blog The Planet D: 'lost half its traffic' after Google launched AIOs; later 'traffic plummeted another 90%' ... Charleston Crafted: 'lost 70% of its traffic between March and May 2024'”
- **Dane Seer Interactive (wrzesień 2025) pokazują, że organiczny CTR spada z 1,6% bez AI Overview do 0,6% gdy AIO jest obecne, czyli o ok. 60%.**
  - cytat: „organic click-through rate at just 1.6% when no AIO appears and .6% when an AIO is present”
- **Według redakcji dietetycy.org.pl w 2026 r. diety roślinne (wegetarianizm, weganizm) wyhamowały wzrost popularności, a rośnie popularność diet niskowęglowodanowych/keto, które coraz częściej promowane są nie tylko jako narzędzie redukcji masy ciała, ale jako 'zdrowe w każdym aspekcie'.**
  - cytat: „Wegetarianizm, weganizm, dieta roślinna – wszystkie one trochę wyhamowały swój wzrost. [...] Obecnie jednak widzimy pewne przełamanie – o ile wspomniane wcześniej miały konkretny cel – osiągnięcie utraty masy ciała i szybkie odchudzanie, to teraz rośnie liczba głosów, że taka dieta jest zwyczajnie zdrowa w każdym możliwym aspekcie.”
- **Popyt na produkty wysokobiałkowe w 2026 r. jest napędzany m.in. przez osoby przyjmujące leki na otyłość klasy GLP-1, które potrzebują żywności zapobiegającej utracie masy mięśniowej — co potwierdza rosnącą niszę treści/przepisów wysokobiałkowych pod użytkowników GLP-1.**
  - cytat: „Innowacyjne formuły...są odpowiedzią na rosnące potrzeby, między innymi osób przyjmujących leki na otyłość (GLP-1), które wymagają produktów zapobiegających utracie masy mięśniowej.”
- **Trendem żywnościowym na 2026 r. jest "protein-plus": nie tylko wysoka zawartość białka, ale też wzbogacanie produktów o składniki wspierające zdrowie jelit — sugeruje to popyt wyszukiwań na przepisy wysokobiałkowe łączone z tematyką jelit/probiotyków.**
  - cytat: „Oznacza ona nie tylko wysoką zawartość białka, lecz także wzbogacenie produktów o składniki wspierające zdrowie jelit.”
- **Według ankiety Inspired Taste (2 008 amerykańskich domowych kucharzy, maj 2026) domowi kucharze są o 300% bardziej skłonni szukać inspiracji przepisowych na blogach kulinarnych niż w AI, a tylko 12% deliberatywnie użyłoby AI do odkrywania przepisów.**
  - cytat: „home cooks are 300% more likely to turn to food blogs for recipe inspiration than to AI”
- **W rankingu źródeł przepisów blogi/strony kulinarne prowadzą z 48%, przed YouTube (40%), przepisami rodzinnymi (31%), książkami kucharskimi (27%) i TikTokiem (22%).**
  - cytat: „Top Five Recipe Sources: 1. Online food blogs and websites: 48% 2. YouTube: 40% 3. Family recipes and traditions: 31% 4. Physical cookbooks: 27% 5. TikTok: 22%”
- **Badanie Ahrefs na 300 000 słów kluczowych wykazało, że AI Overviews zmniejszają organiczne kliknięcia o 34,5%.**
  - cytat: „Research from Ahrefs examining 300,000 keywords found that AI Overviews reduce organic clicks by 34.5%”
- **Mimo AI Overviews i rosnącej konkurencji, wyszukiwarka pozostaje głównym źródłem ruchu Pinch of Yum (jednego z największych recipe-blogów w USA), spadając tylko umiarkowanie z 61,17% udziału w marcu 2024 do 57,23% w marcu 2026.**
  - cytat: „Search: 61.17% [...] Search: 57.23% [...] The small dip likely reflects increased competition, more content overall, and changes in search results like AI overviews.”
- **Udział e-maila w ruchu Pinch of Yum niemal się podwoił (z 3,9% w marcu 2024 do 6,76% w marcu 2026), a autor uznaje to za jedną z najważniejszych zmian w raporcie — co wspiera strategię wczesnego budowania newslettera jako obrony przed erozją SEO.**
  - cytat: „Email: 3.9% [...] Email: 6.76% [...] This is one of the most important shifts in the report.”
- **Pages that answer a cooking question directly, early, and in plain language are the ones AI Overviews pull from — structuring recipe content this way is a defense tactic against AI-driven zero-click search.**
  - cytat: „When someone asks a question like 'how do I keep cookies from spreading,' the AI models pull from pages that answer the question directly, early, and in plain language”
- **Outputting full recipe structured data (schema.org Recipe with ingredients, times, ratings, nutrition) gives AI systems a machine-readable version of the recipe, increasing the chance of being cited/surfaced in AI Overviews.**
  - cytat: „When WP Recipe Maker outputs structured data…you're handing AI systems a clean, machine-readable version of your recipe instead of making them guess”
- **KalkulatorKalorii.net opiera swoją ofertę na zestawie sześciu kalkulatorów dietetycznych (kalorii, spalania kalorii, przemiany materii, BMI, odchudzania, idealnej wagi) uzupełnionych tabelami kalorii i ćwiczeń, co potwierdza model serwisu zbudowanego wokół narzędzi jako magnesów ruchu.**
  - cytat: „Kalkulator Kalorii - "Błyskawicznie sprawdź kalorie i wartości odżywcze ponad 18 000 produków" ... Kalkulator spalania kalorii ... Kalkulator przemiany materii ... Kalkulator BMI ... Kalkulator odchudzania ... Kalkulator idealnej wagi ... Tabela kalorii ... Tabela ćwiczeń”
- **Serwis monetyzuje ruch z darmowych kalkulatorów przez płatne plany diet, płatny dziennik kalorii, aplikację mobilną i program partnerski, a nie wyłącznie przez reklamy.**
  - cytat: „Premium diet plans and personalized diets; Dziennik Kalorii (paid calorie tracking service); Mobile app (Android/iOS); Promotional codes (e.g., "MC10A" for -10% discount); Program partnerski (affiliate program)”
- **KalkulatorKalorii.net łączy kalkulatory z sekcjami treściowymi SEO: przepisami (zupy, sałatki, śniadania itd.), artykułami (odchudzanie, żywienie w chorobach) i gotowymi dietami (wegetariańska, dla cukrzyków, bez laktozy), działając nieprzerwanie od 2010 roku.**
  - cytat: „Recipes: Categorized as zupy, sałatki, kanapki, przekąski, śniadania, dania główne ... Diet Plans: Multiple specialized diets including dieta wegetariańska, dieta dla cukrzyków, dieta bez laktozy ... Copyright statement: "©2010 - 2026 KalkulatorKalorii.net"”
- **Interaktywne kalkulatory (np. kalkulator wyceny zamiast zwykłego artykułu poradnikowego) są jednym z formatów treści, które skuteczniej przyciągają linki zwrotne, bo inne serwisy linkują do nich, by podnieść wartość własnych artykułów**
  - cytat: „Zamiast pisać artykuł „Ile kosztuje malowanie ścian", stwórz prosty kalkulator, w którym użytkownik wpisuje metraż i otrzymuje wycenę.”
- **Aniagotuje.pl było liderem polskich serwisów kulinarnych z 5,82 mln realnych użytkowników (19,61% zasięgu) w lutym 2023 wg Mediapanel.**
  - cytat: „Aniagotuje.pl - 5.82 million users (19.61% reach), average session 7 minutes 15 seconds”
- **Pysznosci.pl zyskało w ciągu miesiąca 1,09 mln użytkowników (+32,5%), osiągając 4,45 mln użytkowników, co pokazuje dużą zmienność ruchu w segmencie serwisów kulinarnych.**
  - cytat: „Pyszności.pl: "Gained 1.09 million users (up 32.5%)" ... 4.45 million users (15.01% reach)”
- **Udział wyszukiwania (search) w ruchu Pinch of Yum spadł z 61,17% (marzec 2024) do 57,23% (marzec 2026), a spadek przypisano m.in. AI Overviews i rosnącej konkurencji w wynikach wyszukiwania.**
  - cytat: „Search | 61.17% | 57.23% | -3.94% ... search dipped slightly, attributed to "increased competition, more content overall, and changes in search results like AI overviews."”
- **Udział e-maila w ruchu Pinch of Yum niemal się podwoił (z 3,9% do 6,76% między marcem 2024 a marcem 2026), a newsletter jest wskazywany jako jeden z najcenniejszych aktywów bloga kulinarnego.**
  - cytat: „Email nearly doubled ... Start email list immediately ("one of the most valuable assets over time")”
- **Według badania ankietowego Inspired Taste (2 008 respondentów w USA) domowi kucharze są o 300% bardziej skłonni sięgać po blogi kulinarne w poszukiwaniu inspiracji przepisowych niż po AI, a tylko 12% deklaruje celowe korzystanie z AI do przepisów.**
  - cytat: „Home cooks are 300% more likely to turn to food blogs for recipe inspiration than to AI ... Only 12% of the 2,008 survey respondents said they would purposefully use AI”
- **Badanie Ahrefs na próbie 300 000 słów kluczowych wykazało, że AI Overviews zmniejszają organiczne kliknięcia o 34,5% — co bezpośrednio dotyczy ruchu recipe-blogów z SEO.**
  - cytat: „Research from Ahrefs examining 300,000 keywords found that AI Overviews reduce organic clicks by 34.5%”
- **Obroną przed erozją ruchu przez AI ma być wiarygodność redakcyjna i własna publiczność (first-party audience) budowana testowaną treścią na własnych platformach — argument za newsletterem i marką, nie tylko SEO.**
  - cytat: „editorial credibility and first-party audiences - built through consistent, tested content on owned platforms - retain measurable value”
- **Część twórców przepisów kulinarnych raportuje spadki ruchu rzędu kilkudziesięciu procent w ciągu ostatnich dwóch lat (2024-2025), wiązane z wdrożeniem Google AI Mode / odpowiedzi AI w wyszukiwarce.**
  - cytat: „Część twórców mówi o utracie nawet kilkudziesięciu procent ruchu w ciągu ostatnich dwóch lat.”
- **Mechanizm spadków: Google AI Mode podaje pełną odpowiedź (przepis) bezpośrednio w wyszukiwarce, przez co użytkownik nie klika do strony źródłowej (zero-click search).**
  - cytat: „Gdy użytkownik otrzymuje pełną odpowiedź bezpośrednio w wyszukiwarce, przestaje odwiedzać stronę źródłową.”
- **Rekomendowane strategie obronne dla twórców przepisów to budowanie lojalnej społeczności, treści wideo oraz content oparty na praktycznej wiedzy trudnej do odtworzenia przez algorytmy (plus modele subskrypcyjne i tradycyjne książki kucharskie).**
  - cytat: „Inni na razie utrzymują stabilność, koncentrując się na budowaniu lojalnej społeczności, wideo oraz treściach opartych na wiedzy praktycznej.”
- **Wyprowadzanie danych strukturalnych (recipe schema) w czystej, maszynowo czytelnej formie zwiększa szansę na cytowanie treści przepisu przez systemy AI (np. AI Overviews) — to proponowana linia obrony recipe-blogów przed spadkiem ruchu z powodu odpowiedzi AI.**
  - cytat: „When WP Recipe Maker outputs structured data, you're handing AI systems clean machine-readable version”
- **W dniu 4 marca 2026 Google zastąpił w AI Mode syntetyzowane, zblendowane odpowiedzi na zapytania przepisowe wizualną karuzelą 4-8 miniatur dań linkujących do oryginalnych stron twórców, pokazującą cookTime, prepTime, autora i oceny z danych Schema.org.**
  - cytat: „on March 4, 2026, Google replaced synthesized blended recipe answers with a visual carousel displaying 4-8 dish thumbnails linked to original creator sites”
- **Według badania Ahrefs (na ok. 300 000 słów kluczowych) do lutego 2026 zapytania z AI Overviews notowały 58% spadek kliknięć do stron.**
  - cytat: „Ahrefs measured a 58 percent click reduction across AI-Overview queries as of February 2026”
- **Przepisy bez poprawnie uzupełnionego pola cookTime w znacznikach Schema.org są wykluczane z karuzeli przepisów w Google AI Mode.**
  - cytat: „Recipes without clean cookTime in their Schema.org markup get excluded”
- **W pierwszych czterech miesiącach 2026 r. 68% wyszukiwań Google w USA zakończyło się bez kliknięcia (dane SparkToro/Similarweb), wobec 60% w 2024 r., co jest głównym mechanizmem utraty ruchu przez recipe-blogi.**
  - cytat: „In the US, 68% of Google searches ended without a click in the first four months of 2026 (SparkToro/Similarweb) -- up from 60% in 2024.”
- **AI Overviews pojawiają się przy ponad 20% wyszukiwań i gdy występują, mogą obniżyć CTR o blisko 60%.**
  - cytat: „AI Overviews appear on 20%+ of searches and can cut CTR by nearly 60% when present.”
- **Kompletny recipe schema (JSON-LD z czasami, składnikami, ocenami, obrazem) jest warunkiem widoczności w karuzelach przepisów, rich results i cytowaniach AI; niekompletny schema to najszybszy sposób na utratę widoczności na rzecz konkurenta z czystszymi metadanymi.**
  - cytat: „Recipe carousels, rich results, and AI citation all depend on consistent structured data. Incomplete schema is one of the fastest ways to lose visibility to a competitor with cleaner metadata.”
- **Rekomendowana obrona przed spadkiem kliknięć z AI: traktować SEO jako top-of-funnel i konwertować ruch na kanały własne (e-mail, członkostwa); e-mail marketing wg badań Litmus zwraca średnio ok. 36 USD na 1 USD wydany.**
  - cytat: „Litmus research averages about $36 returned for every $1 spent on email marketing (your results will vary). ... Food bloggers adapting successfully are treating SEO as top-of-funnel awareness and building owned-audience channels (email, memberships) where algorithm changes don't break their business.”
- **Google AI Overviews wyświetlają całą treść przepisu w wynikach wyszukiwania, co redukuje kliknięcia do blogów kulinarnych do zera ("death of the click") i pozbawia je przychodów reklamowych.**
  - cytat: „When a user searches for your recipe, Google's AI now scrapes your site, reformulates your hard work, and presents the entire recipe”
- **Około 40% młodszych użytkowników szuka przepisów najpierw na TikToku lub Instagramie, zanim sięgnie po Google, co przesuwa punkt ciężkości discovery z SEO na short video.**
  - cytat: „A staggering 40% of younger users now go to TikTok or Instagram before Google when searching”
- **Państwowy portal diety.nfz.gov.pl udostępnia darmowy kalkulator, który w jednym narzędziu liczy BMI i zapotrzebowanie energetyczne (na podstawie płci, wieku, wzrostu, wagi i poziomu aktywności PAL) — czyli państwo konkuruje bezpośrednio z komercyjnymi kalkulatorami kalorii/BMI, na które dietanaluzie.pl mogłoby stawiać jako magnesy ruchu.**
  - cytat: „Wpisz dane do kalkulatora i wylicz swoje BMI. Wynik określi, jakie zapotrzebowanie energetyczne ma Twój organizm.”
- **Portal NFZ oferuje bezpłatne, gotowe jadłospisy o długości do 28 dni dla użytkownika i całej rodziny, co zaniża skłonność Polaków do płacenia za podstawowe plany posiłków i podnosi poprzeczkę dla płatnego planera dietanaluzie.pl (przewaga musi leżeć w personalizacji/UX, nie w samym dostępie do jadłospisu).**
  - cytat: „Bezpłatne diety nawet na 28 dni”
- **KalkulatorKalorii.net opiera swoją stronę główną na zestawie sześciu darmowych kalkulatorów (kalorii, spalania kalorii, przemiany materii, BMI, odchudzania, idealnej wagi), co potwierdza model 'kalkulatory jako magnes ruchu' w polskiej niszy dietetycznej.**
  - cytat: „Kalkulator Kalorii; Kalkulator spalania kalorii; Kalkulator przemiany materii; Kalkulator BMI; Kalkulator odchudzania; Kalkulator idealnej wagi”
- **Darmowe kalkulatory służą jako lejek do płatnych usług: subskrypcyjnego Dziennika Kalorii i gotowych planów diet z osobnym cennikiem, co pokazuje sprawdzoną ścieżkę monetyzacji narzędzi (freemium → plan posiłków).**
  - cytat: „"Dziennik Kalorii" (/landing/dziennik-kalorii); "Dieta Extra Smaczna" (/landing/dieta-extra-smaczna); "Cennik naszych usług" (/cennik/wybierz)”
- **Food creators reported spadki ruchu z Google rzędu 30-80% w sezonie świątecznym 2025 (Thanksgiving), określając go jako najgorszy sezon w historii swoich blogów kulinarnych.**
  - cytat: „Many food creators reported between 30% and 80% drops in Google traffic, with some calling this their worst holiday season yet.”
- **Google AI Overviews wyświetlają zmiksowane kroki gotowania z wielu blogów ponad linkami do źródeł, z których czerpią treść, co odbiera kliknięcia blogerom kulinarnym.**
  - cytat: „Google's AI Overviews now surface blended cooking steps from multiple bloggers, often above the links/sources they draw from”
- **Carrie Forrest (Clean Eating Kitchen, blog o zdrowym odżywianiu) straciła 80% ruchu i przychodów w ciągu dwóch lat, co zmusiło ją do zwolnienia zespołu.**
  - cytat: „she lost 80% of her traffic and revenue in two years, forcing her to lay off her team”
- **Publikacja AI Overviews przy zapytaniach kulinarnych powoduje mierzalny spadek klikalności dla blogów z przepisami — Inspired Taste odnotował ok. 30% spadek CTR, gdy AI Overviews pojawiły się przy zapytaniach o koktajle.**
  - cytat: „Adam Gallagher (Inspired Taste): 30% drop in click-through rates when AI Overviews appeared for cocktail queries”
- **Straty ruchu blogów kulinarnych w latach 2024-2025 sięgają skrajnie 80% w dwa lata — Clean Eating Kitchen (blog o zdrowym odżywianiu, a więc nisza zbliżona do dietanaluzie.pl) stracił 80% ruchu i przychodów, redukując zespół z ok. 10 osób do zera.**
  - cytat: „Carrie Forrest (Clean Eating Kitchen): 80% traffic and revenue loss over two years; went from ~10 employees to zero staff”
- **Pinterest przestaje być stabilnym kanałem ratunkowym dla blogów z przepisami — The Food Blog odnotował spadek udziału Pinteresta w referralach z ok. 25% do 11% w rok, a miesięczne wyświetlenia spadły z 1,3 mln do 419 tys.; MyDinner raportuje spadek Pinteresta o 50% przy równoczesnym spadku Google o 30%.**
  - cytat: „Colleen Milne (The Food Blog): Pinterest traffic collapsed from ~25% to 11% of total referrals over one year; Pinterest monthly views dropped from 1.3 million to 419,000”
- **Raptive oszacowało, że pierwotna wersja Google SGE (poprzednik AI Overviews) obcięłaby ruch z wyszukiwarki do stron twórców o około 66%.**
  - cytat: „SGE in its original form was likely to have a 66% impact on search traffic.”
- **Według późniejszych danych Raptive (stan na moment startu AI Overviews, maj 2024) przewidywany spadek ruchu z wyszukiwarki dla twórców wynosi około 25%, przy czym część serwisów ucierpi bardziej, a część mniej.**
  - cytat: „our latest data indicated a 25% drop in search traffic, with the possibility that some creators would be hit worse, and others might fare better.”
- **W późniejszych iteracjach testów Google rzadziej generował odpowiedzi AI dla zapytań kulinarnych (food), co sugeruje, że blogi z przepisami mogą być relatywnie mniej dotknięte niż inne kategorie.**
  - cytat: „We also saw more prominent links appearing, and it was less likely to generate a response around food.”
- **Inspired Taste zmierzyło ok. 40% spadek kliknięć z Google dla stron z przepisami na koktajle po pojawieniu się AI Overviews na ich zapytaniach (dane cytowane przez Bloomberg).**
  - cytat: „So we passed that data to Bloomberg and we were quoted as, I think we said it was 40% decrease for those instances.”
- **Przy AI Overviews liczba wyświetleń (impressions) w Google Search Console pozostała stabilna lub rosła, podczas gdy kliknięcia spadły natychmiast — co oznacza, że spadku CTR nie widać po samych impressions.**
  - cytat: „We can actually see the impressions stay up, if not increase, but the clicks dropped immediately.”
- **Rosnące użycie leków odchudzających z grupy agonistów receptora GLP-1 zmienia sposób myślenia o kontroli masy ciała i jest wymieniane jako czynnik kształtujący trendy żywieniowe 2026 — potwierdza popyt na treści/przepisy pod użytkowników GLP-1 wskazany w pytaniu badawczym.**
  - cytat: „rosnące zastosowanie leków odchudzających z grupy agonistów receptora GLP-1, które zmieniają sposób myślenia o kontroli masy ciała”

### Wspierające (supporting) (98)

- **Eb Gargano odnotowała 40% spadek ruchu na przepisach rok do roku.**
  - cytat: „40% year-over-year decline”
- **Artykuł nie podaje żadnych strategii obronnych dla blogerów kulinarnych; jest agregacją śledztwa Bloomberga ("AI Slop Recipes Are Taking Over the Internet — And Thanksgiving Dinner"), a nie oryginalnym researchem Search Engine Land.**
  - cytat: „AI Slop Recipes Are Taking Over the Internet — And Thanksgiving Dinner”
- **Spadki dotyczą też Pinteresta: The Food Blog zanotował spadek udziału ruchu z Pinteresta z ok. 25% do 11%, a miesięczne wyświetlenia spadły z ok. 1,3 mln do 419 tys.; MyDinner raportuje Google -30% r/r i Pinterest -50%.**
  - cytat: „Pinterest monthly views, once around 1.3 million, dropped to 419,000 ... Google traffic down 30% this year, Pinterest down 50%”
- **Przepisy sklejane przez AI Overviews bywają błędne merytorycznie (np. wygenerowany przepis na ciasto świąteczne kazał piec 6-calowe ciasto 3-4 godziny w 160°C), co blogerzy podnoszą jako argument za wartością źródeł ludzkich; artykuł nie opisuje jednak konkretnych skutecznych strategii obronnych blogerów.**
  - cytat: „would have people cooking a 6-inch cake for 3 to 4 hours at 320°F (160°C) ... You'd end up with charcoal!”
- **Automatyzacje DM na Instagramie mają do 4x wyższy CTR niż naklejki z linkami (link stickers), co artykuł podaje jako argument za konwersją zaangażowania social na ruch własny — twierdzenie własne firmy sprzedającej takie narzędzia.**
  - cytat: „DMs have up to 4x the CTR of link stickers.”
- **Personalizacja treści e-mail może podnieść CTR newslettera o ponad 25% (przywoływane za danymi benchmarkowymi HubSpot 2025), co wspiera strategię obrony przez budowę listy mailingowej.**
  - cytat: „Personalized content can lift email CTR by more than 25%”
- **Rekomendowana obrona blogów kulinarnych przed utratą ruchu z Google to przenoszenie odbiorców do kanałów własnych: automatyzacje DM, deep linki zakupowe i budowa listy e-mail z segmentacją (workflow "Save to Email").**
  - cytat: „Convert Instagram engagement into owned traffic via DM automations; Integrate shopping experiences with deep links and carousel DMs; Build email lists through "Save to Email" workflows with segmentation”
- **Raptive's recommended defensive action for publishers was to block AI crawlers (e.g. GPTBot) via robots.txt.**
  - cytat: „For now, we are recommending that sites explicitly disallow AI crawlers in their robots.txt files.”
- **Raptive advises that creators emphasizing authenticity and personal storytelling will be most resilient to AI-driven search disruption.**
  - cytat: „Creators who focus on authenticity and storytelling will be in the strongest position.”
- **Google AI Overviews przy zapytaniach brandowych (np. "Inspired Taste Cosmopolitan") wyświetla zniekształcone, sklejone "frankensteinowe" przepisy sygnowane marką bloga, co zdaniem autora podważa zaufanie użytkowników do marki.**
  - cytat: „Google's using our brand name to manipulate the user trust line”
- **Jedną ze strategii obronnych recipe-blogów jest blokowanie crawlerów AI (ChatGPT, Perplexity, Claude) przez Cloudflare Enterprise, z deklarowaną skutecznością ponad 95%.**
  - cytat: „95 plus percent accuracy”
- **Fibermaxxing (świadome maksymalizowanie spożycia błonnika, celowanie w 40-50g dziennie zamiast rekomendowanych ~25-30g) będzie jednym z głównych trendów żywieniowych 2026 roku, co sugeruje popyt na treści i przepisy wysokobłonnikowe.**
  - cytat: „świadome zwiększanie spożycia błonnika [...] większość dorosłych nie osiąga rekomendowanego spożycia błonnika”
- **Rosnące stosowanie leków odchudzających z grupy agonistów GLP-1 jest wskazywane jako czynnik kształtujący trendy żywieniowe w 2026 r., co potwierdza zasadność tworzenia treści pod kątem diet towarzyszących terapii GLP-1.**
  - cytat: „rosnące zastosowanie leków odchudzających z grupy agonistów receptora GLP-1”
- **Ograniczanie żywności ultraprzetworzonej (UPF) ma być istotnym trendem 2026, uzasadnianym wpływem UPF na sygnały głodu i nadmierne spożycie kalorii — potencjalna nisza keywordowa dla serwisu z przepisami dietetycznymi.**
  - cytat: „diety bogate w [UPF] mogą zaburzać sygnały głodu, sprzyjać nadmiernemu spożyciu kalorii”
- **W rankingu 96 polskich dietetyków oceniających 33 najpopularniejsze w Polsce modele żywieniowe (badanie dietetycy.org.pl) najlepszą dietą na 2026 r. jest dieta śródziemnomorska (wynik 93), a za nią dieta DASH (92).**
  - cytat: „96 doświadczonych dietetyków [oceniło] 33 najpopularniejsze w Polsce modele żywieniowe [...] Dieta śródziemnomorska (Score: 93) [...] Dieta DASH (Score: 92)”
- **98 proc. ankietowanych dietetyków poleca dietę śródziemnomorską, a 97 proc. dietę DASH; tylko 1 proc. je odradza.**
  - cytat: „Mediterranean diet: 98 proc. dietetyków poleca, 1 proc. odradza; DASH diet: 97 proc. poleca, 1 proc. odradza”
- **Najgorzej ocenioną dietą jest dieta sokowa, którą odradza 99 proc. dietetyków; nisko oceniono też diety ketogeniczną, paleo, Dukana, Atkinsa, Kwaśniewskiego i wegańską.**
  - cytat: „Dieta sokowa - odradza aż 99 proc. dietetyków. Also ranked poorly: wegańska, ketogeniczna, paleo, Dukana, Atkinsa, Kwaśniewskiego”
- **W pierwszej piątce rankingu znalazły się także dieta MIND (75), dieta o niskim indeksie glikemicznym (62) i fleksitarianizm (54), co wskazuje na uznanie ekspertów dla diet o niskim IG (istotnych m.in. przy insulinooporności).**
  - cytat: „Dieta MIND (Score: 75), Dieta o niskim indeksie glikemicznym (Score: 62), Fleksitarianizm (Score: 54)”
- **Zasięg AI Overviews rośnie i obejmuje coraz więcej typów zapytań: wg Semrush udział zapytań komercyjnych z AIO wzrósł z 6% (styczeń 2025) do 19% (październik 2025), a wg People Inc. AIO pojawiały się przy 35% słów kluczowych w Q1, a kwartał później już przy 55%.**
  - cytat: „Semrush (January 2025): informational searches with AIOs were '91%,' commerce '6%' ... Semrush (October 2025): informational searches '57%,' commercial searches '19%' ... People Inc.: AIOs appeared on '35% of search keywords' in Q1, '55%' by following quarter”
- **Ruch referencyjny z platform AI nie rekompensuje strat z wyszukiwarki: wg badania Conductor platformy AI odpowiadają za zaledwie 1% całego ruchu wydawców, mimo że ChatGPT wysłał 1,2 mld przekierowań (wrzesień-listopad 2025, +52% r/r).**
  - cytat: „Similarweb data (Sept-Nov 2025): ChatGPT sent '1.2 billion outgoing referrals' (52% YoY increase) ... Conductor research: AI platforms account for 'just 1% of all publisher traffic'”
- **W rankingach diet od lat pierwsze miejsce zajmuje dieta śródziemnomorska, a drugie dieta DASH — to wskazuje na utrzymujący się popyt informacyjny na te dwie diety.**
  - cytat: „Ranking diet od lat kończy się tak samo: na czele dieta śródziemnomorska, tuż za nią DASH.”
- **Według artykułu integracja technologii z dietetyką (aplikacje mobilne, wearables, AI) jest jednym z głównych trendów dietetycznych na 2026 rok, umożliwiając precyzyjne śledzenie nawyków żywieniowych — co potwierdza popyt na narzędzia typu trackery/kalkulatory/planery w niszy diet.**
  - cytat: „aplikacje mobilne, urządzenia wearable, a także sztuczna inteligencja [...] precyzyjne śledzenie nawyków żywieniowych pacjentów”
- **Personalizacja żywienia oparta na danych (genetyka, mikrobiom jelitowy, wyniki badań krwi) jest wskazywana jako czołowy trend dietetyki 2025-2026, tj. plany żywieniowe szyte pod konkretne potrzeby pacjenta.**
  - cytat: „zaawansowaną analizę danych genetycznych, mikrobiomu jelitowego, a także wyników badań krwi [...] plan żywieniowy do konkretnych potrzeb pacjenta”
- **Artykuł NIE wymienia trendów kluczowych dla pytania badawczego: leków GLP-1, insulinooporności, diet redukcyjnych ani trendów social media — jego wartość dla analizy popytu 2025-2026 jest więc ograniczona do trendów technologiczno-personalizacyjnych.**
  - cytat: „Article mentions no specific references to weight loss diets, insulin resistance protocols, GLP-1 drugs, or social media trends.”
- **Według badania Gemius/PBI za maj 2020 Kwestiasmaku.com było największym polskim serwisem kulinarnym z ok. 3,99 mln realnych użytkowników (14,4% zasięgu) i 24,67 mln odsłon.**
  - cytat: „Kwestiasmaku.com - 3.99 million users, 14.4% reach, 24.67 million pageviews”
- **Aniagotuje.pl zanotowało w maju 2020 jeden z największych wzrostów rok do roku wśród serwisów kulinarnych: +1,35 mln użytkowników (wzrost o 114,2%) i +4,97 mln odsłon (230,9%).**
  - cytat: „Aniagotuje.pl: "+1.35 million users (114.2%), 4.97 million pageviews (230.9%)"”
- **Przepisy.pl (Unilever Polska) zwiększyło odsłony rok do roku o 20,14 mln, czyli o 757,1%, przy wzroście użytkowników o 122,8%.**
  - cytat: „Przepisy.pl: "+1.14 million users (122.8%), 20.14 million pageviews (757.1%)"”
- **Artykuł prognozuje, że AI w najbliższej przyszłości całkowicie zmieni sposób pracy dietetyka dzięki nieograniczonemu dostępowi do danych i personalizacji diety — co wspiera tezę o rosnącym popycie na spersonalizowane narzędzia (generatory jadłospisów, planery) w niszy dietetycznej.**
  - cytat: „Nieograniczony dostęp do danych i personalizacji diety, wykraczający poza obecne możliwości oznacza w niedalekiej przyszłości kompletną zmianę sposobu pracy z pacjentem”
- **Rosnącym tematem popytowym na 2026 r. jest błonnik i zdrowie jelit — eksperci alarmują o deficycie spożycia błonnika w polskim społeczeństwie, co wskazuje potencjalną lukę contentową dla serwisu z przepisami.**
  - cytat: „Coraz więcej ekspertów bije na alarm, że nasze społeczeństwo cierpi na deficyt spożycia tego składnika. Wiele osób łączy to też z licznymi problemami ze zdrowiem jelit.”
- **Dietetyka w mediach społecznościowych jest silnie spolaryzowana, a przekaz evidence-based traci autorytet — co ma znaczenie dla strategii pozycjonowania treści serwisu na TikTok/Instagram (kontrowersja generuje zasięgi, rzetelność może być wyróżnikiem).**
  - cytat: „W świecie mediów społecznościowych evidence-based nutrition już nie jest królem. [...] dietetyka w świecie mediów społecznościowych staje się spolaryzowana jak nigdy dotąd.”
- **Zdrowie jelit jest wskazywane jako osobny, szeroki trend konsumencki 2026 (łączony z odpornością, hormonami i skórą), co może uzasadniać kategorie treści typu "przepisy na zdrowe jelita" obok klasycznej redukcji.**
  - cytat: „Zdrowe jelita to nie tylko kwestia prawidłowego trawienia, ale również odporności, równowagi hormonalnej, kondycji skóry.”
- **Konsumenci w 2026 r. mają preferować produkty o krótkim, transparentnym składzie opartym na warzywach (clean label), co wspiera pozycjonowanie przepisów "z prostych składników".**
  - cytat: „produkty o krótkim, transparentnym składzie, opartym na warzywach”
- **Udział Google Web Search w ruchu do wydawców newsowych spadł z 51% do 27% między 2023 a IV kwartałem 2025.**
  - cytat: „Google Web Search traffic to news publishers dropped from 51% to 27% between 2023 and the fourth quarter of 2025”
- **Facebook wzrósł z 0,57% do 6,42% udziału w ruchu po tym, jak Pinch of Yum zaczął od Q4 2025 publikować konsekwentnie 3 razy dziennie, zyskując przy tym niemal 500 tys. obserwujących i przychody z programu monetyzacji Facebooka.**
  - cytat: „Just by posting more consistently (three times a day), they've been able to meaningfully increase traffic from Facebook to the blog, _and_ take advantage of the Facebook monetization program.”
- **Udział Pinteresta w ruchu Pinch of Yum spadł z 6,33% (marzec 2024) do 3,99% (marzec 2026), co podważa Pinterest jako rosnący kanał dla recipe-blogów.**
  - cytat: „Pinterest drops from 6.33% to 3.99%.”
- **Ruch bezpośredni (direct) spadł z 21,97% do 9,84%, co autor interpretuje jako zmianę zachowań czytelników — powracają przez e-mail i social media zamiast wpisywać adres URL — a nie utratę lojalności.**
  - cytat: „Direct: 21.97% [...] Direct: 9.84%”
- **On Pinterest, seasonal recipe content should be pinned 45-60 days before search interest peaks (e.g., summer grilling recipes starting in April) to gain visibility in time.**
  - cytat: „Pin seasonal content early: Start sharing seasonal recipes 45–60 days before search interest peaks”
- **A new food blog needs roughly 30-50 well-optimized recipes and 6-12 months before seeing steady organic Google traffic.**
  - cytat: „30-50 well-optimized recipes is a realistic starting point ... six to twelve months to see steady organic traffic”
- **Updating/refreshing old recipe posts is the highest-leverage content activity for food blogs, ahead of publishing new content.**
  - cytat: „Your oldest recipes are usually your biggest missed opportunity”
- **Baza produktów kalkulatora kalorii obejmuje ponad 18 000 produktów, co stanowi barierę wejścia dla konkurencyjnych narzędzi tego typu.**
  - cytat: „Błyskawicznie sprawdź kalorie i wartości odżywcze ponad 18 000 produków”
- **Serwis deklaruje 32 000 płacących/zadowolonych klientów, co sugeruje skuteczność lejka kalkulator → płatna dieta (dane self-reported, marketingowe).**
  - cytat: „"32 000 zadowolonych klientów" ... "12 kg zrzuca przeciętnie nasz klient"”
- **Oryginalne badania i raporty oparte na własnych danych są najskuteczniejszym typem linkable asset (autor nazywa je „królem" link buildingu), a dziennikarze cytują źródła dostarczające twardych danych**
  - cytat: „To absolutny „król" link buildingu. Nie musisz być Instytutem Gallupa.”
- **Checklisty, szablony i wzory dokumentów do pobrania to format, który użytkownicy zapisują w zakładkach i do którego wracają, co czyni je magnesem na linki**
  - cytat: „Szablon umowy, checklista do audytu SEO, wzór maila sprzedażowego – to materiały, które chętnie zapisuje się w zakładkach.”
- **Najlepsze linkable assets należy aktualizować co 6-12 miesięcy (m.in. dopisując bieżący rok w tytule), aby przeciwdziałać starzeniu się danych i zachęcać do nowych linków**
  - cytat: „Aktualizuj swoje najlepsze Linkable Assets co 6-12 miesięcy. Dodaj dopisek z bieżącym rokiem w tytule.”
- **Warunkiem zdobywania linków jest dostarczenie „Information Gain" – unikalnej wartości niedostępnej nigdzie indziej**
  - cytat: „Musisz dostarczyć coś, co Google nazywa Information Gain – unikalną wartość, której nie ma nigdzie indziej.”
- **W kategorii "Zdrowie i medycyna" Mediapanel za lipiec 2025 liderem jest Medonet z 5 439 636 realnymi użytkownikami i 18,30% zasięgu internetu, przed Znanym Lekarzem (4 175 388 RU) i ABC Zdrowie (3 456 918 RU) — to wyznacza sufit skali dla polskich treści zdrowotno-dietetycznych.**
  - cytat: „Zdrowie i medycyna, lipiec 2025: 1. MEDONET 5 439 636, 18,30%, 10m 0s; 2. ZNANY LEKARZ 4 175 388, 14,05%; 3. ABC ZDROWIE 3 456 918, 11,63% (tabela z grafiki rankingu)”
- **Narzędzia/aplikacje typu tracker plasują się w TOP10 zdrowia obok dużych wydawców: "Mój Kalendarz Miesiączkowy" ma 1 506 600 RU (6. miejsce), a Flo Health 1 424 790 RU (8. miejsce), wyprzedzając serwisy Interii (1 410 696) i Onetu (1 110 186) — co wspiera tezę, że narzędzia (kalkulatory, trackery) same w sobie przyciągają duży ruch.**
  - cytat: „6. MÓJ KALENDARZ MIESIĄCZKOWY 1 506 600, 5,07%; 7. GDZIE PO LEK 1 491 372; 8. FLO HEALTH 1 424 790, 4,79%; 9. INTERIA 1 410 696; 10. ONET 1 110 186 (tabela z grafiki rankingu)”
- **Zestawienie tematyczne Mediapanel za lipiec 2025 nie zawiera kategorii kulinarnej (jedzenie/gotowanie), a serwisy aniagotuje.pl, kwestiasmaku.com, poradnikzdrowie.pl i Fitatu nie występują w żadnym z 11 publikowanych rankingów TOP10 — źródło nie pozwala więc bezpośrednio zmierzyć ruchu konkurentów recepturowych dietanaluzie.pl.**
  - cytat: „Kategorie w zestawieniu: Informacje i publicystyka - ogólne; Informacje lokalne i regionalne; Biznes, finanse, prawo; Serwisy VOD i OTT; Nauka i technologia; Serwisy społecznościowe; Sport; Wielotematyczne serwisy kobiece; Plotki, życie gwiazd; Zdrowie i medycyna; Zakupy online”
- **Od lipca 2025 badanie Mediapanel przeszło na metodę JAR Flex opartą o first-party cookies, a Gemius/PBI wprost odradza porównywanie wyników sprzed i po zmianie — każda analiza trendów ruchu polskich serwisów obejmująca połowę 2025 r. musi uwzględniać tę nieciągłość metodologiczną.**
  - cytat: „badanie Mediapanel od lipca 2025 realizowane jest z wykorzystaniem metody JAR Flex [...] W związku z wdrożeniem JAR Flex nie rekomendujemy porównywania wyników pochodzących z okresów przed zmianą oraz po niej”
- **Aniagotuje.pl notuje najwyższe zaangażowanie w kategorii: średni czas na użytkownika 7 min 15 s, wyraźnie więcej niż kwestiasmaku.com (4 min 26 s) i pysznosci.pl (3 min 20 s).**
  - cytat: „Each user spent an average of 7 minutes and 15 seconds on the site”
- **Czołówka rynku obejmuje też serwisy grup mediowych: Smaker (Interia) 4,41 mln, Smakosze.pl (Iberion) 4,34 mln i Haps.pl (Agora) 3,43 mln użytkowników.**
  - cytat: „Smaker (Interia Group) - 4.41 million users (14.86% reach) ... Smakosze.pl (Iberion) - 4.34 million users (14.62% reach) ... Haps.pl (Agora) - 3.43 million users (11.58% reach)”
- **Po sprioretyzowaniu Facebooka w Q4 2025 Pinch of Yum odnotował wzrost ruchu z tej platformy o 1 028% (z 0,57% do 6,42% udziału) i zdobył blisko 500 tys. obserwujących.**
  - cytat: „Facebook saw dramatic 1,028% increase after prioritizing platform in Q4 2025 (gaining nearly 500K followers).”
- **Udział Pinteresta w ruchu Pinch of Yum spadł z 6,33% do 3,99%, a Instagrama z 1,25% do 0,62% między marcem 2024 a marcem 2026.**
  - cytat: „Pinterest | 6.33% | 3.99% | -2.34% | Instagram | 1.25% | 0.62% | -0.63%”
- **Ruch Pinch of Yum uległ dywersyfikacji: rozłożył się na więcej kanałów zamiast koncentrować się w kilku źródłach, a rekomendowana strategia to traktowanie ruchu jako powiązanego ekosystemu kanałów.**
  - cytat: „Traffic spread across more channels rather than concentrating in fewer sources. ... Treat traffic as interconnected ecosystem”
- **Ranking źródeł przepisów wśród ankietowanych: blogi/strony kulinarne 48%, YouTube 40%, przepisy rodzinne 31%, książki kucharskie 27%, TikTok 22% — TikTok jest już istotnym, choć nie dominującym kanałem odkrywania przepisów.**
  - cytat: „Online food blogs and websites at 48%, YouTube at 40%, family recipes and traditions at 31%, physical cookbooks at 27%, and TikTok at 22%”
- **Ruch z Google Web Search do wydawców newsowych spadł z 51% do 27% między 2023 a IV kwartałem 2025, co ilustruje szerszy trend erozji ruchu organicznego u wydawców treści.**
  - cytat: „Google Web Search traffic to news publishers dropped from 51% to 27% between 2023 and the fourth quarter of 2025”
- **Sezon świąteczny 2025, tradycyjnie najbardziej dochodowy okres dla blogów kulinarnych, był dla wielu autorów wyraźnie słabszy niż zwykle.**
  - cytat: „Dla wielu autorów sezon świąteczny, tradycyjnie najważniejszy pod względem przychodów, okazał się wyraźnie słabszy.”
- **Badania konsumenckie sugerują, że wraz z rosnącą ekspozycją na treści generowane przez AI spada zaufanie użytkowników do takich treści, co daje przewagę autentycznym twórcom.**
  - cytat: „Badania konsumenckie sugerują jednak, że wraz ze wzrostem kontaktu z treściami generowanymi przez AI spada zaufanie do nich.”
- **Kwestiasmaku.com było liderem polskich serwisów kulinarnych w maju 2020 r. z 3,99 mln realnych użytkowników i 14,4 proc. zasięgu (wg badania Gemius/PBI), przed Smaker.pl (3,3 mln) i Przepisy.pl (ok. 2,07-2,9 mln).**
  - cytat: „W maju br. witrynę Kwestiasmaku.com odwiedziło 3,99 mln użytkowników, co dało 14,4 proc. zasięgu.”
- **Aniagotuje.pl zanotowało w maju 2020 r. jeden z największych wzrostów rok do roku w kategorii kulinarnej: +1,35 mln użytkowników (+114,2 proc.) i +4,97 mln odsłon (+230,9 proc.).**
  - cytat: „Na Aniagotuje.pl przybyło 1,35 mln internautów (114,2 proc.) i 4,97 mln odsłon (230,9 proc.)”
- **Przepisy.pl (serwis contentowy marki, nie blog) rósł rok do roku najszybciej pod względem odsłon: +1,14 mln użytkowników (+122,8 proc.) i +20,14 mln odsłon (+757,1 proc.) w maju 2020 r.**
  - cytat: „na Przepisy.pl - 1,14 mln użytkowników (122,8 proc.) i 20,14 mln odsłon (757,1 proc.).”
- **Mojewypieki.com (blog niszowy — wypieki) podwoiło zasięg rok do roku: +1,17 mln użytkowników (+122,1 proc.) i +8,82 mln odsłon (+211,7 proc.), co pokazuje że wąska specjalizacja tematyczna może skalować się do ponad 2 mln UU miesięcznie na polskim rynku.**
  - cytat: „na Mojewypieki.com - 1,17 mln internautów (122,1 proc.) i 8,82 mln odsłon (211,7 proc.)”
- **Zestawienie tematyczne Mediapanel za lipiec 2025 nie zawiera osobnej kategorii 'Kulinaria'; wśród 11 publikowanych kategorii tematycznych jest natomiast 'Zdrowie i medycyna', co oznacza, że z tego wydania nie da się bezpośrednio odczytać rankingu polskich serwisów kulinarnych (aniagotuje.pl, kwestiasmaku.com itp.).**
  - cytat: „Thematic Categories Listed: 1. Informacje i publicystyka - ogólne ... 10. Zdrowie i medycyna 11. Zakupy online”
- **Od lipca 2025 badanie Mediapanel jest realizowane nową metodą JAR Flex (First-Party Cookies, Cookie Matching, Browsers Number), a Gemius/PBI odradza porównywanie wyników sprzed i po zmianie — co unieważnia proste porównania rok-do-roku ruchu konkurentów dietanaluzie.pl oparte na danych Mediapanel z 2025 r.**
  - cytat: „W związku z wdrożeniem JAR Flex nie rekomendujemy porównywania wyników pochodzących z okresów przed zmianą oraz po niej.”
- **Nowe blogi kulinarne potrzebują zwykle 6-12 miesięcy, zanim zobaczą stabilny ruch organiczny z SEO.**
  - cytat: „Most new food blogs take six to twelve months to see steady organic traffic”
- **30-50 dobrze zoptymalizowanych przepisów to realistyczny punkt wyjścia do zbudowania topical authority w niszy kulinarnej — istotny benchmark dla serwisu z ograniczoną liczbą treści, gdzie 50% ruchu pochodzi z 3 stron.**
  - cytat: „30-50 well-optimized recipes is a realistic starting point for building topical authority”
- **Próg wejścia do premium sieci reklamowych (Mediavine, Raptive) to ok. 25 000+ sesji miesięcznie — punkt odniesienia dla monetyzacji reklamowej przy obecnych ~5k UU/mies. dietanaluzie.pl.**
  - cytat: „With proper SEO driving 25,000+ monthly sessions, ad networks like Mediavine or Raptive become accessible”
- **Pinterest działa jako wizualna wyszukiwarka dla treści kulinarnych, a treści sezonowe trzeba pinować z 2-3-miesięcznym wyprzedzeniem (np. przepisy grillowe od kwietnia).**
  - cytat: „Pinterest functions as a visual search engine [...] Begin pinning summer grilling recipes in April”
- **Posty z instrukcjami numerowanymi, ale bez opakowania kroków w HowToStep w JSON-LD, są pomijane przez AI Mode; wymagany jest też autor jako obiekt Person z prawdziwym nazwiskiem i URL bio.**
  - cytat: „Posts with numbered instructions but no HowToStep wrapping get skipped”
- **Bloger kulinarny Clean Eating Kitchen (Carrie Forrest) stracił 80% ruchu i przychodów w ciągu dwóch lat, co ilustruje skalę wpływu zmian Google na recipe-blogi.**
  - cytat: „lost 80 percent of her traffic and revenue in two years”
- **Progi monetyzacji reklamami dla food-blogów w 2026: Raptive wymaga 25 000 odsłon miesięcznie, Mediavine Official celuje w 5 000+ USD rocznego przychodu z reklam, a program Journey przyjmuje od 1 000 sesji; model SEO-dla-reklam jest oceniany jako kruchy.**
  - cytat: „Raptive requires 25,000 monthly pageviews; Mediavine Official targets $5,000+ in annual ad revenue, with Journey from 1,000 sessions for smaller sites”
- **Stawki programmatic display (CPM) dla wydawców spadły o 35,9% rok do roku wg raportu z kwietnia 2025, co osłabia model monetyzacji recipe-blogów oparty wyłącznie na reklamach.**
  - cytat: „One April 2025 report showed programmatic display CPMs fell 35.9% year-over-year”
- **Rekomendowany model repurposingu treści dla recipe-blogów w 2026: jeden wpis blogowy powinien generować 1 długi film YouTube, 5-7 krótkich wideo (Shorts/Reels/TikTok) i 10-15 pinów na Pinterest.**
  - cytat: „1 Blog Post = 1 Long-Form YouTube Video...5-7 Short-Form Videos...10-15 Pinterest Pins”
- **Obrona przed AI Overviews i utratą ruchu opiera się na kanałach własnych (lista e-mail jako aktywo, którego platformy nie mogą odebrać) oraz dywersyfikacji przychodów: produkty cyfrowe, membershipy (np. case 40 Aprons z płatnym dostępem bez reklam), afiliacja.**
  - cytat: „The 40 Aprons case study...created a premium membership...that gives users an ad-free experience”
- **Kalkulatory i narzędzia interaktywne zdobywają linki zwrotne pasywnie, ponieważ inne serwisy linkują do nich, by podnieść wartość własnych artykułów — co wspiera tezę, że kalkulatory (kalorii, BMI, deficytu, makro) na dietanaluzie.pl mogą działać jako magnesy linków, nie tylko ruchu.**
  - cytat: „Inne strony chętnie linkują do narzędzi, bo to podnosi wartość ich własnych artykułów”
- **Zamiast artykułu informacyjnego lepiej stworzyć proste narzędzie interaktywne odpowiadające na tę samą intencję wyszukiwania (przykład autora: kalkulator zamiast artykułu o kosztach malowania ścian).**
  - cytat: „Zamiast pisać artykuł „Ile kosztuje malowanie ścian", stwórz prosty kalkulator”
- **Interaktywne narzędzia — kalkulatory, quizy i widgety osadzane na stronach partnerów — generują naturalne backlinki i należą do skutecznych formatów link baitingu (co wspiera tezę, że kalkulatory kalorii/BMI/makro mogą przyciągać linki do serwisu dietetycznego).**
  - cytat: „Interactive calculators – ROI calculators for SEO campaigns specifically mentioned; Quizzes and tests – embedded on partner sites; Interactive widgets – generate natural backlinks”
- **Oryginalne badania/raporty branżowe potrafią wygenerować setki backlinków — przykład polski: raport Cyrek Digital o trendach SEO 2026 miał zdobyć ponad 200 backlinków.**
  - cytat: „Original research/reports – Polish example: Cyrek Digital's 2026 SEO trends report generated 200+ backlinks”
- **Oferta NFZ obejmuje ponad 20 wyspecjalizowanych wariantów diet, w tym dietę DASH oraz plany dla cukrzycy, Hashimoto, PCOS, nadciśnienia i nadwagi — pokrywa więc część nisz "dieta w jednostce chorobowej", które są potencjalnymi klastrami keywordowymi dla serwisu z przepisami dietetycznymi.**
  - cytat: „Przetestuj dietę DASH!”
- **Kalkulator kalorii serwisu bazuje na bazie ponad 18 000 produktów spożywczych, co wyznacza poziom odniesienia dla konkurencyjnego narzędzia wyszukiwania/liczenia kalorii.**
  - cytat: „ponad 18 000 produktów”
- **Serwis deklaruje (samodzielnie, marketingowo) 32 000 płacących/zadowolonych klientów ze średnim ubytkiem wagi 12 kg, co sugeruje realną skalę monetyzacji polskiego rynku narzędzi dietetycznych.**
  - cytat: „32 000 zadowolonych klientów i stale przybywa; 12 kg zrzuca przeciętnie nasz klient”
- **Obok kalkulatorów serwis utrzymuje sekcje treściowe SEO (przepisy w kategoriach: zupy, sałatki, śniadania, dania główne, desery; artykuły o odchudzaniu i diecie w chorobach; diety specjalistyczne np. bez laktozy, przy tarczycy) oraz aplikację mobilną na Android/iOS, łącząc narzędzia z contentem w jednym ekosystemie.**
  - cytat: „Wszystkie funkcje Kalkulatora w Twoim telefonie”
- **Blogerka Eb Gargano odnotowała 40% spadek ruchu na przepisach rok do roku, a AI Overview podawał błędne instrukcje (np. pieczenie 6-calowego ciasta świątecznego przez 3-4 godziny).**
  - cytat: „40% year-over-year decline ... baking a 6-inch Christmas cake for 3 to 4 hours. 'You'd end up with charcoal!'”
- **Wielu blogerów kulinarnych odkryło strony prowadzone przez AI klonujące całe ich katalogi przepisów: przepisane instrukcje, przerobione zdjęcia i syntetyczne obrazy.**
  - cytat: „Multiple bloggers found AI-run sites cloning their entire catalogs, rewriting instructions, tweaking photos, and even generating synthetic images”
- **Sezonowy ruch na sztandarowe przepisy świąteczne spada rok do roku — Easy Peasy Foodie odnotował 40% spadek ruchu na przepisy na indyka (Thanksgiving) r/r, co pokazuje erozję nawet najsilniejszych evergreenów sezonowych.**
  - cytat: „Eb Gargano (Easy Peasy Foodie): Turkey recipe traffic down 40% year over year”
- **Główną linią obrony blogerów kulinarnych przed AI-slopem jest budowanie zaufania i dowodu autentyczności (prawdziwe strony 'o nas', testowane przepisy, edukowanie odbiorców o błędach AI), a nie techniczne SEO — bo przewaga człowieka to fakt, że przepis został realnie ugotowany.**
  - cytat: „No matter how clever the AI is, it can never actually test a recipe in a real kitchen and see how it works.”
- **Mechanizm strat: odpowiedzi AI spychają linki do treści twórców (źródeł informacji) niżej na stronie wyników, o ile w ogóle się pojawiają, więc użytkownik może nigdy nie odwiedzić strony źródłowej.**
  - cytat: „Artificial Intelligence is now front and center, pushing links to creator content—the sources of its information—further down the page, when it appears at all.”
- **Jako obronę Raptive rekomenduje (stan: maj 2024) jawne blokowanie crawlerów AI w pliku robots.txt.**
  - cytat: „For now, we are recommending that sites explicitly disallow AI crawlers in their robots.txt files.”
- **Ruch odsyłany z chatbotów AI jest marginalny dla bloga kulinarnego: ChatGPT wygenerował dla Inspired Taste ok. 80 kliknięć w ciągu 6 miesięcy, więc blokowanie botów AI (poza Google) prawie nic nie kosztuje w ruchu.**
  - cytat: „We get, I think ChatGPT drove 80 clicks over six months.”
- **Blokowanie crawlerów AI przez robots.txt ma skuteczność rzędu ~30%; skuteczne blokowanie (95%+) botów Perplexity/ChatGPT wymaga płatnego, proaktywnego blokowania na poziomie Cloudflare.**
  - cytat: „they said the accuracy of blocking with robots.text directives is like 30%... you need to pay Cloudflare to proactively block to get up to the 95 plus percent accuracy of blocking like Perplexity and ChatGPT.”
- **AI Overviews generują 'sfrankensteinowane' wersje przepisów podpisane marką twórcy (np. 'Inspired Taste Hummus'), z błędami i skopiowanymi zdjęciami/wideo, wyświetlane nad wynikami organicznymi — twórca określa to jako plagiat na niespotykaną skalę.**
  - cytat: „It's a plagiarism machine that we've never seen at any scale in the publishing industry.”
- **Portal dla dietetyków przewiduje, że AI w niedalekiej przyszłości wyeliminuje układanie standardowych 'papierowych' jadłospisów, co uwiarygadnia popyt na cyfrowe planery posiłków (kierunek monetyzacji dietanaluzie.pl).**
  - cytat: „oznacza w niedalekiej przyszłości kompletną zmianę sposobu pracy z pacjentem oraz zbędność niektórych procesów, jak układanie standardowych „papierowych" jadłospisów”
- **Moda na produkty i przepisy 'high protein' jest w Polsce wszechobecna (do tego stopnia, że dietetycy zaczynają z nią walczyć), co potwierdza wysoki popyt wyszukiwaniowy na treści wysokobiałkowe w 2025/2026.**
  - cytat: „Już nawet teraz czasami dietetycy starają się walczyć z wszechobecną modą na to, by wszystko było „HIGH PROTEIN" albo fortyfikowane”
- **Na 2026 przewidywany jest rosnący popyt konsumencki na tematykę błonnika i zdrowia jelit (więcej pacjentów pytających, jak jeść z korzyścią dla układu pokarmowego), co wskazuje niszę contentową dla serwisu przepisowego.**
  - cytat: „Spodziewajmy się w gabinetach więcej pacjentów, którzy będą chcieli odpowiedzi na to właśnie pytanie – jak odżywiać się z korzyścią dla układu pokarmowego”
- **Fibermaxxing (świadome zwiększanie spożycia błonnika ponad standardowe zalecenia, do 40-50 g dziennie wobec rekomendowanych 25-30 g dla kobiet) jest wskazywany jako jeden z głównych trendów żywieniowych 2026 — potencjalna nisza keywordowa i tematyczna dla przepisów wysokobłonnikowych.**
  - cytat: „Fibermaxxing to świadome zwiększanie ilości błonnika w codziennym jadłospisie, często powyżej standardowych zaleceń. [...] Dla dorosłych kobiet wynoszą one około 25-30 g dziennie, jednak osoby praktykujące ten trend dążą do 40-50 g”
- **Minimalizowanie żywności ultraprzetworzonej (UPF) jest prognozowanym trendem 2026, uzasadnianym tym, że diety bogate w UPF zaburzają sygnały głodu i sprzyjają nadmiernemu spożyciu kalorii — argument za pozycjonowaniem przepisów jako 'nieprzetworzone'.**
  - cytat: „koncentracja na minimalizowaniu ultra-przetworzonych produktów (UPF) [...] diety bogate w taką żywność mogą zaburzać sygnały głodu, sprzyjać nadmiernemu spożyciu kalorii”
- **Personalizacja żywienia oparta na AI (algorytmy przewidujące reakcje metaboliczne na konkretne zestawienia produktów) jest przewidywana jako trend 2026 — wspiera zasadność kierunku monetyzacji dietanaluzie.pl (generator jadłospisów / planer posiłków).**
  - cytat: „algorytmy mogą przewidywać reakcje metaboliczne organizmu na konkretne zestawienia produktów”
- **W 2026 fokus przesuwa się z diet restrykcyjnych na zdrowie metaboliczne i uważne jedzenie (mindful eating: sytość, smak, rytm jedzenia) — sugeruje ramowanie treści raczej wokół zdrowia metabolicznego niż samej redukcji.**
  - cytat: „uważne jedzenie (mindful eating) [...] zwiększenie świadomości przy posiłkach, skupienie się na sytości, smaku, rytmie jedzenia”

### Pozostałe (23)

- **Wydawcy kulinarni określają tryb AI Mode w Google jako bezprecedensowy w skali mechanizm plagiatu treści wydawniczych; inne stosowane formy obrony to publiczny nacisk na Google (posty do menedżerów Google na X) i kontakt z dziennikarzami (m.in. artykuł Bloomberga).**
  - cytat: „It's a plagiarism machine like we've never seen at any scale in the publishing industry”
- **Trend przesuwa się od diet tymczasowych ku długoterminowemu zdrowiu metabolicznemu i mindful eating, co sugeruje popyt na planery/treści o trwałej zmianie nawyków zamiast krótkich diet redukcyjnych.**
  - cytat: „dieta nie powinna być postrzegana jako tymczasowy zestaw zasad”
- **Ogólny wniosek rankingu: najwyżej oceniane są zbilansowane diety, a najniżej restrykcyjne diety eliminacyjne.**
  - cytat: „Najwyżej znalazły się zbilansowane diety, natomiast najniżej - restrykcyjne diety eliminacyjne.”
- **US News & World Report zmienił metodologię rankingu diet: zamiast pojedynczej listy od pierwszego do ostatniego miejsca oceniają diety w 21 kategoriach.**
  - cytat: „rozmontowali podium i zaczęli oceniać diety w 21 kategoriach zamiast ustawiać je od pierwszego do ostatniego miejsca”
- **Dieta śródziemnomorska ma najmocniejsze zaplecze badawcze wśród popularnych diet; w badaniu na 7,5 tys. osób zmniejszyła ryzyko zawału, udaru i zgonu sercowego o ok. 30%.**
  - cytat: „Ma najmocniejsze zaplecze badawcze ze wszystkich popularnych diet: w badaniu na 7,5 tysiąca osób zmniejszyła ryzyko zawału, udaru i zgonu sercowego o około 30%”
- **Różnice w utracie masy ciała między popularnymi dietami po pół roku wynoszą pojedyncze kilogramy, co sugeruje, że przewaga konkretnej diety redukcyjnej w treściach nie wynika z jej skuteczności, lecz z popularności.**
  - cytat: „różnice w chudnięciu między popularnymi dietami po pół roku wynosiły pojedyncze kilogramy”
- **Zdrowie jelit/mikrobiom jest wymieniane jako rosnący obszar zainteresowania w dietetyce (nowe probiotyki i prebiotyki), co sugeruje potencjał contentowy w tej tematyce.**
  - cytat: „nowe probiotyki i prebiotyki, które są coraz bardziej skuteczne”
- **Psychodietetyka (związek diety ze zdrowiem psychicznym) jest wskazywana jako trend na 2026 rok.**
  - cytat: „związku między dietą a zdrowiem psychicznym [...] psychodietetyka”
- **Mojewypieki.com urosło rok do roku o 1,17 mln użytkowników (122,1%) i 8,82 mln odsłon (211,7%), co plasowało je w TOP10 serwisów kulinarnych.**
  - cytat: „Mojewypieki.com: "+1.17 million users (122.1%), 8.82 million pageviews (211.7%)"”
- **Czołówkę polskich serwisów kulinarnych w maju 2020 tworzyły obok liderów także Smaker.pl (Interia, 3,3 mln użytkowników), Przyslijprzepis.pl (Burda, 2,4 mln, spadek o 5,8%) i Smakosze.pl (Iberion, 2,15 mln).**
  - cytat: „Smaker.pl (Interia Group) - 3.3 million users... Przyslijprzepis.pl lost 149,500 users (5.8%)”
- **W Polsce procedowany jest projekt 'Lex Szarlatan' mający ograniczyć pseudomedycynę w przestrzeni publicznej, a zawód dietetyka zmierza ku regulacji — potencjalne ryzyko/wymóg compliance dla treści dietetycznych publikowanych online.**
  - cytat: „O wiele dalszy stopień zaawansowania ma zaś inny, bardziej nośny medialnie projekt 'Lex Szarlatan', który ma ukrócić tak szkodliwą w przestrzeni publicznej pseudomedycynę.”
- **Artykuł kompiluje analizy portalu Food Fakty oraz raporty Innova Market Insights i Institute of Food Technologists, ale nie podaje żadnych liczb, odsetków ani danych specyficznych dla polskiego rynku — jego wartość dla analizy popytu w Polsce jest więc jakościowa, nie ilościowa.**
  - cytat: „Zestawiając analizy portalu Food Fakty oraz raporty renomowanych instytucji”
- **Amerykanie przygotowują średnio 11 posiłków tygodniowo w domu (52% wszystkich posiłków) i próbują średnio dwóch nowych przepisów tygodniowo, co wskazuje na trwały popyt na treści przepisowe.**
  - cytat: „Americans prepare average of 11 meals weekly (52% of all meals) ... Average of two new recipes attempted weekly”
- **W kategorii wielotematycznych serwisów kobiecych (potencjalny kanał dystrybucji treści dietetycznych) liderem jest WP z 5 944 266 RU i 20,00% zasięgu, a TOP10 domykają Wysokie Obcasy z 1 535 760 RU.**
  - cytat: „Wielotematyczne serwisy kobiece, lipiec 2025: 1. WP 5 944 266, 20,00%; 2. INTERIA 4 753 728; 3. ONET 4 492 098; [...] 10. WYSOKIE OBCASY 1 535 760, 5,17% (tabela z grafiki rankingu)”
- **Część serwisów traciła ruch miesiąc do miesiąca: Przyslijprzepis.pl -627,9 tys. użytkowników (-15,9%), Haps.pl -186,5 tys. (-5,1%).**
  - cytat: „Przyślijprzepis.pl: Lost 627,900 users (-15.9%); Haps.pl: Lost 186,500 users (-5.1%)”
- **Ranking opiera się na danych panelowych badania Gemius/PBI za maj 2020 r., opracowanych przez Wirtualnemedia.pl — dane są więc sprzed ery AI Overviews i sprzed skoku popularności aniagotuje.pl na pozycję lidera, mają wartość wyłącznie historyczną dla analizy rynku 2025-2026.**
  - cytat: „wynika z danych z badania Gemius/PBI opracowanych przez Wirtualnemedia.pl.”
- **Rankingi Mediapanel liczone są jako łączny zasięg serwisów www i aplikacji mobilnych w ujęciu realnych użytkowników, więc pozycje wydawców zdrowotnych/kulinarnych w tych zestawieniach obejmują także ruch z aplikacji (istotne np. dla Fitatu, które ma dużą bazę appkową).**
  - cytat: „Rankings use 'łączny zasięg serwisów www i aplikacji mobilnych' (combined reach of websites and mobile applications); 'Użytkownicy' (real users) = actual site/app visitors”
- **Oryginalne badania i dane są najskuteczniejszym typem linkable asset, a do ich stworzenia wystarczy analiza własnych danych lub mała ankieta — dla serwisu z przepisami mogłyby to być np. dane o popularności diet z własnego ruchu.**
  - cytat: „To absolutny „król" link buildingu. Nie musisz być Instytutem Gallupa.”
- **Twórcy internetowi linkują do źródeł z trzech powodów: by uwiarygodnić tezy danymi, by dać czytelnikom narzędzie rozwiązujące problem oraz by budować własny autorytet — strategia linkable assets polega na dawaniu powodu do linkowania zamiast proszenia o linki.**
  - cytat: „Zamiast prosić o linki, dajesz powód, by je dostać”
- **Infografiki są opisywane jako jeden z najsilniejszych magnesów na linki.**
  - cytat: „jeden z najsilniejszych magnesów na linki”
- **Według artykułu 70% czołowych stron wspieranych link baitingiem utrzymuje wysokie pozycje ponad rok (statystyka bez podanego źródła ani metodologii — niska wiarygodność).**
  - cytat: „aż 70% czołowych stron wspieranych link baitem utrzymuje wysokie pozycje powyżej roku”
- **Darmowe jadłospisy NFZ są kierowane do całych rodzin, a portal zawiera też sekcję żywienia niemowląt/małych dzieci (dieta malucha), poszerzając zasięg państwowej oferty poza osoby na redukcji.**
  - cytat: „Skorzystaj z darmowych jadłospisów dla siebie i całej rodziny!”
- **Dietetyka w mediach społecznościowych (TikTok/Instagram) polaryzuje się, a treści evidence-based przegrywają zasięgowo, co ma znaczenie dla strategii kanału TikTok→przepis serwisu.**
  - cytat: „W świecie mediów społecznościowych evidence-based nutrition już nie jest królem”
