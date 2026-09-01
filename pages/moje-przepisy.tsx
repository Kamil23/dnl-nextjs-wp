import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { useState } from "react";
import { and, desc, eq } from "drizzle-orm";
import Container from "../components/container";
import Layout from "../components/layout";
import MoreStories from "../components/more-stories";
import PostTitle from "../components/post-title";
import { MENU_EDGES } from "../lib/menu";
import { SITE_TITLE } from "../lib/constants";
import { db, dbSchema } from "../lib/db";
import { toListingEdge } from "../lib/queries";
import { getUserIdFromRequest } from "../lib/user-auth";

// Półka czytelnika: przepisy zapisane sercem. Strona jest noindex (prywatna
// lista, nieskończone warianty), logowanie przez magic link bez hasła.

type Props = {
  loggedIn: boolean;
  posts: any[];
  email: string | null;
  blad: boolean;
};

function LoginForm({ blad }: { blad: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/konto/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), next: "/moje-przepisy/" }),
      });
      if (!res.ok) throw new Error("send failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6">
        <p className="font-semibold">Sprawdź skrzynkę 📬</p>
        <p className="text-sm text-gray-600 mt-1">
          Wysłaliśmy Ci link do logowania. Kliknij go, a Twoje zapisane przepisy będą tu na
          Ciebie czekać. Link działa 15 minut.
        </p>
      </div>
    );
  }

  return (
    <>
      {blad && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-4 mb-4 text-sm text-red-700">
          Link wygasł albo był już użyty. Wyślij nowy.
        </div>
      )}
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6">
        <p className="font-bold tracking-tight text-lg">🧡 Zaloguj się bez hasła</p>
        <p className="text-sm text-gray-600 mt-1 mb-3">
          Podaj email, a wyślemy Ci link do logowania. Jeden klik i gotowe.
        </p>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.pl"
            className="flex-1 rounded-full border border-amber-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
          <button
            type="submit"
            disabled={state === "sending"}
            className="rounded-full bg-gray-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
          >
            {state === "sending" ? "Wysyłam…" : "Wyślij link"}
          </button>
        </form>
        {state === "error" && (
          <p className="text-sm text-red-600 mt-2">Nie udało się wysłać. Spróbuj ponownie.</p>
        )}
      </div>
    </>
  );
}

export default function MyRecipes({ loggedIn, posts, email, blad }: Props) {
  async function logout() {
    try {
      await fetch("/api/konto/wyloguj", { method: "POST" });
    } catch {}
    window.location.href = "/";
  }

  return (
    <Layout menu={MENU_EDGES} preview={false}>
      <Head>
        <title>{`Moje przepisy - ${SITE_TITLE}`}</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Container>
        {!loggedIn ? (
          <article className="max-w-xl mx-auto mb-24">
            <PostTitle>Moje przepisy</PostTitle>
            <p className="text-gray-600 mb-8">
              Zapisuj ulubione przepisy sercem i miej je zawsze pod ręką: na zakupach, w
              kuchni i przy planowaniu tygodnia.
            </p>
            <LoginForm blad={blad} />
          </article>
        ) : (
          <>
            <PostTitle>Moje przepisy</PostTitle>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-10">
              <p className="text-sm text-gray-500">
                Zalogowano jako <span className="font-medium text-gray-700">{email}</span>
              </p>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:border-gray-400 transition"
              >
                Wyloguj
              </button>
            </div>
            {posts.length > 0 ? (
              <MoreStories posts={posts} />
            ) : (
              <div className="max-w-xl mx-auto rounded-2xl border border-gray-200 shadow-small p-8 text-center mb-24">
                <p className="text-lg font-semibold mb-2">Nie masz jeszcze zapisanych przepisów</p>
                <p className="text-sm text-gray-600 mb-5">
                  Kliknij serce przy dowolnym przepisie, a znajdziesz go tutaj.
                </p>
                <Link
                  href="/kategoria/przepisy/"
                  className="inline-block rounded-full bg-gray-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-700"
                >
                  Przeglądaj przepisy
                </Link>
              </div>
            )}
          </>
        )}
      </Container>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
  const blad = query.blad === "link";
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return { props: { loggedIn: false, posts: [], email: null, blad } };
  }

  const { users, recipes, savedRecipes } = dbSchema;
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    // Ważny podpis, ale konto już nie istnieje - pokaż widok logowania
    return { props: { loggedIn: false, posts: [], email: null, blad } };
  }

  const rows = await db
    .select({ recipe: recipes })
    .from(savedRecipes)
    .innerJoin(recipes, eq(recipes.id, savedRecipes.recipeId))
    .where(and(eq(savedRecipes.userId, userId), eq(recipes.status, "published")))
    .orderBy(desc(savedRecipes.createdAt));

  return {
    props: {
      loggedIn: true,
      posts: rows.map((r) => toListingEdge(r.recipe)),
      email: user.email,
      blad,
    },
  };
};
