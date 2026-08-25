import Head from 'next/head'
import { useState } from 'react'
import Container from '../components/container'
import Layout from '../components/layout'
import NewsletterSignup from '../components/newsletter-signup'
import CalculatorLinks from '../components/calculator-links'
import PostTitle from '../components/post-title'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE, SITE_URL } from '../lib/constants'
import { bmi, bmiBand, healthyWeightRange, BMI_BANDS } from '../lib/nutrition'

// BMI is one of the highest-volume health queries in Polish; standalone page
// with its own canonical + FAQ schema so it can rank (and get cited) on its own.

const FAQ = [
  {
    q: 'Jak obliczyć BMI?',
    a: 'BMI = masa ciała (kg) podzielona przez wzrost (m) do kwadratu. Przykład: przy 65 kg i 170 cm to 65 / (1,7 × 1,7) = 22,5.',
  },
  {
    q: 'Jakie BMI jest prawidłowe?',
    a: 'Za wagę prawidłową uznaje się BMI od 18,5 do 24,9. Poniżej 18,5 to niedowaga, 25–29,9 nadwaga, a 30 i więcej otyłość.',
  },
  {
    q: 'Czy BMI jest wiarygodne?',
    a: 'BMI to szybki wskaźnik przesiewowy, ale nie odróżnia mięśni od tłuszczu ani nie uwzględnia rozkładu tkanki. U osób bardzo umięśnionych lub w ciąży bywa mylące - traktuj go orientacyjnie.',
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
  niedowaga: 'text-sky-600',
  norma: 'text-emerald-600',
  nadwaga: 'text-amber-600',
  otylosc: 'text-red-600',
}

export default function BmiCalculator() {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')

  const w = parseFloat(weight.replace(',', '.'))
  const h = parseFloat(height.replace(',', '.'))
  const valid = w > 20 && w < 400 && h > 100 && h < 250

  const value = valid ? bmi(w, h) : null
  const band = value != null ? bmiBand(value) : null
  const range = valid ? healthyWeightRange(h) : null

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400'

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Kalkulator BMI - ${SITE_TITLE}`}</title>
        <meta name="description" content="Oblicz BMI (wskaźnik masy ciała) online. Podaj wagę i wzrost, a zobaczysz swój wynik, kategorię i zakres wagi prawidłowej. Za darmo, bez rejestracji." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulator-bmi/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulator BMI - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulator-bmi/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </Head>
      <Container>
        <article className="max-w-xl mx-auto mb-24">
          <PostTitle>Kalkulator BMI</PostTitle>
          <p className="text-gray-600 mb-8">
            BMI (wskaźnik masy ciała) to szybki sposób sprawdzenia, czy Twoja waga
            mieści się w normie dla Twojego wzrostu. Podaj dwie wartości, a wynik
            policzy się od razu.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <label className="block">
              <span className="text-sm text-gray-700">Waga (kg)</span>
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} placeholder="np. 65" />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Wzrost (cm)</span>
              <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} placeholder="np. 170" />
            </label>
          </div>

          {value != null && band && range ? (
            <div className="rounded-xl border border-gray-200 shadow-small p-6 text-center">
              <div className="text-sm text-gray-500">Twoje BMI</div>
              <div className="text-4xl font-bold">{value.toFixed(1)}</div>
              <div className={`mt-1 font-semibold ${BAND_COLORS[band.key]}`}>{band.label}</div>
              <p className="text-sm text-gray-600 mt-4">
                Waga prawidłowa dla wzrostu {Math.round(h)} cm to ok.{' '}
                <strong>{range[0]}–{range[1]} kg</strong> (BMI 18,5–24,9).
              </p>
              <div className="mt-6 text-left">
                <NewsletterSignup source="kalkulator" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Uzupełnij wagę i wzrost, a wynik pojawi się automatycznie.
            </p>
          )}

          <h2 className="font-bold text-lg mt-14 mb-4">Zakresy BMI</h2>
          <div className="rounded-xl border border-gray-200 shadow-small overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Kategoria</th>
                  <th className="px-4 py-3 font-medium text-right">BMI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {BMI_BANDS.map((b) => (
                  <tr key={b.key}>
                    <td className={`px-4 py-3 font-medium ${BAND_COLORS[b.key]}`}>{b.label}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {b.min === 0 ? `< ${b.max}` : b.max === Infinity ? `≥ ${b.min}` : `${b.min} – ${b.max - 0.1}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-bold text-lg mt-12 mb-4">Częste pytania</h2>
          <div className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <CalculatorLinks current="kalkulator-bmi" />
        </article>
      </Container>
    </Layout>
  )
}
