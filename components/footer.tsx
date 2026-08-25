import Link from 'next/link'
import Container from './container'
import NewsletterSignup from './newsletter-signup'
import { resetConsent } from './cookie-consent'
import { InstagramIcon, TikTokIcon } from './icons'
import { SITE_TITLE, SOCIAL_TIKTOK_URL, SOCIAL_INSTAGRAM_URL } from '../lib/constants'

export default function Footer() {
  return (
    <footer className="bg-accent-1 border-t border-accent-2 print:hidden">
      <Container>
        <div className="pt-10 max-w-xl mx-auto">
          <NewsletterSignup source="stopka" compact />
        </div>
        <div className="py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div>
            © {new Date().getFullYear()} {SITE_TITLE} · jak jeść i nie zwariować?
          </div>
          <nav className="flex flex-wrap gap-5">
            <Link href="/kategoria/przepisy/" className="hover:text-gray-900">Przepisy</Link>
            <Link href="/kolekcje/wysokie-bialko/" className="hover:text-gray-900">Wysokie białko</Link>
            <Link href="/kalkulator-kalorii/" className="hover:text-gray-900">Kalkulator kalorii</Link>
            <Link href="/konwerter/" className="hover:text-gray-900">Konwerter miar</Link>
            <Link href="/polityka-prywatnosci/" className="hover:text-gray-900">Polityka prywatności</Link>
            <Link href="/regulamin/" className="hover:text-gray-900">Regulamin</Link>
            <button onClick={resetConsent} className="hover:text-gray-900">Ustawienia cookies</button>
          </nav>
          <div className="flex gap-4">
            <a
              href={SOCIAL_TIKTOK_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok — @roksanacieplicka"
              className="hover:text-gray-900 transition-colors"
            >
              <TikTokIcon className="w-4 h-4" />
            </a>
            <a
              href={SOCIAL_INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram — @roksanacieplicka"
              className="hover:text-gray-900 transition-colors"
            >
              <InstagramIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}
