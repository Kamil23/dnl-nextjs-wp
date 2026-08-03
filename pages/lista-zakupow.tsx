import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Container from '../components/container'
import Layout from '../components/layout'
import PostTitle from '../components/post-title'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE } from '../lib/constants'
import {
  readList,
  removeRecipe,
  toggleItem,
  clearChecked,
  asText,
  SHOPPING_EVENT,
  type ShoppingRecipe,
} from '../lib/shopping-list'

export default function ShoppingListPage() {
  const [list, setList] = useState<ShoppingRecipe[]>([])
  const [shared, setShared] = useState(false)

  useEffect(() => {
    const refresh = () => setList(readList())
    refresh()
    window.addEventListener(SHOPPING_EVENT, refresh)
    return () => window.removeEventListener(SHOPPING_EVENT, refresh)
  }, [])

  async function share() {
    const text = `Moja lista zakupów z dietanaluzie.pl 🛒\n\n${asText()}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {}
  }

  const totalItems = list.reduce((n, r) => n + r.items.length, 0)

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Lista zakupów - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <PostTitle>Lista zakupów 🛒</PostTitle>

          {list.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="mb-4">Twoja lista jest pusta.</p>
              <p className="text-sm">
                Wejdź na dowolny przepis i kliknij{' '}
                <strong>"Dodaj składniki do listy zakupów"</strong> — możesz
                łączyć składniki z wielu przepisów (z przeliczonymi porcjami).
              </p>
              <Link
                href="/"
                className="inline-block mt-6 rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition"
              >
                Przeglądaj przepisy
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-3 mb-8 flex-wrap">
                <button
                  onClick={share}
                  className="rounded-full bg-gray-900 text-white px-5 py-2 text-sm font-semibold hover:bg-amber-500 transition"
                >
                  {shared ? '✓ Skopiowano!' : '📤 Udostępnij / kopiuj'}
                </button>
                <button
                  onClick={() => { clearChecked(); }}
                  className="rounded-full border border-gray-300 px-5 py-2 text-sm text-gray-600 hover:border-gray-500 transition"
                >
                  Usuń odhaczone
                </button>
                <span className="text-sm text-gray-400 self-center ml-auto">
                  {totalItems} pozycji
                </span>
              </div>

              <div className="space-y-6">
                {list.map((r) => (
                  <div key={r.recipeId} className="rounded-3xl border border-gray-100 bg-white shadow-bottomSmall p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <Link href={r.uri} className="font-bold text-gray-900 hover:underline">
                        {r.title}
                        {r.servings && (
                          <span className="text-gray-400 font-normal text-sm ml-2">
                            {r.servings} porcji
                          </span>
                        )}
                      </Link>
                      <button
                        onClick={() => removeRecipe(r.recipeId)}
                        className="text-red-400 hover:text-red-600 text-sm shrink-0"
                      >
                        ✕ usuń
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {r.items.map((item, i) => (
                        <li key={i}>
                          <label className="flex items-start gap-3 cursor-pointer rounded-xl px-2 py-1.5 hover:bg-amber-50 transition">
                            <input
                              type="checkbox"
                              checked={r.checked[i] ?? false}
                              onChange={() => toggleItem(r.recipeId, i)}
                              className="mt-1 w-4 h-4 accent-amber-500 shrink-0"
                            />
                            <span className={r.checked[i] ? 'text-gray-300 line-through' : 'text-gray-700'}>
                              {item}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      </Container>
    </Layout>
  )
}
