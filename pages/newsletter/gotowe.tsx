import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { eq } from "drizzle-orm";
import Container from "../../components/container";
import Layout from "../../components/layout";
import { MENU_EDGES } from "../../lib/menu";
import { MAGNETS } from "../../lib/server/newsletter";

type Props = {
  state: "confirmed" | "unsubscribed" | "error";
  magnetTitle: string | null;
  magnetFile: string | null;
};

// Landing for the double opt-in flow: confirmation (with the magnet download),
// unsubscribe farewell and invalid-link fallback. Never indexed.
export default function NewsletterGotowe({ state, magnetTitle, magnetFile }: Props) {
  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>Newsletter - Dieta na luzie</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Container>
        <section className="min-h-[52vh] flex flex-col items-center justify-center text-center py-24">
          {state === "confirmed" ? (
            <>
              <p className="text-4xl mb-4">🎉</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Zapis potwierdzony!
              </h1>
              {magnetFile ? (
                <>
                  <p className="text-gray-500 max-w-md mb-8">
                    Twój prezent jest gotowy. Wysłałam Ci go też mailem, żeby nie zginął.
                  </p>
                  <a
                    href={magnetFile}
                    className="rounded-full bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    Pobierz PDF: {magnetTitle}
                  </a>
                </>
              ) : (
                <p className="text-gray-500 max-w-md mb-8">
                  {magnetTitle
                    ? "Jesteś na liście oczekujących Planera. Odezwę się, gdy będzie gotowy do testów!"
                    : "Od teraz będziesz dostawać nowe przepisy i sezonowe pomysły prosto na maila."}
                </p>
              )}
              <Link href="/przepisy/" className="mt-8 text-sm text-gray-500 underline hover:text-gray-900">
                Przeglądaj przepisy
              </Link>
            </>
          ) : state === "unsubscribed" ? (
            <>
              <p className="text-4xl mb-4">👋</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Wypisano z newslettera
              </h1>
              <p className="text-gray-500 max-w-md mb-8">
                Szkoda, ale rozumiem. Przepisy i tak zawsze znajdziesz na stronie.
                Gdybyś zmieniła zdanie, zapis jest w stopce.
              </p>
              <Link
                href="/"
                className="rounded-full bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Strona główna
              </Link>
            </>
          ) : (
            <>
              <p className="text-4xl mb-4">🤔</p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Ten link nie działa
              </h1>
              <p className="text-gray-500 max-w-md mb-8">
                Link potwierdzający mógł wygasnąć albo został już użyty w inny sposób.
                Zapisz się jeszcze raz, a wyślemy nowy.
              </p>
              <Link
                href="/"
                className="rounded-full bg-gray-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Strona główna
              </Link>
            </>
          )}
        </section>
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ query }) => {
  if (query.w) return { props: { state: "unsubscribed", magnetTitle: null, magnetFile: null } };
  const token = String(query.t || "");
  if (!/^[0-9a-f]{48}$/.test(token)) {
    return { props: { state: "error", magnetTitle: null, magnetFile: null } };
  }
  const { db, dbSchema } = await import("../../lib/db");
  const [sub] = await db
    .select()
    .from(dbSchema.subscribers)
    .where(eq(dbSchema.subscribers.token, token));
  if (!sub || sub.status !== "confirmed") {
    return { props: { state: "error", magnetTitle: null, magnetFile: null } };
  }
  const m = sub.magnet ? MAGNETS[sub.magnet] : null;
  return {
    props: {
      state: "confirmed",
      magnetTitle: m?.title ?? null,
      magnetFile: m?.file ?? null,
    },
  };
};
