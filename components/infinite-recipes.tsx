import { useEffect, useRef, useState } from "react";
import MoreStories from "./more-stories";
import Pagination from "./pagination";

// SEO keeps the classic /page/N/ pagination — the initial HTML carries the
// crawlable Pagination links for the SSR'd page. Users get infinite scroll:
// when the sentinel nears the viewport the next page is fetched from
// /api/przepisy and its tiles are appended; the URL follows via replaceState
// so a reload/share lands on the matching static page.
export default function InfiniteRecipes({
  initialPosts,
  startPage,
  totalPages,
  basePath,
  categoryUri = null,
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(startPage);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPosts(initialPosts);
    setPage(startPage);
  }, [initialPosts, startPage]);

  useEffect(() => {
    if (page >= totalPages || !sentinelRef.current) return;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        try {
          const next = page + 1;
          const kategoria = categoryUri
            ? `&kategoria=${encodeURIComponent(categoryUri)}`
            : "";
          const res = await fetch(`/api/przepisy/?page=${next}${kategoria}`);
          if (!res.ok) return;
          const data = await res.json();
          setPosts((prev) => {
            const seen = new Set(prev.map((e) => e.node.uri));
            return [...prev, ...data.posts.filter((e) => !seen.has(e.node.uri))];
          });
          setPage(next);
          window.history.replaceState(null, "", `${basePath}page/${next}/`);
        } catch {
        } finally {
          loadingRef.current = false;
        }
      },
      { rootMargin: "800px" }
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [page, totalPages, basePath, categoryUri]);

  return (
    <>
      {posts.length > 0 && <MoreStories posts={posts} />}
      {page < totalPages && (
        <div ref={sentinelRef} className="-mt-24 mb-16 text-center text-sm text-gray-400">
          Ładowanie kolejnych przepisów…
        </div>
      )}
      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
    </>
  );
}
