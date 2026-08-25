import Head from 'next/head'
import Link from 'next/link'
import { useMemo, useState } from 'react'
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
  measureToGrams,
  gramsToMeasure,
  measureForm,
  formatMeasureValue,
  formatGrams,
  type IngredientGroup,
  type MeasureKey,
} from '../../lib/measures'

// Konwerter miar kuchennych - narzędzie + hub linkujący wszystkie
// programmatic landingi /konwerter/[skladnik] (internal linking dla SEO).

const GROUP_ORDER: IngredientGroup[] = ['maki', 'cukry', 'nabial-tluszcze', 'suche', 'dodatki']
const MEASURE_KEYS: MeasureKey[] = ['szklanka', 'lyzka', 'lyzeczka']

export default function Converter() {
  const [slug, setSlug] = useState('maka-pszenna')
  const [amount, setAmount] = useState('1')
  const [measure, setMeasure] = useState<MeasureKey>('szklanka')
  const [gramsInput, setGramsInput] = useState('100')

  const ing = getIngredientBySlug(slug)!

  const forward = useMemo(() => {
    const a = parseFloat(amount.replace(',', '.'))
    if (!Number.isFinite(a) || a <= 0) return null
    const g = measureToGrams(ing, measure, a)
    return g == null ? null : g
  }, [ing, amount, measure])

  const reverse = useMemo(() => {
    const g = parseFloat(gramsInput.replace(',', '.'))
    if (!Number.isFinite(g) || g <= 0) return null
    return MEASURE_KEYS.map((m) => {
      const v = gramsToMeasure(ing, m, g)
      return v == null ? null : { measure: m, value: v }
    })
  }, [ing, gramsInput])

  const inputCls =
    'border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-400'

  const byGroup = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({
        group: g,
        items: INGREDIENTS.filter((i) => i.group === g),
      })),
    []
  )

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Konwerter miar kuchennych: szklanka, łyżka, łyżeczka na gramy - ${SITE_TITLE}`}</title>
        <meta
          name="description"
          content="Ile gramów waży szklanka mąki, łyżka cukru czy łyżeczka kakao? Przelicz szklanki, łyżki i łyżeczki na gramy - i odwrotnie."
        />
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
        <link rel="canonical" href={`${SITE_URL}/konwerter/`} />
        <meta property="og:locale" content="pl_PL" />
        <meta property="og:title" content={`Konwerter miar kuchennych - ${SITE_TITLE}`} />
        <meta property="og:url" content={`${SITE_URL}/konwerter/`} />
        <meta property="og:site_name" content={SITE_TITLE} />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <PostTitle>Konwerter miar</PostTitle>
          <p className="text-gray-600 mb-8">
            Szklanka to nie jednostka. Szklanka mąki to 160 g, a szklanka cukru już
            220 g - dlatego przepisy „na oko” potrafią zepsuć wypiek. Wybierz
            składnik i przelicz miarę na gramy albo odwrotnie.
          </p>

          <div className="rounded-xl border border-gray-200 shadow-small p-6 mb-10">
            <h2 className="font-bold text-lg mb-4">Miara → gramy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <label className="block">
                <span className="text-sm text-gray-700">Składnik</span>
                <select value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls}>
                  {byGroup.map(({ group, items }) => (
                    <optgroup key={group} label={GROUP_LABELS[group]}>
                      {items.map((i) => (
                        <option key={i.slug} value={i.slug}>{i.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block sm:w-28">
                <span className="text-sm text-gray-700">Ile</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="np. 1,5" />
              </label>
              <label className="block sm:w-36">
                <span className="text-sm text-gray-700">Miara</span>
                <select value={measure} onChange={(e) => setMeasure(e.target.value as MeasureKey)} className={inputCls}>
                  {MEASURE_KEYS.map((m) => (
                    <option key={m} value={m}>{MEASURES[m].label}</option>
                  ))}
                </select>
              </label>
            </div>

            {forward != null ? (
              <div className="mt-5 rounded-lg bg-gray-50 px-5 py-4 text-center">
                <span className="text-2xl font-bold">
                  {formatGrams(forward)} g
                </span>{' '}
                <span className="text-gray-500">
                  = {formatMeasureValue(parseFloat(amount.replace(',', '.')) || 0)} {ing.nameGen}
                </span>
              </div>
            ) : (
              <p className="mt-5 text-sm text-gray-400 text-center">Podaj ilość, a wynik pojawi się automatycznie.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 shadow-small p-6 mb-12">
            <h2 className="font-bold text-lg mb-4">Gramy → miary</h2>
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <label className="block flex-1 min-w-40">
                <span className="text-sm text-gray-700">{ing.nameGen} (gramy)</span>
                <input inputMode="decimal" value={gramsInput} onChange={(e) => setGramsInput(e.target.value)} className={inputCls} placeholder="np. 250" />
              </label>
              <div className="pb-1 text-sm text-gray-400">przelicz na:</div>
            </div>
            {reverse && reverse.some(Boolean) ? (
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {reverse.filter(Boolean).map(({ measure: m, value }) => (
                  <li key={m} className="rounded-lg bg-gray-50 px-4 py-3 text-center">
                    <span className="text-xl font-bold">{formatMeasureValue(value)}</span>{' '}
                    <span className="text-sm text-gray-500">{measureForm(m, value)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Podaj gramy, a pokażemy odpowiedniki w miarach.</p>
            )}
          </div>

          <NewsletterSignup source="konwerter" />

          <h2 className="font-bold text-lg mt-14 mb-4">
            Ile gramów ma szklanka, łyżka i łyżeczka? Tabele dla składników
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Kliknij składnik, żeby zobaczyć pełną tabelę przeliczników w obie strony.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {byGroup.map(({ group, items }) => (
              <div key={group}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-2">
                  {GROUP_LABELS[group]}
                </h3>
                <ul className="space-y-1.5">
                  {items.map((i) => (
                    <li key={i.slug}>
                      <Link
                        href={`/konwerter/${i.slug}/`}
                        className="text-gray-700 hover:text-gray-900 hover:underline underline-offset-2"
                      >
                        {i.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </Container>
    </Layout>
  )
}
