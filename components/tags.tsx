import Link from "next/link";

export default function Tags({ tags }) {
  return (
    <div className="max-w-2xl mx-auto print:hidden">
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Tagi:</span>
        {tags.edges.map(({ node }) => (
          <Link
            key={node.slug ?? node.name}
            href={node.slug ? `/tag/${node.slug}/` : "#"}
            className="text-sm bg-gray-100 hover:bg-amber-100 text-gray-700 rounded-full px-3 py-1 transition"
          >
            #{node.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
