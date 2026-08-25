import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Container from '../components/container'
import Layout from '../components/layout'
import InstallPrompt from '../components/shopping-list/install-prompt'
import ListEditor from '../components/shopping-list/list-editor'
import { ShareAndroidIcon, ShareIosIcon } from '../components/icons'
import { MENU_EDGES } from '../lib/menu'
import { SITE_TITLE } from '../lib/constants'
import { osobaPlural, type ListOp, type ShoppingItem } from '../lib/shopping-list-ops'
import {
  ensureSession,
  mirrorSharedList,
  mutate,
  readList,
  SHOPPING_EVENT,
} from '../lib/shopping-list'
import {
  clearSharedListId,
  fetchSharedList,
  forgetList,
  getClientId,
  getMyLists,
  getSharedListId,
  listDisplayName,
  rememberList,
  sendOp,
  sendTyping,
  subscribeSharedList,
  type SavedList,
} from '../lib/shared-list'

// Auto-cleanup horizon: a shopping trip is over after this long
const CLEAR_CHECKED_AFTER_MS = 12 * 60 * 60 * 1000

// Your list. Every list is a live shared session (created lazily on the
// first item), so there is no local/shared split - the share button just
// hands out the link. Other lists you joined live in "Moje listy".
export default function ShoppingListPage() {
  const [list, setList] = useState<ShoppingItem[]>([])
  const [id, setId] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [online, setOnline] = useState(0)
  const [peerTyping, setPeerTyping] = useState(false)
  const [myLists, setMyLists] = useState<SavedList[]>([])
  const [copied, setCopied] = useState(false)
  // Platform share glyph (iOS square-with-arrow vs Material nodes) -
  // decided after mount so SSR and hydration render the same thing
  const [isIos, setIsIos] = useState(false)
  // Bumped to force a fresh SSE subscription after a transient "gone"
  const [reconnectNonce, setReconnectNonce] = useState(0)
  const cleanedRef = useRef(false)
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const typingSentAtRef = useRef(0)

  // Everything flows through localStorage + SHOPPING_EVENT: mutations and
  // SSE mirrors both write there, this effect just reads
  useEffect(() => {
    const refresh = () => {
      setList(readList())
      setId(getSharedListId())
      setMyLists(getMyLists())
    }
    refresh()
    window.addEventListener(SHOPPING_EVENT, refresh)
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    // Offline shell + installability for the PWA (prod only - on dev the SW
    // cache serves stale webpack chunks and breaks Fast Refresh)
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker?.register('/sw.js').catch(() => {})
    }
    return () => window.removeEventListener(SHOPPING_EVENT, refresh)
  }, [])

  // Reminders-style cleanup: items checked off longer than 12h ago are a
  // finished shopping trip - clear them once per visit
  useEffect(() => {
    if (cleanedRef.current) return
    const cutoff = Date.now() - CLEAR_CHECKED_AFTER_MS
    if (list.some((i) => i.checked && (i.checkedAt ?? 0) < cutoff)) {
      cleanedRef.current = true
      mutate({ op: 'clearChecked', checkedBefore: cutoff })
    }
  }, [list])

  // Live subscription to my own session
  useEffect(() => {
    if (!id) return
    return subscribeSharedList(id, {
      onList: (data) => mirrorSharedList(data),
      onMeta: (meta) => {
        setName(meta.name)
        rememberList(id, meta.name, meta.createdAt)
        setMyLists(getMyLists())
      },
      onPresence: (count) => setOnline(count),
      onTyping: (payload) => {
        if (payload.clientId === getClientId()) return
        if (typingClearRef.current) clearTimeout(typingClearRef.current)
        setPeerTyping(payload.typing)
        if (payload.typing) {
          typingClearRef.current = setTimeout(() => setPeerTyping(false), 6000)
        }
      },
      onGone: async () => {
        // Dropping the list is destructive - double-check it truly expired
        // before acting (a flaky connection must not orphan the session)
        try {
          if ((await fetchSharedList(id)) !== null) {
            setReconnectNonce((n) => n + 1)
            return
          }
        } catch {
          setReconnectNonce((n) => n + 1)
          return
        }
        // Session really expired - the localStorage cache survives and the
        // next mutation recreates a fresh session from it
        forgetList(id)
        clearSharedListId()
        setId(null)
        setName(null)
        setOnline(0)
        setMyLists(getMyLists())
      },
    })
  }, [id, reconnectNonce])

  function handleTyping(typing: boolean) {
    if (!id) return
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    if (!typing) {
      sendTyping(id, false)
      return
    }
    const now = Date.now()
    if (now - typingSentAtRef.current > 2500) {
      typingSentAtRef.current = now
      sendTyping(id, true)
    }
    typingStopRef.current = setTimeout(() => sendTyping(id, false), 4000)
  }

  async function rename(newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    setName(trimmed)
    try {
      const listId = await ensureSession()
      rememberList(listId, trimmed)
      sendOp(listId, { op: 'rename', name: trimmed })
    } catch {}
  }

  async function shareLink() {
    try {
      const listId = await ensureSession()
      const url = `${window.location.origin}/lista-zakupow/${listId}/`
      if (navigator.share) {
        await navigator.share({ title: name || 'Lista zakupów', url })
      } else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {}
  }

  // Fresh empty list: just detach the current session - the next added
  // item lazily creates a new one. The old list stays in "Moje listy".
  function newList() {
    clearSharedListId()
    mirrorSharedList([])
    setName(null)
    setOnline(0)
    setPeerTyping(false)
  }

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`${name || 'Listy zakupów'} - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, follow" />
        {/* The shopping list is its own "app": amber cart icons override
            the site-wide dnl set (same keys as in Meta) */}
        <link
          key="apple-touch-icon"
          rel="apple-touch-icon"
          sizes="180x180"
          href="/favicon/lista/apple-touch-icon.png"
        />
        <link
          key="icon-32"
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon/lista/favicon-32x32.png"
        />
        <link
          key="icon-16"
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon/lista/favicon-16x16.png"
        />
      </Head>
      <Container>
        <article className="max-w-2xl mx-auto mb-24">
          <div className="flex items-end justify-between gap-4">
            <EditableTitle name={name} onRename={rename} />
            <button
              onClick={shareLink}
              aria-label="Udostępnij listę"
              title="Udostępnij listę"
              className={`p-2 mb-5 shrink-0 transition ${
                copied ? 'text-green-600' : 'text-gray-400 hover:text-gray-900'
              }`}
            >
              {copied ? (
                <span className="text-sm font-semibold">✓</span>
              ) : isIos ? (
                <ShareIosIcon className="w-6 h-6" />
              ) : (
                <ShareAndroidIcon className="w-6 h-6" />
              )}
            </button>
          </div>

          <div className="flex gap-4 text-xs text-gray-400 mb-5">
            {online > 1 && (
              <span className="text-green-600 font-semibold">
                🟢 online: {online} {osobaPlural(online)}
              </span>
            )}
            <span className="ml-auto">{list.length} pozycji</span>
          </div>

          <ListEditor
            items={list}
            dispatch={(op: ListOp) => mutate(op)}
            onTyping={handleTyping}
            typingActive={peerTyping}
          />

          <p className="text-xs text-gray-400 text-center mt-3">
            ⚡ To lista na żywo. Wyślij link bliskiej osobie, a będziecie dodawać
            i odhaczać razem, bez konfliktów.
          </p>

          {list.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">
                Możesz też wejść na dowolny przepis i kliknąć{' '}
                <strong>"Dodaj składniki do listy zakupów"</strong>. Pozycje
                trafią tu z przeliczonymi porcjami.
              </p>
              <Link
                href="/"
                className="inline-block mt-5 rounded-full bg-gray-900 text-white px-6 py-3 font-semibold hover:bg-amber-500 transition"
              >
                Przeglądaj przepisy
              </Link>
            </div>
          )}

          {myLists.length > 0 && (
            <section className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold tracking-tight">Moje listy</h2>
                {(id || list.length === 0) && (
                  <button
                    onClick={newList}
                    className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:border-amber-400 hover:text-amber-600 transition"
                  >
                    ＋ Nowa lista
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {myLists.map((l) => {
                  const isCurrent = l.id === id
                  return (
                    <li
                      key={l.id}
                      className={`flex items-center gap-3 rounded-2xl border bg-white shadow-bottomSmall px-4 py-3 ${
                        isCurrent ? 'border-amber-300' : 'border-gray-100'
                      }`}
                    >
                      {isCurrent ? (
                        <span className="flex-1 font-semibold text-gray-800 truncate">
                          {listDisplayName(l, myLists)}
                        </span>
                      ) : (
                        <Link
                          href={`/lista-zakupow/${l.id}/`}
                          className="flex-1 font-semibold text-gray-800 hover:text-amber-600 transition truncate"
                        >
                          {listDisplayName(l, myLists)}
                        </Link>
                      )}
                      {isCurrent ? (
                        <span className="text-[10px] uppercase tracking-wide font-bold text-white bg-amber-500 rounded-full px-2 py-0.5">
                          obecna
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            forgetList(l.id)
                            setMyLists(getMyLists())
                          }}
                          aria-label={`Usuń listę ${l.name || ''} z moich list`}
                          className="text-gray-300 hover:text-red-500 transition px-1"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <InstallPrompt />
        </article>
      </Container>
    </Layout>
  )
}

// Freshlist's tap-to-edit list title with confirm/cancel
function EditableTitle({
  name,
  onRename,
}: {
  name: string | null
  onRename: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name || '')

  useEffect(() => setValue(name || ''), [name])

  if (editing) {
    return (
      <div className="flex items-center gap-3 mt-12 mb-4 flex-1 min-w-[240px]">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRename(value)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setValue(name || '')
              setEditing(false)
            }
          }}
          className="flex-1 min-w-0 text-3xl md:text-4xl font-bold tracking-tighter border-b-2 border-amber-300 focus:outline-none bg-transparent"
        />
        <button
          onClick={() => {
            setValue(name || '')
            setEditing(false)
          }}
          aria-label="Anuluj"
          className="text-gray-400 hover:text-gray-600 text-xl"
        >
          ✕
        </button>
        <button
          onClick={() => {
            onRename(value)
            setEditing(false)
          }}
          aria-label="Zapisz nazwę"
          className="text-green-500 hover:text-green-700 text-xl font-bold"
        >
          ✓
        </button>
      </div>
    )
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      title="Kliknij, aby zmienić nazwę"
      className="text-4xl md:text-5xl font-bold tracking-tighter leading-tight mt-12 mb-4 cursor-pointer hover:text-amber-600 transition"
    >
      {name || 'Lista zakupów'}
    </h1>
  )
}
