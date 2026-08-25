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
  deficitTarget,
  weeklyLoss,
  DEFICIT_TIERS,
  type Sex,
} from '../lib/nutrition'

// Dedicated calorie-deficit page — "kalkulator deficytu kalorycznego" is a
// distinct high-volume query from "kalkulator kalorii", worth its own URL.

const FAQ = [
  {
    q: 'Jaki deficyt kaloryczny jest bezpieczny?',
    a: 'Najczęściej zaleca się deficyt 10–20% względem całkowitego zapotrzebowania (CPM). Głębszy deficyt daje szybsze efekty, ale zwiększa ryzyko utraty mięśni, spadku energii i efektu jo-jo.',
  },
  {
    q: 'Ile można schudnąć w tydzień?',
    a: 'Zdrowe tempo to zwykle 0,3–0,7 kg tygodniowo. 1 kg tkanki tłuszczowej to około 7700 kcal, więc deficyt 500 kcal dziennie daje w przybliżeniu 0,45 kg na tydzień.',
  },
  {
    q: 'Czy można jeść za mało?',
    a: 'Tak. Zbyt niska podaż (poniżej ok. 1200 kcal u kobiet i 1500 u mężczyzn) utrudnia dostarczenie składników odżywczych i bywa niemożliwa do utrzymania. Nasz kalkulator nie schodzi poniżej tych wartości.',
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

function formatKgWeek(kg: number) {
  return `${kg.toFixed(2).replace('.', ',')} kg/tydz.`
}

export default function DeficitCalculator() {
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
        <title>{`Kalkulator deficytu kalorycznego - ${SITE_TITLE}`}</title>
        <meta name="description" content="Policz, ile kalorii jeść, żeby schudnąć. Kalkulator deficytu kalorycznego pokazuje docelowe kalorie i prognozę tempa chudnięcia dla lekkiego, umiarkowanego i agresywnego deficytu." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulator-deficytu-kalorycznego/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulator deficytu kalorycznego - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulator-deficytu-kalorycznego/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Container>
        <article className="max-w-xl mx-auto mb-24">
          <PostTitle>Kalkulator deficytu kalorycznego</PostTitle>
          <p className="text-gray-600 mb-8">
            Żeby chudnąć, trzeba jeść mniej, niż wynosi dzienne zapotrzebowanie.
            Policz swój deficyt i zobacz, ile kalorii jeść oraz jak szybko
            zejdzie waga przy różnym tempie.
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

          {cpm ? (
            <div className="rounded-xl border border-gray-200 shadow-small p-6">
              <div className="text-center mb-6">
                <div className="text-sm text-gray-500">Twoje zapotrzebowanie (CPM)</div>
                <div className="text-3xl font-bold">{cpm} kcal</div>
                <div className="text-xs text-gray-400 mt-1">tyle jesz, żeby utrzymać wagę</div>
              </div>
              <div className="space-y-3">
                {DEFICIT_TIERS.map((t) => {
                  const target = deficitTarget(cpm, t.pct, sex)
                  const realDeficit = cpm - target.kcal
                  return (
                    <div key={t.key} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                      <div>
                        <div className="font-semibold text-sm">{t.label}</div>
                        <div className="text-xs text-gray-500">
                          ~{formatKgWeek(weeklyLoss(realDeficit))}
                          {target.floored && ' · ograniczono do minimum'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{target.kcal} kcal</div>
                        <div className="text-xs text-gray-400">−{realDeficit} kcal/dzień</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-sm text-gray-500 mt-5 text-center">
                Chcesz rozłożyć te kalorie na białko, tłuszcze i węgle?{' '}
                <Link href="/kalkulator-makro/" className="underline">Kalkulator makro</Link>.
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

          <CalculatorLinks current="kalkulator-deficytu-kalorycznego" />
        </article>
      </Container>
    </Layout>
  )
}
