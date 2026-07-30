import Link from "next/link";

// basePath: "/" for the homepage, "/kategoria/przepisy/sniadania/" for archives
export default function Pagination({ basePath, page, totalPages }) {
  if (totalPages <= 1) return null;

  const pageHref = (n: number) => (n <= 1 ? basePath : `${basePath}page/${n}/`);

  return (
    <nav
      className="flex justify-center items-center gap-6 mb-16 text-gray-700"
      aria-label="Paginacja"
    >
      {page > 1 && (
        <Link href={pageHref(page - 1)} className="hover:underline">
          &larr; Poprzednia
        </Link>
      )}
      <span className="text-sm text-gray-500">
        Strona {page} z {totalPages}
      </span>
      {page < totalPages && (
        <Link href={pageHref(page + 1)} className="hover:underline">
          Następna &rarr;
        </Link>
      )}
    </nav>
  );
}
