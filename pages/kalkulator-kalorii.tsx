import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import Container from '../components/container'
import Layout from '../components/layout'
import NewsletterSignup from '../components/newsletter-signup'
import CalculatorLinks from '../components/calculator-links'
import PostTitle from '../components/post-title'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE, SITE_URL } from '../lib/constants'
import { ACTIVITY_LEVELS, mifflinBmr, tdee, validBody, type Sex } from '../lib/nutrition'

// Own BMR/CPM calculator (Mifflin-St Jeor) - replaces the old WP plugin page
// at the same URL, same title/description as the live site.

const FAQ = [
  {
    q: 'Czym różni się BMR od CPM?',
    a: 'BMR (podstawowa przemiana materii) to kalorie, które organizm zużywa w spoczynku na podtrzymanie funkcji życiowych. CPM (całkowita przemiana materii) to BMR pomnożone przez współczynnik aktywności - czyli ile realnie potrzebujesz przy swoim trybie życia.',
  },
  {
    q: 'Ile kalorii jeść, żeby schudnąć?',
    a: 'Najczęściej celuje się w deficyt 10–20% względem CPM. Dokładne wartości i tempo chudnięcia policzysz w kalkulatorze deficytu kalorycznego.',
  },
  {
    q: 'Jak dokładny jest wzór Mifflina-St Jeor?',
    a: 'To jeden z najdokładniejszych wzorów szacunkowych dla populacji ogólnej, ale wynik jest orientacyjny - realne zapotrzebowanie zależy też od masy mięśniowej, genetyki i stanu zdrowia.',
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

export default function CalorieCalculator() {
  const [sex, setSex] = useState<Sex>('k')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [activity, setActivity] = useState(2)

  const a = parseInt(age, 10)
  const w = parseFloat(weight.replace(',', '.'))
  const h = parseFloat(height.replace(',', '.'))
  const valid = validBody(a, w, h)

  const bmr = valid ? mifflinBmr(sex, w, h, a) : null
  const cpm = bmr ? tdee(bmr, ACTIVITY_LEVELS[activity].factor) : null

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400'

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Kalkulator kalorii (BMR i CPM) - ${SITE_TITLE}`}</title>
        <meta name="description" content="Oblicz podstawową przemianę materii (BMR) i całkowite dzienne zapotrzebowanie kaloryczne (CPM) wzorem Mifflina-St Jeor. Za darmo, bez rejestracji." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulator-kalorii/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulator kalorii (BMR i CPM) - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulator-kalorii/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Container>
        <article className="max-w-xl mx-auto mb-24">
          <PostTitle>Kalkulator kalorii</PostTitle>
          <p className="text-gray-600 mb-8">
            Oblicz swoją podstawową przemianę materii (BMR) i całkowite dzienne
            zapotrzebowanie kaloryczne (CPM) według wzoru Mifflina-St Jeor.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="block">
              <span className="text-sm text-gray-700">Płeć</span>
              <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={inputCls}>
                <option value="k">Kobieta</option>
                <option value="m">Mężczyzna</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Wiek (lata)</span>
              <input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={inputCls} placeholder="np. 30" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Waga (kg)</span>
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} placeholder="np. 65" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Wzrost (cm)</span>
              <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} placeholder="np. 170" />
            </label>
          </div>

          <label className="block mb-8">
            <span className="text-sm text-gray-700">Aktywność fizyczna</span>
            <select value={activity} onChange={(e) => setActivity(parseInt(e.target.value, 10))} className={inputCls}>
              {ACTIVITY_LEVELS.map((lvl, i) => (
                <option key={i} value={i}>{lvl.label}</option>
              ))}
            </select>
          </label>

          {bmr && cpm ? (
            <div className="rounded-xl border border-gray-200 shadow-small p-6 text-center">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">BMR</div>
                  <div className="text-3xl font-bold">{bmr} kcal</div>
                  <div className="text-xs text-gray-400 mt-1">podstawowa przemiana materii</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">CPM</div>
                  <div className="text-3xl font-bold">{cpm} kcal</div>
                  <div className="text-xs text-gray-400 mt-1">całkowite zapotrzebowanie</div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-6">
                Chcesz schudnąć? Celuj w ok. {Math.round(cpm * 0.85)} kcal
                (deficyt ~15%). Budujesz masę? Ok. {Math.round(cpm * 1.1)} kcal.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                <Link href="/kalkulator-deficytu-kalorycznego/" className="underline">Policz deficyt dokładnie</Link>
                {' · '}
                <Link href="/kalkulator-makro/" className="underline">rozłóż na makro</Link>
              </p>
              <div className="mt-6 text-left">
                <NewsletterSignup source="kalkulator" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Uzupełnij dane, a wynik pojawi się automatycznie.
            </p>
          )}

          <h2 className="font-bold text-lg mt-14 mb-4">Częste pytania</h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <CalculatorLinks current="kalkulator-kalorii" />
        </article>
      </Container>
    </Layout>
  )
}
