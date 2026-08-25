import Link from 'next/link'
import Container from '../components/container'
import Layout from '../components/layout'
import { MENU_EDGES } from '../lib/menu'

// Branded 500 - keep the brand and a way back even when the server errors.
export default function ServerError() {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Container>
        <section className="min-h-[52vh] flex flex-col items-center justify-center text-center py-24">
          <p className="font-mono text-sm tracking-[0.3em] text-amber-600 mb-4">500</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Coś poszło nie tak
          </h1>
          <p className="text-gray-500 max-w-md mb-9">
            Po naszej stronie wystąpił błąd. Spróbuj odświeżyć stronę za chwilę,
            albo wróć na stronę główną.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href="/"
              className="rounded-full bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Strona główna
            </Link>
            <Link
              href="/przepisy/"
              className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-medium hover:border-gray-900 transition-colors"
            >
              Wszystkie przepisy
            </Link>
          </div>
        </section>
      </Container>
    </Layout>
  )
}
