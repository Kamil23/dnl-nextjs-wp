import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Container from "../components/container";
import Layout from "../components/layout";
import PostTitle from "../components/post-title";
import RecipeTile, { type RecipeTileData } from "../components/recipe-tile";
import { MENU_EDGES } from "../lib/menu";
import { SITE_TITLE, SITE_URL } from "../lib/constants";

// „Z lodówki" - wpisujesz składniki, które masz pod ręką, a my pokazujemy
// przepisy, które pokrywają ich najwięcej. Strona w pełni kliencka (statyczna):
// każda zmiana chipów odpytuje /api/z-lodowki/ z debouncem ~300 ms.

const SUGESTIE = ["jajka", "twaróg", "kurczak", "cukinia", "banan", "płatki owsiane", "jogurt", "ser"];
const MAX_CHIPS = 8;
const MIN_LEN = 2;
const MAX_LEN = 40;
const DEBOUNCE_MS = 300;

type Hit = RecipeTileData & { matched: string[]; matchedCount: number; total: number };

const FAQ = [
  {
    q: "Co ugotować z tego, co mam w lodówce?",
    a: "Wpisz składniki, które masz (np. kurczak, ryż, brokuł), a pokażemy przepisy z naszej bazy, które wykorzystują ich najwięcej. Najwyżej trafiają te, które pokrywają wszystkie podane składniki, a przy remisie wygrywają lepiej oceniane i lżejsze kalorycznie.",
  },
  {
    q: "Jak działa wyszukiwanie po składnikach?",
    a: "Każdy składnik przeszukujemy osobno w bazie przepisów, z tolerancją literówek. Wyniki łączymy: im więcej Twoich składników występuje w przepisie, tym wyżej się pojawia. Na każdej karcie widzisz oznaczenie, ile składników pasuje.",
  },
  {
    q: "Czy muszę mieć wszystkie składniki?",
    a: 'Nie. Pokazujemy też przepisy dopasowane częściowo, z oznaczeniem „pasuje X z Y". Brakujący dodatek zwykle łatwo zastąpić tym, co masz w kuchni, albo po prostu pominąć.',
  },
];

const faqSchema = {
  "@context": "https://schema.org/",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};
const breadcrumbSchema = {
  "@context": "https://schema.org/",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: SITE_TITLE, item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: "Z lodówki", item: `${SITE_URL}/z-lodowki/` },
  ],
};

