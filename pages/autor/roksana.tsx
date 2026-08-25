import Head from 'next/head'
import Link from 'next/link'
import { GetStaticProps } from 'next'
import Container from '../../components/container'
import Layout from '../../components/layout'
import PostTitle from '../../components/post-title'
import MoreStories from '../../components/more-stories'
import { listTopRatedRecipes, toListingEdge } from '../../lib/queries'
import { MENU_EDGES } from '../../lib/menu'
import {
  SITE_TITLE,
  SITE_URL,
  AUTHOR_NAME,
  AUTHOR_PAGE_PATH,
  AUTHOR_AVATAR_URL,
  SOCIAL_TIKTOK_URL,
  SOCIAL_INSTAGRAM_URL,
} from '../../lib/constants'

// Encja autorki (Person) — kotwica E-E-A-T dla Recipe JSON-LD i sygnał
// autorskości dla Google/AI. Statyczna, treść biura trzymamy w kodzie
// dopóki nie powstanie panel "o mnie" w adminie.

const BIO = [
  'Cześć, jestem Roksana. Gotuję na luzie — bez wagi co do grama tam, gdzie może być na oko, i z gramem tam, gdzie decyduje o wszystkim. Na dietanaluzie.pl pokazuję, że zdrowe jedzenie nie wymaga rewolucji ani specjalnych sklepów: wystarczy kilka dobrych nawyków i przepisy, które wychodzą za pierwszym razem.',
  'Każdy przepis na tej stronie przechodzi przez moją kuchnię zanim trafi na bloga — gotuję go, fotografuję i opisuję tak, jak sama bym chciała przeczytać. Makra liczę do każdego przepisu, a oceny pod nimi pochodzą od osób, które naprawdę ugotowały.',
]

const PERSON_SCHEMA = {
  '@context': 'https://schema.org/',
  '@type': 'Person',
  name: AUTHOR_NAME,
  url: `${SITE_URL}${AUTHOR_PAGE_PATH}`,
  image: `${SITE_URL}${AUTHOR_AVATAR_URL}`,
  jobTitle: 'Autorka bloga kulinarnego',
  worksFor: { '@type': 'Organization', name: SITE_TITLE, url: `${SITE_URL}/` },
  description:
    'Autorka bloga dietanaluzie.pl — przepisy zdrowej kuchni bez komplikacji, testowane we własnej kuchni.',
  sameAs: [SOCIAL_INSTAGRAM_URL, SOCIAL_TIKTOK_URL],
}

export default function AuthorPage({ posts }: { posts: any[] }) {
  const canonical = `${SITE_URL}${AUTHOR_PAGE_PATH}`

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${AUTHOR_NAME} – o autorce - ${SITE_TITLE}`}</title>
        <meta
          name="description"
          content={`${AUTHOR_NAME} — autorka bloga ${SITE_TITLE}. Przepisy testowane we własnej kuchni, makra policzone do każdej porcji.`}
        />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${AUTHOR_NAME} – o autorce - ${SITE_TITLE}`} />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={`${SITE_URL}${AUTHOR_AVATAR_URL}`} />
        <meta property="og:site_name" content={SITE_TITLE} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }} />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <div className="flex items-center gap-5 mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={AUTHOR_AVATAR_URL}
              alt={AUTHOR_NAME}
              className="w-24 h-24 rounded-full object-cover shadow-small"
            />
            <div>
              <PostTitle>{AUTHOR_NAME}</PostTitle>
              <p className="text-gray-400 -mt-2">za {SITE_TITLE.toLowerCase()}</p>
            </div>
          </div>

          {BIO.map((p) => (
            <p key={p.slice(0, 24)} className="text-gray-600 mb-4">
              {p}
            </p>
          ))}

          <div className="flex gap-4 my-8">
            <a href={SOCIAL_INSTAGRAM_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-gray-700 hover:text-gray-900">
              Instagram
            </a>
            <a href={SOCIAL_TIKTOK_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-gray-700 hover:text-gray-900">
              TikTok
            </a>
            <Link href="/kategoria/przepisy/" className="underline underline-offset-2 text-gray-700 hover:text-gray-900">
              Wszystkie przepisy
            </Link>
          </div>

          {posts.length > 0 && (
            <>
              <h2 className="text-xl font-bold tracking-tight mt-12 mb-5">Najlepiej oceniane przepisy</h2>
              <MoreStories posts={posts.slice(0, 4)} />
            </>
          )}
        </article>
      </Container>
    </Layout>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const recipes = await listTopRatedRecipes(4)
  return {
    props: { posts: recipes.map(toListingEdge) },
    revalidate: 3600,
  }
}
