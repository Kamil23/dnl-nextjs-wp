import { AppProps } from 'next/app'
import Script from 'next/script'
import { GA_MEASUREMENT_ID } from '../lib/constants'
import '../styles/index.css'

// Loaded only in production builds so localhost browsing never pollutes stats.
// SPA navigations are counted by GA4 enhanced measurement (history events) —
// sending page_view manually on route change would double-count them.
const GA_ENABLED = process.env.NODE_ENV === 'production'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      {GA_ENABLED && (
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
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
