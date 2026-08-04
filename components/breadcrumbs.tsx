import Link from "next/link";
import { ChevronRightIcon } from "./icons";

export default function Breadcrumbs({ categories, title }) {
  const parentCategory = categories.find((cat) => !cat.node.parentId);
  const [childCategory] = categories.filter((cat) => cat.node.parentId);
  return (
    <div className="mt-8 flex space-x-1 items-center">
      <Link href={"/"} className="text-sm">
        Strona główna
      </Link>
      <ChevronRightIcon className="w-3 h-3 text-gray-400" />
      {parentCategory ? (
        <>
          <Link href={parentCategory.node.uri} className="text-sm">
            {parentCategory.node.name}
          </Link>
          <ChevronRightIcon className="w-3 h-3 text-gray-400" />
        </>
      ) : null}
      {childCategory ? (
        <>
          <Link href={childCategory.node.uri} className="text-sm">
            {childCategory.node.name}
          </Link>
          <ChevronRightIcon className="w-3 h-3 text-gray-400" />
        </>
      ) : null}

      <span className="text-sm">{title}</span>
    </div>
  );
}
