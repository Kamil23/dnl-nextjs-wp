import Head from 'next/head'
import Link from 'next/link'
import Container from '../components/container'
import Layout from '../components/layout'
import PostTitle from '../components/post-title'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE, SITE_URL } from '../lib/constants'
import { CALCULATORS } from '../lib/calculators'

// Hub linking every calculator - a landing for "kalkulatory dietetyczne" and
// the internal-linking anchor that ties the tool cluster together.

export default function CalculatorsHub() {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Kalkulatory dietetyczne - ${SITE_TITLE}`}</title>
        <meta name="description" content="Darmowe kalkulatory dietetyczne: kalorii (BMR/CPM), deficytu kalorycznego, makroskładników, BMI i ładunku glikemicznego. Bez rejestracji." />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/kalkulatory/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Kalkulatory dietetyczne - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/kalkulatory/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <PostTitle>Kalkulatory dietetyczne</PostTitle>
          <p className="text-gray-600 mb-8">
            Darmowe narzędzia, które policzą za Ciebie kalorie, deficyt, makro,
            BMI i ładunek glikemiczny. Bez logowania - wpisujesz dane, wynik
            pojawia się od razu.
          </p>

          <ul className="grid sm:grid-cols-2 gap-4">
            {CALCULATORS.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${c.slug}/`}
                  className="block h-full rounded-xl border border-gray-200 shadow-small p-5 hover:border-gray-300 transition-colors"
                >
                  <div className="text-2xl mb-2">{c.emoji}</div>
                  <div className="font-bold mb-1">{c.title}</div>
                  <p className="text-sm text-gray-600">{c.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </Container>
    </Layout>
  )
}
