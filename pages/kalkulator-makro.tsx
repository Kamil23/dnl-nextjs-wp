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
import {
  ACTIVITY_LEVELS,
  mifflinBmr,
  tdee,
  validBody,
  macroSplit,
  type Sex,
  type MacroGoal,
} from '../lib/nutrition'

// Macro calculator — takes body metrics + goal, derives calories, splits into
// protein / fat / carbs. Protein anchored to bodyweight (matters for the
// high-protein & GLP-1 audience the kolekcje pages already target).

const GOALS: { key: MacroGoal; label: string; factor: number }[] = [
  { key: 'redukcja', label: 'Redukcja (chudnięcie)', factor: 0.8 },
  { key: 'utrzymanie', label: 'Utrzymanie wagi', factor: 1 },
  { key: 'masa', label: 'Budowa masy', factor: 1.1 },
]

const FAQ = [
  {
    q: 'Ile białka dziennie jeść?',
    a: 'Przy aktywnym trybie życia i redukcji zwykle celuje się w 1,6–2,2 g białka na kilogram masy ciała. Nasz kalkulator przyjmuje 2,0 g/kg na redukcji, 1,8 g/kg na masie i 1,6 g/kg przy utrzymaniu.',
  },
  {
    q: 'Jak rozłożyć makroskładniki?',
    a: 'Najpierw ustalamy białko (na podstawie wagi), potem tłuszcze (25–30% kalorii), a węglowodany dopełniają resztę energii. 1 g białka i węglowodanów to 4 kcal, 1 g tłuszczu to 9 kcal.',
  },
  {
    q: 'Czy makro są ważniejsze niż kalorie?',
    a: 'O zmianie masy ciała decyduje bilans kaloryczny. Makroskładniki wpływają na sytość, skład ciała i samopoczucie — dlatego warto pilnować obu naraz.',
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

export default function MacroCalculator() {
  const [sex, setSex] = useState<Sex>('k')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [activity, setActivity] = useState(2)
  const [goalKey, setGoalKey] = useState<MacroGoal>('redukcja')

  const a = parseInt(age, 10)
  const w = parseFloat(weight.replace(',', '.'))
  const h = parseFloat(height.replace(',', '.'))
  const valid = validBody(a, w, h)

  const goal = GOALS.find((g) => g.key === goalKey)!
  const bmr = valid ? mifflinBmr(sex, w, h, a) : null
  const cpm = bmr ? tdee(bmr, ACTIVITY_LEVELS[activity].factor) : null
  const kcal = cpm ? Math.round(cpm * goal.factor) : null
  const macros = kcal && valid ? macroSplit(kcal, goalKey, w) : null

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400'

  const MACRO_ROWS = macros
    ? [
        { label: 'Białko', grams: macros.protein, kcal: macros.protein * 4, color: 'text-emerald-600' },
        { label: 'Tłuszcze', grams: macros.fat, kcal: macros.fat * 9, color: 'text-amber-600' },
        { label: 'Węglowodany', grams: macros.carbs, kcal: macros.carbs * 4, color: 'text-sky-600' },
      ]
    : []

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Kalkulator makroskładników - ${SITE_TITLE}`}</title>
        <meta name="description" content="Policz zapotrzebowanie na białko, tłuszcze i węglowodany. Kalkulator makro dobiera makroskładniki pod Twój cel: redukcję, utrzymanie lub budowę masy." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulator-makro/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulator makroskładników - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulator-makro/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Container>
        <article className="max-w-xl mx-auto mb-24">
          <PostTitle>Kalkulator makroskładników</PostTitle>
          <p className="text-gray-600 mb-8">
            Ustal, ile białka, tłuszczu i węglowodanów jeść dziennie pod swój cel.
            Kalkulator liczy zapotrzebowanie kaloryczne i rozkłada je na makro.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <label className="block">
              <span className="text-sm text-gray-700">Aktywność fizyczna</span>
              <select value={activity} onChange={(e) => setActivity(parseInt(e.target.value, 10))} className={inputCls}>
                {ACTIVITY_LEVELS.map((lvl, i) => (
                  <option key={i} value={i}>{lvl.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Cel</span>
              <select value={goalKey} onChange={(e) => setGoalKey(e.target.value as MacroGoal)} className={inputCls}>
                {GOALS.map((g) => (
                  <option key={g.key} value={g.key}>{g.label}</option>
                ))}
              </select>
            </label>
          </div>

          {macros && kcal ? (
            <div className="rounded-xl border border-gray-200 shadow-small p-6">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500">Cel kaloryczny</div>
                <div className="text-3xl font-bold">{kcal} kcal / dzień</div>
              </div>
              <div className="space-y-3">
                {MACRO_ROWS.map((m) => (
                  <div key={m.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <div className={`font-semibold ${m.color}`}>{m.label}</div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{m.grams} g</div>
                      <div className="text-xs text-gray-400">{Math.round(m.kcal)} kcal</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-5 text-center">
                Szukasz przepisów pod te makro?{' '}
                <Link href="/kolekcje/wysokie-bialko/" className="underline">Wysokobiałkowe przepisy</Link>.
              </p>
              <div className="mt-5">
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

          <CalculatorLinks current="kalkulator-makro" />
        </article>
      </Container>
    </Layout>
  )
}
