import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

// GA4 Data API client without the Google SDK: a service-account JWT is
// exchanged for an OAuth token and runReport is called over plain REST.
// Configuration (both required, otherwise getTopReadPaths returns null):
//   GA4_PROPERTY_ID              - numeric property id (NOT the G-… id)
//   GA4_SERVICE_ACCOUNT_KEY_PATH - path to the service-account JSON key
//     (kept outside the repo; the file contains a private key)

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

// Popularity moves slowly - refresh at most twice a day and serve the
// cached ranking in between (getStaticProps revalidates every 60s)
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cache: { paths: { path: string; views: number }[]; at: number } | null = null;
let warned = false;

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(privateKey, "base64url")}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`GA token exchange failed: ${res.status}`);
  return (await res.json()).access_token as string;
}

/**
 * Most-viewed page paths over the last `days`, most read first.
 * Returns null when GA is not configured or the API call fails -
 * callers are expected to fall back to a non-GA ranking.
 */
export async function getTopReadPaths(days = 30, limit = 50) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const keyPath = process.env.GA4_SERVICE_ACCOUNT_KEY_PATH;
  if (!propertyId || !keyPath) {
    if (!warned) {
      warned = true;
      console.warn("GA4 not configured (GA4_PROPERTY_ID / GA4_SERVICE_ACCOUNT_KEY_PATH) - falling back");
    }
    return null;
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.paths;

  try {
    const key = JSON.parse(readFileSync(keyPath, "utf8"));
    const token = await getAccessToken(key.client_email, key.private_key);
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: String(limit),
        }),
      }
    );
    if (!res.ok) throw new Error(`GA runReport failed: ${res.status}`);
    const data = await res.json();
    const paths = (data.rows ?? []).map((row: any) => ({
      path: row.dimensionValues[0].value as string,
      views: Number(row.metricValues[0].value),
    }));
    cache = { paths, at: Date.now() };
    return paths;
  } catch (e) {
    console.error("GA4 top pages fetch failed:", e);
    // an expired cache still beats no data - popularity barely moves in hours
    return cache?.paths ?? null;
  }
}
