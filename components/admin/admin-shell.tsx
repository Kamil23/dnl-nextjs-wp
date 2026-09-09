import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

// Admin layout: stały sidebar na desktopie (pozycji zrobiło się za dużo na
// górny pasek), burger + wysuwany panel na mobile. Nawigacja w grupach.

type NavItem = { label: string; href: string; icon: string; activePrefixes?: string[] };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Treść",
    items: [
      { label: "Przepisy", href: "/admin", icon: "🍳", activePrefixes: ["/admin/przepisy"] },
      { label: "Import TikTok", href: "/admin/tiktok", icon: "🎬" },
      { label: "Backlog TikTok", href: "/admin/tiktok-backlog", icon: "🗂️" },
      { label: "Zamienniki", href: "/admin/zamienniki", icon: "🔁" },
    ],
  },
  {
    label: "Społeczność",
    items: [
      { label: "Oceny", href: "/admin/oceny", icon: "⭐" },
      { label: "Komentarze", href: "/admin/komentarze", icon: "💬" },
    ],
  },
  {
    label: "Dane",
    items: [
      { label: "Wyszukiwania", href: "/admin/szukania", icon: "🔍" },
      { label: "QC danych", href: "/admin/qc", icon: "✅" },
    ],
  },
  {
    label: "Marketing",
    items: [{ label: "Newsletter", href: "/admin/newsletter", icon: "💌" }],
  },
  {
    label: "System",
    items: [{ label: "Backupy", href: "/admin/backupy", icon: "🗄️" }],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (item.href !== "/admin" && pathname.startsWith(item.href + "/")) return true;
  return (item.activePrefixes ?? []).some((p) => pathname.startsWith(p));
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-[11px] uppercase tracking-wider text-gray-400">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-gray-900 text-white font-medium"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Zamknij drawer po każdej nawigacji (i zablokuj scroll tła, gdy otwarty)
  useEffect(() => {
    setOpen(false);
  }, [router.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const footer = (
    <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between text-sm">
      <Link href="/" target="_blank" className="text-gray-600 hover:text-gray-900">
        Zobacz stronę ↗
      </Link>
      <button onClick={logout} className="text-gray-600 hover:text-gray-900">
        Wyloguj
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>{`${title} - Panel Dieta na luzie`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Sidebar: desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-gray-200">
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/admin" className="font-Pacifico text-xl">
            dieta na luzie
          </Link>
        </div>
        <NavLinks pathname={router.pathname} />
        {footer}
      </aside>

      {/* Górny pasek: mobile */}
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setOpen(true)}
            aria-label="Otwórz menu"
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-700"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <Link href="/admin" className="font-Pacifico text-lg">
            dieta na luzie
          </Link>
          <span className="w-6" aria-hidden />
        </div>
      </header>

      {/* Drawer: mobile */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-Pacifico text-lg">dieta na luzie</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Zamknij menu"
                className="p-2 -mr-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                ✕
              </button>
            </div>
            <NavLinks pathname={router.pathname} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
      </main>
    </div>
  );
}
