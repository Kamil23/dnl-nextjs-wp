import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Container from '../../components/container'
import Layout from '../../components/layout'
import { MENU_EDGES } from '../../lib/menu'
import { SITE_TITLE } from '../../lib/constants'
import { mirrorSharedList } from '../../lib/shopping-list'
import { fetchSharedList, rememberList, setSharedListId } from '../../lib/shared-list'

// Join page: opening a shared link makes that session your current list
// (it lands in "Moje listy" too) and drops you on the list page. The
// previous list stays in the registry, nothing is lost.
export default function JoinSharedListPage() {
  const router = useRouter()
  const id = typeof router.query.id === 'string' ? router.query.id : null
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    let retry: ReturnType<typeof setTimeout>
    const open = () =>
      fetchSharedList(id).then(
        (res) => {
          if (cancelled) return
          if (!res) {
            setGone(true)
            return
          }
          rememberList(id, res.name, res.createdAt)
          setSharedListId(id)
          mirrorSharedList(res.data)
          router.replace('/lista-zakupow/')
        },
        () => {
          // Network hiccup ≠ missing list — keep trying quietly
          if (!cancelled) retry = setTimeout(open, 2500)
        }
      )
    open()
    return () => {
      cancelled = true
      clearTimeout(retry)
    }
  }, [id, router])

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Wspólna lista zakupów - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          {gone ? (
            <div className="text-center text-gray-500 py-16">
              <p className="mb-4">Ta lista wygasła albo została usunięta.</p>
              <Link
                href="/lista-zakupow/"
                className="inline-block mt-2 rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition"
              >
                Wróć do swojej listy
              </Link>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-16">Otwieranie listy…</p>
          )}
        </article>
      </Container>
    </Layout>
  )
}
