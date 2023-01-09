import Link from "next/link";

export default function Categories({ categories }) {
  return (
    <span className="flex flex-wrap">
      {categories.edges.length > 0 ? (
        categories.edges.map((category, index) => (
          <Link href={category.node.uri} key={index} className="[&:not(:first-of-type)]:ml-1 text-sm bg-[#bb3b45] text-white px-4 py-2 rounded">
            {category.node.name}
          </Link>
        ))
      ) : (
        <span className="ml-1">{categories.edges.node.name}</span>
      )}
    </span>
  )
}
