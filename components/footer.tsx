import Link from 'next/link'
import Container from './container'
import { SITE_TITLE } from '../lib/constants'

export default function Footer() {
  return (
    <footer className="bg-accent-1 border-t border-accent-2 print:hidden">
      <Container>
        <div className="py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div>
            © {new Date().getFullYear()} {SITE_TITLE} · jak jeść i nie zwariować?
          </div>
          <nav className="flex flex-wrap gap-5">
            <Link href="/kategoria/przepisy/" className="hover:text-gray-900">Przepisy</Link>
            <Link href="/kalkulator-kalorii/" className="hover:text-gray-900">Kalkulator kalorii</Link>
            <Link href="/polityka-prywatnosci/" className="hover:text-gray-900">Polityka prywatności</Link>
            <Link href="/regulamin/" className="hover:text-gray-900">Regulamin</Link>
          </nav>
        </div>
      </Container>
    </footer>
  )
}
