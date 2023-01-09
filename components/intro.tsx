import Link from "next/link";
import { SITE_TITLE, SITE_DESCRIPTION } from "../lib/constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBook, faNewspaper, faCalculator, faDownload } from "@fortawesome/free-solid-svg-icons";
import { faInstagram, faTiktok } from "@fortawesome/free-brands-svg-icons";
import { CATEGORIES } from "../lib/enum";

export default function Intro({ menu }) {
  const title = SITE_TITLE.toLowerCase();
  const desc = SITE_DESCRIPTION.toLowerCase();
  return (
    <div className="flex-column justify-between items-center relative">
      <Link href={"/"} className="flex flex-col mt-4 mb-2">
        <h1 className="text-center text-4xl md:text-6xl font-bold font-Pacifico tracking-tighter leading-tight">
          {title}
        </h1>
        <h4 className="text-center font-Marck-script text-lg mt-2">
          {desc}
        </h4>
      </Link>
      <nav className="flex flex-wrap mb-4 box-border justify-center border-b">
        <WPMenu menu={menu} />
        <SocialMenu items={socialItems} />
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
