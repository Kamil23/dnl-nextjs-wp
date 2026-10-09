// Konwersja między prostym HTML sekcji "Kilka słów o tym przepisie" a tekstem
// (akapity rozdzielone pustą linią). Import TikTok zapisuje about jako <p>;
// stare przepisy z WP mają bogatszy HTML, którego nie da się bezstratnie
// zamienić na tekst - isSimpleParagraphHtml() mówi, czy edycja tekstowa jest
// bezpieczna. Czysty moduł: używany w API, skryptach i w przeglądarce.

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Akapity rozdzielone pustą linią -> <p>...</p>, pojedyncze złamania -> <br/>
export function textToHtml(text: string | null | undefined): string | null {
  if (typeof text !== "string" || !text.trim()) return null;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

// true, gdy HTML składa się wyłącznie z akapitów <p> (z ewentualnym <br/>,
// <strong>, <em>) - wtedy można go edytować jako tekst i zapisać z powrotem
export function isSimpleParagraphHtml(html: string | null | undefined): boolean {
  if (!html || !html.trim()) return true;
  const stripped = html
    .replace(/<\/?p>/gi, "")
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<\/?(strong|em|b|i)>/gi, "")
    .replace(/\s+/g, " ");
  return !/<[^>]+>/.test(stripped);
}
