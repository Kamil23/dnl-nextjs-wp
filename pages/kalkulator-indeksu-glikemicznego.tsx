import Head from 'next/head'
import { useState } from 'react'
import Container from '../components/container'
import Layout from '../components/layout'
import NewsletterSignup from '../components/newsletter-signup'
import CalculatorLinks from '../components/calculator-links'
import PostTitle from '../components/post-title'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE, SITE_URL } from '../lib/constants'
import { GI_PRODUCTS, glycemicLoad, glBand, giBand } from '../lib/nutrition'

// Glycemic-load calculator. GI alone ignores portion size; GL = GI × carbs/100
// answers "how much will this portion actually spike me" — the number that
// matters for the insulin-resistance audience the research flagged as a gap.

const FAQ = [
  {
    q: 'Czym różni się indeks glikemiczny od ładunku glikemicznego?',
    a: 'Indeks glikemiczny (IG) mówi, jak szybko dany produkt podnosi cukier, ale nie uwzględnia porcji. Ładunek glikemiczny (ŁG) łączy IG z ilością węglowodanów w Twojej porcji, więc lepiej oddaje realny wpływ posiłku na glukozę.',
  },
  {
    q: 'Jak obliczyć ładunek glikemiczny?',
    a: 'ŁG = IG × węglowodany przyswajalne (g) ÷ 100. Przykład: 150 g banana (IG 51, ~23 g węgli/100 g) to 51 × 34,5 ÷ 100 ≈ 17,6 — ładunek średni.',
  },
  {
    q: 'Jakie wartości ładunku glikemicznego są niskie?',
    a: 'Dla pojedynczej porcji: ŁG poniżej 10 to niski, 10–19 średni, 20 i więcej wysoki. Przy insulinooporności zwykle celuje się w posiłki o niskim i średnim ładunku.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org/',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const BAND_COLORS: Record<string, string> = {
  niski: 'text-emerald-600',
  sredni: 'text-amber-600',
  wysoki: 'text-red-600',
}

export default function GlycemicCalculator() {
  const [productSlug, setProductSlug] = useState(GI_PRODUCTS[0].slug)
  const [portion, setPortion] = useState('150')

  const product = GI_PRODUCTS.find((p) => p.slug === productSlug)!
  const grams = parseFloat(portion.replace(',', '.'))
  const valid = grams > 0 && grams < 2000

  const carbsInPortion = valid ? (product.carbsPer100g * grams) / 100 : null
  const gl = carbsInPortion != null ? glycemicLoad(product.gi, carbsInPortion) : null
  const band = gl != null ? glBand(gl) : null

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400'

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Kalkulator ładunku glikemicznego (IG) - ${SITE_TITLE}`}</title>
        <meta name="description" content="Policz ładunek glikemiczny porcji na podstawie indeksu glikemicznego i ilości węglowodanów. Przydatne przy insulinooporności i cukrzycy. Tabela IG popularnych produktów." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulator-indeksu-glikemicznego/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulator ładunku glikemicznego (IG) - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulator-indeksu-glikemicznego/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <PostTitle>Kalkulator ładunku glikemicznego</PostTitle>
          <p className="text-gray-600 mb-8">
            Indeks glikemiczny (IG) nie uwzględnia wielkości porcji — dlatego
            liczy się <strong>ładunek glikemiczny</strong> (ŁG). Wybierz produkt
            i podaj ile go zjadasz, a policzymy realny wpływ na poziom cukru.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <label className="block">
              <span className="text-sm text-gray-700">Produkt</span>
              <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className={inputCls}>
                {GI_PRODUCTS.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name} (IG {p.gi})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Porcja (g)</span>
              <input inputMode="decimal" value={portion} onChange={(e) => setPortion(e.target.value)} className={inputCls} placeholder="np. 150" />
            </label>
          </div>

          {gl != null && band && carbsInPortion != null ? (
            <div className="rounded-xl border border-gray-200 shadow-small p-6 text-center">
              <div className="text-sm text-gray-500">Ładunek glikemiczny porcji</div>
              <div className="text-4xl font-bold">{gl.toFixed(1)}</div>
              <div className={`mt-1 font-semibold ${BAND_COLORS[band.key]}`}>ładunek {band.label}</div>
              <p className="text-sm text-gray-600 mt-4">
                Porcja {Math.round(grams)} g zawiera ok. {carbsInPortion.toFixed(0)} g węglowodanów.
                Indeks glikemiczny produktu to {product.gi} ({giBand(product.gi).label}).
              </p>
              <div className="mt-6 text-left">
                <NewsletterSignup source="kalkulator" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Podaj poprawną wielkość porcji, a wynik pojawi się automatycznie.
            </p>
          )}

          <h2 className="font-bold text-lg mt-14 mb-4">Indeks glikemiczny popularnych produktów</h2>
          <div className="rounded-xl border border-gray-200 shadow-small overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Produkt</th>
                    <th className="px-4 py-3 font-medium text-right">IG</th>
                    <th className="px-4 py-3 font-medium text-right">Węgle / 100 g</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {GI_PRODUCTS.map((p) => (
                    <tr key={p.slug}>
                      <td className="px-4 py-3">{p.name}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${BAND_COLORS[giBand(p.gi).key]}`}>{p.gi}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.carbsPer100g} g</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Wartości orientacyjne — IG zmienia się z dojrzałością, obróbką i stopniem ugotowania produktu.
          </p>

          <h2 className="font-bold text-lg mt-12 mb-4">Częste pytania</h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <CalculatorLinks current="kalkulator-indeksu-glikemicznego" />
        </article>
      </Container>
    </Layout>
  )
}
