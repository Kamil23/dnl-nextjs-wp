import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{`${title} - Panel Dieta na luzie`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-Pacifico text-xl">
              dieta na luzie
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/admin" className="hover:text-gray-900">Przepisy</Link>
              <Link href="/admin/oceny" className="hover:text-gray-900">Oceny</Link>
              <Link href="/admin/tiktok" className="hover:text-gray-900">Import TikTok</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" target="_blank" className="text-gray-600 hover:text-gray-900">
              Zobacz stronę ↗
            </Link>
            <button onClick={logout} className="text-gray-600 hover:text-gray-900">
              Wyloguj
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
