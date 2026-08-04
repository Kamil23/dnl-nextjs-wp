import { useState } from "react";

// Clearly-marked paid collaboration box with a copyable discount code.
// The "Współpraca reklamowa" label is a legal requirement — keep it visible.
export default function SponsorCard({ sponsor }: { sponsor: { brand: string; code?: string | null; note?: string | null } | null }) {
  const [copied, setCopied] = useState(false);
  if (!sponsor?.brand) return null;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(sponsor!.code!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <aside className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 print:hidden">
      <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
        Współpraca reklamowa
      </div>
      <p className="text-sm text-gray-700">
        Przepis powstał we współpracy z <strong>{sponsor.brand}</strong>
        {sponsor.note ? <>: {sponsor.note}</> : null}
      </p>
      {sponsor.code && (
        <button
          onClick={copyCode}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-2 font-mono font-bold text-amber-900 hover:bg-amber-100 transition"
          title="Kliknij, aby skopiować kod"
        >
          {sponsor.code}
          <span className="text-xs font-sans font-normal text-amber-700">
            {copied ? "✓ skopiowano" : "kopiuj"}
          </span>
        </button>
      )}
    </aside>
  );
}
