import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SITE_TITLE, SITE_DESCRIPTION } from "../lib/constants";
import { itemCount, SHOPPING_EVENT } from "../lib/shopping-list";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook, faNewspaper, faCalculator, faDownload } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faTiktok } from "@fortawesome/free-brands-svg-icons";
import { CATEGORIES } from "../lib/enum";

export default function Intro({ menu }) {
  const title = SITE_TITLE.toLowerCase();
  const desc = SITE_DESCRIPTION.toLowerCase();
  // Logo may only be the H1 on the homepage — on articles the recipe
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
      <nav className="flex flex-wrap mb-4 box-border justify-center border-b">
        <WPMenu menu={menu} />
        <SocialMenu items={socialItems} />
        <ShoppingListLink />
      </nav>
    </div>
  );
}

const iconsMap = {
  [CATEGORIES.RECIPES]: faBook,
  [CATEGORIES.ARTICLES]: faNewspaper,
  [CATEGORIES.CALC]: faCalculator,
  [CATEGORIES.DOWNLOADS]: faDownload,
}

const WPMenu = ({ menu }) => {
  return menu?.map((item) => {
    const { parentId, path, id, label } = item.node;
    if (!parentId) {
      return (
        <Link className="flex flex-col-reverse mr-4 p-2 md:p-4 transition justify-center items-center w-fit text-sm text-gray-600 hover:text-gray-900 border-b border-b-white hover:border-b-gray-300" href={path} key={id}>
          <span className="mt-2 text-center">{label}</span>
          <FontAwesomeIcon icon={iconsMap[id]} className="w-6 h-6" />
        </Link>
      );
    }
  });
};

// Count is read from localStorage AFTER mount (SSR renders no badge) —
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
      className="relative flex flex-col-reverse mr-4 p-2 md:p-4 transition justify-center items-center w-fit text-sm text-gray-600 hover:text-gray-900 border-b border-b-white hover:border-b-gray-300"
      href="/lista-zakupow/"
    >
      <span className="mt-2 text-center">Lista zakupów</span>
      <span className="text-xl leading-6" aria-hidden>🛒</span>
      {count > 0 && (
        <span className="absolute top-1 right-0 bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {count}
        </span>
      )}
    </Link>
  );
};

const SocialMenu = ({ items }) => {
  return items.map((item) => {
    const { icon, link, id, label } = item;
      return (
        <Link className="flex flex-col-reverse mr-4 p-2 md:p-4 transition justify-center items-center w-fit text-sm text-gray-600 hover:text-gray-900 border-b border-b-white hover:border-b-gray-300" href={link} target="_blank" key={id}>
          <span className="mt-2 text-center">{label}</span>
          <FontAwesomeIcon icon={icon} className="w-6 h-6" />
        </Link>
      );
  });
};

const socialItems = [
  {
    id: 1,
    label: "Tiktok",
    link: "https://tiktok.com",
    icon: faTiktok
  },
  {
    id: 2,
    label: "Instagram",
    link: "https://instagram.com",
    icon: faInstagram
  },
]
