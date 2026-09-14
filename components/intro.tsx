import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SITE_TITLE, SITE_DESCRIPTION, SAVED_EVENT } from "../lib/constants";
import { itemCount, SHOPPING_EVENT } from "../lib/shopping-list";
import { CartIcon } from "./icons";
import { CATEGORIES } from "../lib/enum";

export default function Intro({ menu }) {
  const title = SITE_TITLE.toLowerCase();
  const desc = SITE_DESCRIPTION.toLowerCase();
  // Logo may only be the H1 on the homepage - on articles the recipe
  // title owns the H1 (two H1s dilute the page's main heading for SEO)
  const isHome = useRouter().pathname === "/";
  const LogoTag = (isHome ? "h1" : "p") as any;
  const SubTag = (isHome ? "h2" : "p") as any;
  return (
    <div className="flex-column justify-between items-center relative print:hidden">
      <Link href={"/"} className="flex flex-col mt-4 mb-2">
        <LogoTag className="text-center text-4xl md:text-6xl font-bold font-Pacifico tracking-tighter leading-tight">
          {title}
        </LogoTag>
        <SubTag className="text-center font-Marck-script text-lg mt-2">
          {desc}
        </SubTag>
      </Link>
      <nav className="flex flex-wrap items-center justify-center gap-x-1 md:gap-x-4 mb-6 pb-3 border-b border-gray-100">
        <WPMenu menu={menu} />
        <ShoppingListLink />
      </nav>
    </div>
  );
}

// Downloads has no content worth surfacing - hidden until there is a plan for it
const HIDDEN_MENU_IDS: string[] = [CATEGORIES.DOWNLOADS];

const WPMenu = ({ menu }) => {
  const { asPath } = useRouter();
  return menu?.map((item) => {
    const { parentId, path, id, label } = item.node;
    if (parentId || HIDDEN_MENU_IDS.includes(id)) return null;
    const isActive = path !== "/" && asPath.startsWith(path);
    // "Zapisane" gets a heart + live count instead of a plain link
    if (path === "/moje-przepisy/") {
      return <SavedNavLink key={id} isActive={isActive} label={label} />;
    }
    return (
      <Link
        href={path}
        key={id}
        className={`px-3 py-3 text-sm tracking-wide transition-colors border-b-2 ${
          isActive
            ? "text-gray-900 border-amber-500 font-medium"
            : "text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-200"
        }`}
      >
        {label}
      </Link>
    );
  });
};

// "Zapisane" w nawigacji: serce spójne z przyciskiem "Zapisz przepis" plus
// licznik zapisanych. Stan czytany PO montażu (SSR i pierwszy render klienta
// pokazują ♡ bez liczby - zero hydration mismatch), odświeżany po zapisie.
const SavedNavLink = ({ isActive, label }: { isActive: boolean; label: string }) => {
  const [state, setState] = useState<{ loggedIn: boolean; count: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetch("/api/zapisane")
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setState({ loggedIn: !!d.loggedIn, count: Array.isArray(d.ids) ? d.ids.length : 0 });
          }
        })
        .catch(() => {});
    refresh();
    window.addEventListener(SAVED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(SAVED_EVENT, refresh);
    };
  }, []);
  const loggedIn = state?.loggedIn ?? false;
  const count = state?.count ?? 0;
  return (
    <Link
      href="/moje-przepisy/"
      className={`relative px-3 py-3 text-sm tracking-wide transition-colors border-b-2 inline-flex items-center gap-1.5 ${
        isActive
          ? "text-gray-900 border-amber-500 font-medium"
          : "text-gray-600 border-transparent hover:text-gray-900 hover:border-gray-200"
      }`}
    >
      <span aria-hidden className={loggedIn ? "text-amber-500" : "text-gray-400"}>
        {loggedIn ? "♥" : "♡"}
      </span>
      {label}
      {loggedIn && count > 0 && (
        <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
          {count}
        </span>
      )}
    </Link>
  );
};

// Count is read from localStorage AFTER mount (SSR renders no badge) -
// deciding during render would cause a hydration mismatch
const ShoppingListLink = () => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(itemCount());
    refresh();
    window.addEventListener(SHOPPING_EVENT, refresh);
    return () => window.removeEventListener(SHOPPING_EVENT, refresh);
  }, []);
  return (
    <Link
      className="relative ml-1 md:ml-2 my-2 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
      href="/lista-zakupow/"
    >
      <CartIcon className="w-4 h-4" />
      <span>Listy zakupów</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {count}
        </span>
      )}
    </Link>
  );
};