export default function ZLodowki() {
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  // czy dla bieżącego zestawu chipów przyszła już odpowiedź (steruje pustym stanem)
  const [searched, setSearched] = useState(false);
  // znacznik żądania: późniejszy zestaw chipów unieważnia wcześniejsze odpowiedzi
  const seq = useRef(0);

  function addChips(values: string[]) {
    const next = [...chips];
    for (const raw of values) {
      const v = raw.trim();
      if (v.length < MIN_LEN || v.length > MAX_LEN) continue;
      if (next.length >= MAX_CHIPS) break;
      if (next.some((c) => c.toLowerCase() === v.toLowerCase())) continue;
      next.push(v);
    }
    if (next.length === chips.length) return;
    setChips(next);
    (window as any).gtag?.("event", "ingredient_search", { count: next.length });
  }

  function removeChip(chip: string) {
    setChips(chips.filter((c) => c !== chip));
  }

  // Przecinek w polu od razu zamienia wpisany fragment na chip(y)
  function onInputChange(value: string) {
    if (!value.includes(",")) {
      setInput(value);
      return;
    }
    const parts = value.split(",");
    const rest = parts.pop() ?? "";
    addChips(parts);
    setInput(rest);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) {
        addChips([input]);
        setInput("");
      }
    }
  }

  useEffect(() => {
    if (chips.length === 0) {
      seq.current++;
      setHits([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/z-lodowki/?skladniki=${encodeURIComponent(chips.join(","))}`)
        .then((r) => r.json())
        .then((data) => {
          if (seq.current !== id) return;
          setHits(Array.isArray(data?.hits) ? data.hits : []);
          setSearched(true);
        })
        .catch(() => {
          if (seq.current !== id) return;
          setHits([]);
          setSearched(true);
        })
        .finally(() => {
          if (seq.current === id) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [chips]);

  const dostepneSugestie = SUGESTIE.filter(
    (s) => !chips.some((c) => c.toLowerCase() === s.toLowerCase())
  );

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Co ugotować z tego, co mam? Z lodówki - ${SITE_TITLE}`}</title>
        <meta
          name="description"
          content="Wpisz składniki, które masz w lodówce (np. kurczak, ryż, brokuł), a pokażemy przepisy, które je wykorzystują: z kaloriami, białkiem i czasem przygotowania. Za darmo."
        />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <link rel="canonical" href={`${SITE_URL}/z-lodowki/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Co ugotować z tego, co mam? Z lodówki - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/z-lodowki/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </Head>
      <Container>
        <div className="max-w-2xl mx-auto text-center">
          <PostTitle>Z lodówki 🧊</PostTitle>
          <p className="text-gray-600 mb-6">
            Wpisz, co masz pod ręką, a pokażemy, co z tego ugotujesz. Im więcej Twoich
            składników pasuje do przepisu, tym wyżej trafia on na listę: z kaloriami,
            białkiem i czasem przygotowania na karcie.
          </p>

          {chips.length > 0 && (
            <div className="mb-3 flex flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => removeChip(c)}
                  aria-label={`Usuń składnik ${c}`}
                  className="rounded-full bg-amber-500 border border-amber-500 text-white px-3.5 py-1.5 text-sm hover:bg-amber-600 hover:border-amber-600 transition"
                >
                  {c} <span aria-hidden="true">✕</span>
                </button>
              ))}
            </div>
          )}

          <input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Wpisz składnik, np. kurczak, i naciśnij Enter"
            className="w-full sm:w-[28rem] border border-gray-300 rounded-full px-5 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <p className="text-xs text-gray-400 mt-2">
            Enter lub przecinek dodaje składnik. Możesz podać do {MAX_CHIPS} składników.
          </p>

          {dostepneSugestie.length > 0 && chips.length < MAX_CHIPS && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">Na przykład:</span>
              {dostepneSugestie.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addChips([s])}
                  className="rounded-full bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 hover:border-amber-300 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 mb-16">
          {chips.length > 0 && (
            <p className={`text-sm mb-4 text-center ${loading ? "text-gray-300" : "text-gray-400"}`}>
              {loading ? "Szukam…" : searched ? `Znaleziono: ${hits.length}` : ""}
            </p>
          )}

          {hits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {hits.map((h) => (
                <div key={h.uri} className="relative">
                  <span
                    title={`Pasuje: ${h.matched.join(", ")}`}
                    className={`pointer-events-none absolute left-2 top-2 z-10 rounded-full px-2.5 py-1 text-xs font-semibold shadow-bottomSmall ${
                      h.matchedCount === h.total
                        ? "bg-emerald-600 text-white"
                        : "bg-white/90 backdrop-blur text-gray-800"
                    }`}
                  >
                    pasuje {h.matchedCount} z {h.total}
                  </span>
                  <RecipeTile recipe={h} />
                </div>
              ))}
            </div>
          ) : chips.length > 0 && searched && !loading ? (
            <p className="text-center text-gray-500">
              Nic nie znalazłam. Spróbuj mniejszej liczby składników albo prostszych nazw.
            </p>
          ) : null}
        </div>

        <div className="max-w-2xl mx-auto mb-24">
          <h2 className="font-bold text-lg mb-4">Częste pytania</h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400 mt-10">
            Wolisz szukać po nazwie? Skorzystaj z{" "}
            <Link href="/szukaj/" className="underline underline-offset-2">
              wyszukiwarki przepisów
            </Link>{" "}
            albo{" "}
            <Link href="/co-na-obiad/" className="underline underline-offset-2">
              wylosuj obiad
            </Link>
            .
          </p>
        </div>
      </Container>
    </Layout>
  );
}
