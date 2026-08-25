import Head from 'next/head'
import Link from 'next/link'
import { GetStaticPaths, GetStaticProps } from 'next'
import Container from '../../components/container'
import Layout from '../../components/layout'
import NewsletterSignup from '../../components/newsletter-signup'
import PostTitle from '../../components/post-title'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE, SITE_URL } from '../../lib/constants'
import {
  INGREDIENTS,
  GROUP_LABELS,
  MEASURES,
  getIngredientBySlug,
  gramsToMeasure,
  measureForm,
  formatMeasureValue,
  formatGrams,
  type Ingredient,
  type MeasureKey,
} from '../../lib/measures'

// Programmatic landingi konwertera: jeden statyczny adres na składnik,
// celuje w long-tail "szklanka mąki ile gramów", "łyżka kakao ile gramów".
// Treść generowana z lib/measures + FAQPage JSON-LD (citaty w AI search).

const MEASURE_KEYS: MeasureKey[] = ['szklanka', 'lyzka', 'lyzeczka']

const COMMON_GRAMS = [25, 50, 100, 150, 200, 250, 300, 400, 500]

function hasMeasure(ing: Ingredient, m: MeasureKey) {
  return ing.grams[m] != null
}

export default function IngredientConverter({ ing, similar }: { ing: Ingredient; similar: Ingredient[] }) {
  const canonical = `${SITE_URL}/konwerter/${ing.slug}/`
  const applicable = MEASURE_KEYS.filter((m) => hasMeasure(ing, m))
  const reverseRows = COMMON_GRAMS.filter(
    (g) => ing.grams.lyzeczka == null || g >= (ing.grams.lyzeczka as number) * 3
  )

  const faq =
    ing.grams.szklanka != null
      ? [
          {
            q: `Ile gramów waży szklanka ${ing.nameGen}?`,
            a: `Płaska szklanka ${ing.nameGen} (250 ml) to około ${formatGrams(ing.grams.szklanka)} g.`,
          },
          {
            q: `Ile waży łyżka ${ing.nameGen}?`,
            a: `Płaska łyżka ${ing.nameGen} (15 ml) to około ${formatGrams(ing.grams.lyzka!)} g, a łyżeczka (5 ml) — ${formatGrams(ing.grams.lyzeczka!)} g.`,
          },
        ]
      : [
          {
            q: `Ile waży łyżka ${ing.nameGen}?`,
            a: `Płaska łyżka ${ing.nameGen} (15 ml) to około ${formatGrams(ing.grams.lyzka!)} g, a łyżeczka (5 ml) — ${formatGrams(ing.grams.lyzeczka!)} g.`,
          },
        ]
  const faqAll = [
    ...faq,
    {
      q: 'Czy te przeliczniki są dokładne?',
      a: 'To wartości orientacyjne dla domowych, płaskich miar — realnie różnice sięgają ±5–10% w zależności od sposobu nakładania i wilgotności produktu. W wypiekach, gdzie liczy się precyzja, najlepiej trzymać się gramów.',
    },
  ]

  const faqSchema = {
    '@context': 'https://schema.org/',
    '@type': 'FAQPage',
    mainEntity: faqAll.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org/',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_TITLE, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Konwerter miar', item: `${SITE_URL}/konwerter/` },
      { '@type': 'ListItem', position: 3, name: ing.name, item: canonical },
    ],
  }

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>
          {ing.grams.szklanka != null
            ? `Szklanka ${ing.nameGen} – ile to gramów? - ${SITE_TITLE}`
            : `${ing.name} – ile gramów w łyżce i łyżeczce? - ${SITE_TITLE}`}
        </title>
        <meta
          name="description"
          content={
            ing.grams.szklanka != null
              ? `Szklanka ${ing.nameGen} to ${ing.grams.szklanka} g. Tabela przeliczników szklanka–gramy dla ${ing.nameGen}: łyżki, łyżeczki i odwrotnie.`
              : `Łyżka ${ing.nameGen} to ${ing.grams.lyzka} g, łyżeczka ${ing.grams.lyzeczka} g. Tabela przeliczników ${ing.nameGen}.`
          }
        />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`${ing.name} w gramach - ${SITE_TITLE}`} />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <nav className="text-sm text-gray-400 mb-6">
            <Link href="/konwerter/" className="hover:text-gray-600">Konwerter miar</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-600">{ing.name}</span>
          </nav>

          <PostTitle>
            {ing.grams.szklanka != null
              ? `Szklanka ${ing.nameGen} – ile to gramów?`
              : `${ing.name} – ile gramów?`}
          </PostTitle>
          <p className="text-gray-600 mb-8">
            {ing.grams.szklanka != null
              ? `Szklanka ${ing.nameGen} to ${ing.grams.szklanka} g. Poniżej pełna tabela przeliczników: szklanki, łyżki i łyżeczki na gramy — oraz gramy na miary, gdy przepis pisze „${ing.grams.szklanka} g”, a Ty chcesz odmierzyć bez wagi.`
              : `${ing.name} odmierzasz w małych ilościach: płaska łyżka to ${ing.grams.lyzka} g, a łyżeczka ${ing.grams.lyzeczka} g. W tabeli poniżej też kierunek odwrotny — gramy na miary.`}
          </p>

          <div className="rounded-xl border border-gray-200 shadow-small overflow-hidden mb-10">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Miara (płaska)</th>
                  <th className="px-4 py-3 font-medium text-right">Gramy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicable.map((m) => (
                  <tr key={m}>
                    <td className="px-4 py-3 capitalize">{MEASURES[m].label}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatGrams(ing.grams[m]!)} g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-bold text-lg mb-4">{ing.nameGen.charAt(0).toUpperCase() + ing.nameGen.slice(1)} — gramy na miary</h2>
          <div className="rounded-xl border border-gray-200 shadow-small overflow-hidden mb-12">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ilość</th>
                  {applicable.map((m) => (
                    <th key={m} className="px-4 py-3 font-medium text-right capitalize">
                      {MEASURES[m].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reverseRows.map((g) => (
                  <tr key={g}>
                    <td className="px-4 py-3 font-bold">{g} g</td>
                    {applicable.map((m) => {
                      const v = gramsToMeasure(ing, m, g)!
                      return (
                        <td key={m} className="px-4 py-3 text-right text-gray-600">
                          ~{formatMeasureValue(v)} {measureForm(m, v)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="font-bold text-lg mb-4">Częste pytania</h2>
          <div className="space-y-6 mb-12">
            {faqAll.map((f) => (
              <div key={f.q}>
                <h3 className="font-bold mb-1">{f.q}</h3>
                <p className="text-gray-600">{f.a}</p>
              </div>
            ))}
          </div>

          <NewsletterSignup source="konwerter" />

          <div className="mt-14 border-t border-gray-100 pt-8">
            <p className="text-sm text-gray-500 mb-3">
              Inne składniki ({GROUP_LABELS[ing.group].toLowerCase()}):
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {similar.map((s) => (
                <li key={s.slug}>
                  <Link href={`/konwerter/${s.slug}/`} className="text-sm text-gray-700 hover:text-gray-900 hover:underline underline-offset-2">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const ing = getIngredientBySlug(params?.skladnik as string)
  if (!ing) return { notFound: true }

  const similar = INGREDIENTS.filter((i) => i.group === ing!.group && i.slug !== ing!.slug)

  return {
    props: { ing, similar },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: INGREDIENTS.map((i) => ({ params: { skladnik: i.slug } })),
    fallback: false,
  }
}
