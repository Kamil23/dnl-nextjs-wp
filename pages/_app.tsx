import { AppProps } from 'next/app'
import Head from 'next/head'
import Script from 'next/script'
import { useEffect, useState } from 'react'
import CookieConsent, { readConsent, type Consent } from '../components/cookie-consent'
import { GA_MEASUREMENT_ID } from '../lib/constants'
import '../styles/index.css'

// GA loads only in production builds AND only after the visitor consented in
// the cookie banner (Polish PKE requires opt-in for analytics cookies).
// SPA navigations are counted by GA4 enhanced measurement (history events) -
// sending page_view manually on route change would double-count them.
const GA_ENABLED = process.env.NODE_ENV === 'production'

function MyApp({ Component, pageProps }: AppProps) {
  // "unset" until the effect reads localStorage - prevents a hydration
  // mismatch and a banner flash for visitors who already decided
  const [consent, setConsent] = useState<Consent | null | 'unset'>('unset')

  useEffect(() => {
    setConsent(readConsent())
    const reset = () => setConsent(null)
    window.addEventListener('dnl-cookies-reset', reset)
    return () => window.removeEventListener('dnl-cookies-reset', reset)
  }, [])

  // Self-heal dev browsers that still carry the shopping-list service worker
  // from an earlier session: its cache-first /_next/static/* strategy serves
  // stale chunks on localhost and locks the page in a Fast Refresh reload loop
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    navigator.serviceWorker?.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister())
      if (regs.length) caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)))
    }).catch(() => {})
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      {GA_ENABLED && consent === 'granted' && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      )}
      {consent === null && <CookieConsent onDecision={setConsent} />}
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
