import Link from "next/link";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Breadcrumbs({ categories, title }) {
  debugger;
  const parentCategory = categories.find((cat) => !cat.node.parentId);
  const [childCategory] = categories.filter((cat) => cat.node.parentId);
  debugger;
  return (
    <div className="mt-8 flex space-x-1 items-center">
      <Link href={"/"} className="text-sm">
        Strona główna
      </Link>
      <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
      {parentCategory ? (
        <>
          <Link href={parentCategory.node.uri} className="text-sm">
            {parentCategory.node.name}
          </Link>
          <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
        </>
      ) : null}
      {childCategory ? (
        <>
          <Link href={childCategory.node.uri} className="text-sm">
            {childCategory.node.name}
          </Link>
          <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
        </>
      ) : null}

      <span className="text-sm">{title}</span>
    </div>
  );
}
