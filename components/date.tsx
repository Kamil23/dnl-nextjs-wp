// Intl covers the one format we need ("3 sierpnia 2026") - no date-fns
export default function Date({ dateString }) {
  const formatted = new globalThis.Date(dateString).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return <time dateTime={dateString}>{formatted}</time>;
}
