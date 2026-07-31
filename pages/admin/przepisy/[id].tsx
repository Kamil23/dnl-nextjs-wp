import { GetServerSideProps } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import AdminShell from "../../../components/admin/admin-shell";
import { isAdminRequest } from "../../../lib/admin-auth";
import { getRecipeById, listAllCategories } from "../../../lib/queries";

const inputCls =
  "mt-1 border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";
const labelCls = "block text-sm text-gray-700";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function RecipeEditor({ initial, allCategories }) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    title: initial.title ?? "",
    slug: initial.slug ?? "",
    uri: initial.uri ?? "",
    status: initial.status ?? "draft",
    lead: initial.lead ?? "",
    contentHtml: initial.contentHtml ?? "",
    heroImage: initial.heroImage ?? "",
    videoUrl: initial.videoUrl ?? "",
    prepTimeMin: initial.prepTimeMin ?? "",
    totalTimeMin: initial.totalTimeMin ?? "",
    servings: initial.servings ?? "",
    difficulty: initial.difficulty ?? "",
    kcal: initial.kcal ?? "",
    protein: initial.protein ?? "",
    fat: initial.fat ?? "",
    carbs: initial.carbs ?? "",
    keywords: initial.keywords ?? "",
    seoTitle: initial.seoTitle ?? "",
    seoDescription: initial.seoDescription ?? "",
    ingredientGroups: initial.ingredientGroups?.length
      ? initial.ingredientGroups
      : [{ title: "", items: [""] }],
    steps: initial.steps?.length
      ? initial.steps.map((s) => ({ title: s.title ?? "", body: s.body ?? "", tip: s.tip ?? "", image: s.image ?? "" }))
      : [{ title: "", body: "", tip: "", image: "" }],
    categoryIds: initial.categories?.map((c) => c.id) ?? [],
    tags: initial.tags?.map((t) => t.name) ?? [],
  }));
  const [tagsText, setTagsText] = useState(form.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  function setGroup(gi: number, patch: any) {
    const groups = [...form.ingredientGroups];
    groups[gi] = { ...groups[gi], ...patch };
    set("ingredientGroups", groups);
  }
  function setStep(si: number, patch: any) {
    const stepsArr = [...form.steps];
    stepsArr[si] = { ...stepsArr[si], ...patch };
    set("steps", stepsArr);
  }
  function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const copy = [...arr];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  async function save(statusOverride?: string) {
    setSaving(true);
    setMessage(null);
    const payload = {
      ...form,
      status: statusOverride ?? form.status,
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const res = await fetch(`/api/admin/recipes/${initial.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      set("status", updated.status);
      setMessage({ ok: true, text: "Zapisano ✓" });
    } else {
      const err = await res.json().catch(() => ({}));
      setMessage({ ok: false, text: err.error || "Błąd zapisu" });
    }
  }

  async function remove() {
    if (!confirm(`Usunąć przepis „${form.title}"? Tej operacji nie można cofnąć.`)) return;
    const res = await fetch(`/api/admin/recipes/${initial.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  }

  return (
    <AdminShell title={form.title || "Edycja przepisu"}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
            ← Wróć do listy
          </Link>
          <h1 className="text-2xl font-bold">{form.title || "Nowy przepis"}</h1>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </span>
          )}
          <Link href={`/admin/przepisy/${initial.id}/podglad`} target="_blank" className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-2">
            Podgląd ↗
          </Link>
          {form.status === "published" && (
            <Link href={form.uri} target="_blank" className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-4 py-2">
              Na stronie ↗
            </Link>
          )}
          <button
            onClick={() => save()}
            disabled={saving}
            className="border border-gray-900 rounded-lg px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
          {form.status !== "published" && (
            <button
              onClick={() => save("published")}
              disabled={saving}
              className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              Opublikuj
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Section title="Podstawy">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`${labelCls} sm:col-span-2`}>
                Tytuł
                <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Slug
                <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                URL (nie zmieniaj dla starych przepisów!)
                <input value={form.uri} onChange={(e) => set("uri", e.target.value)} className={inputCls} />
              </label>
              <label className={`${labelCls} sm:col-span-2`}>
                Lead (krótki opis)
                <textarea value={form.lead} onChange={(e) => set("lead", e.target.value)} rows={2} className={inputCls} />
              </label>
            </div>
          </Section>

          <Section title="Składniki">
            {form.ingredientGroups.map((g, gi) => (
              <div key={gi} className="mb-4 border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex gap-2 mb-2">
                  <input
                    value={g.title ?? ""}
                    onChange={(e) => setGroup(gi, { title: e.target.value })}
                    placeholder="Nazwa sekcji (np. Ciasto) — opcjonalna"
                    className={`${inputCls} mt-0 flex-1`}
                  />
                  <button
                    onClick={() => set("ingredientGroups", form.ingredientGroups.filter((_, i) => i !== gi))}
                    className="text-red-400 hover:text-red-600 text-sm px-2"
                    title="Usuń sekcję"
                  >
                    ✕
                  </button>
                </div>
                {g.items.map((item, ii) => (
                  <div key={ii} className="flex gap-2 mb-2">
                    <input
                      value={item}
                      onChange={(e) =>
                        setGroup(gi, { items: g.items.map((x, i) => (i === ii ? e.target.value : x)) })
                      }
                      placeholder="np. pół szklanki płatków owsianych"
                      className={`${inputCls} mt-0 flex-1`}
                    />
                    <button onClick={() => setGroup(gi, { items: move(g.items, ii, -1) })} className="text-gray-400 hover:text-gray-700">↑</button>
                    <button onClick={() => setGroup(gi, { items: move(g.items, ii, 1) })} className="text-gray-400 hover:text-gray-700">↓</button>
                    <button
                      onClick={() => setGroup(gi, { items: g.items.filter((_, i) => i !== ii) })}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setGroup(gi, { items: [...g.items, ""] })}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  + składnik
                </button>
              </div>
            ))}
            <button
              onClick={() => set("ingredientGroups", [...form.ingredientGroups, { title: "", items: [""] }])}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              + sekcja składników
            </button>
          </Section>

          <Section title="Kroki przygotowania">
            {form.steps.map((s, si) => (
              <div key={si} className="mb-4 border border-gray-100 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500">Krok {si + 1}</span>
                  <div className="flex gap-2">
                    <button onClick={() => set("steps", move(form.steps, si, -1))} className="text-gray-400 hover:text-gray-700">↑</button>
                    <button onClick={() => set("steps", move(form.steps, si, 1))} className="text-gray-400 hover:text-gray-700">↓</button>
                    <button onClick={() => set("steps", form.steps.filter((_, i) => i !== si))} className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                </div>
                <input
                  value={s.title}
                  onChange={(e) => setStep(si, { title: e.target.value })}
                  placeholder="Nazwa kroku (np. Owsianka) — opcjonalna"
                  className={`${inputCls} mt-0 mb-2`}
                />
                <textarea
                  value={s.body}
                  onChange={(e) => setStep(si, { body: e.target.value })}
                  placeholder="Opis kroku..."
                  rows={2}
                  className={`${inputCls} mt-0 mb-2`}
                />
                <input
                  value={s.tip}
                  onChange={(e) => setStep(si, { tip: e.target.value })}
                  placeholder="💡 Tip — opcjonalny"
                  className={`${inputCls} mt-0`}
                />
              </div>
            ))}
            <button
              onClick={() => set("steps", [...form.steps, { title: "", body: "", tip: "", image: "" }])}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              + krok
            </button>
          </Section>

          <Section title="Treść artykułu (wstęp/historia — HTML)">
            <textarea
              value={form.contentHtml}
              onChange={(e) => set("contentHtml", e.target.value)}
              rows={10}
              className={`${inputCls} font-mono text-xs`}
            />
          </Section>
        </div>

        <div>
          <Section title="Publikacja">
            <label className={labelCls}>
              Status
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                <option value="draft">Szkic</option>
                <option value="review">Do akceptacji</option>
                <option value="published">Opublikowany</option>
              </select>
            </label>
            <div className="mt-4 text-xs text-gray-400">
              Źródło: {initial.source} · ID: {initial.id}
              {initial.rating && (
                <div className="mt-1">Ocena: ★ {initial.rating.value} ({initial.rating.count} głosów)</div>
              )}
            </div>
          </Section>

          <Section title="Media">
            <label className={labelCls}>
              Zdjęcie główne (URL)
              <input value={form.heroImage} onChange={(e) => set("heroImage", e.target.value)} className={inputCls} />
            </label>
            {form.heroImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.heroImage} alt="" className="mt-3 rounded-lg max-h-40 object-cover w-full" />
            )}
            <label className={`${labelCls} mt-4`}>
              Wideo (TikTok URL)
              <input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} className={inputCls} placeholder="https://www.tiktok.com/@..." />
            </label>
          </Section>

          <Section title="Parametry">
            <div className="grid grid-cols-2 gap-3">
              <label className={labelCls}>
                Przygotowanie (min)
                <input inputMode="numeric" value={form.prepTimeMin} onChange={(e) => set("prepTimeMin", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Łącznie (min)
                <input inputMode="numeric" value={form.totalTimeMin} onChange={(e) => set("totalTimeMin", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Porcje
                <input inputMode="numeric" value={form.servings} onChange={(e) => set("servings", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Trudność
                <select value={form.difficulty ?? ""} onChange={(e) => set("difficulty", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="latwy">Łatwy</option>
                  <option value="sredni">Średni</option>
                  <option value="trudny">Trudny</option>
                </select>
              </label>
              <label className={labelCls}>
                Kcal / porcja
                <input inputMode="numeric" value={form.kcal} onChange={(e) => set("kcal", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Białko (g)
                <input inputMode="decimal" value={form.protein} onChange={(e) => set("protein", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Tłuszcz (g)
                <input inputMode="decimal" value={form.fat} onChange={(e) => set("fat", e.target.value)} className={inputCls} />
              </label>
              <label className={labelCls}>
                Węgle (g)
                <input inputMode="decimal" value={form.carbs} onChange={(e) => set("carbs", e.target.value)} className={inputCls} />
              </label>
            </div>
          </Section>

          <Section title="Kategorie i tagi">
            <div className="space-y-1 mb-4">
              {allCategories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      set(
                        "categoryIds",
                        e.target.checked
                          ? [...form.categoryIds, c.id]
                          : form.categoryIds.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {c.parentId ? `— ${c.name}` : c.name}
                </label>
              ))}
            </div>
            <label className={labelCls}>
              Tagi (po przecinku)
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputCls} />
            </label>
          </Section>

          <Section title="SEO">
            <label className={labelCls}>
              Tytuł SEO
              <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputCls} />
              <span className={`text-xs ${form.seoTitle.length > 60 ? "text-red-500" : "text-gray-400"}`}>
                {form.seoTitle.length}/60
              </span>
            </label>
            <label className={`${labelCls} mt-3`}>
              Opis SEO
              <textarea value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} rows={3} className={inputCls} />
              <span className={`text-xs ${form.seoDescription.length > 160 ? "text-red-500" : "text-gray-400"}`}>
                {form.seoDescription.length}/160
              </span>
            </label>
            <label className={`${labelCls} mt-3`}>
              Słowa kluczowe
              <input value={form.keywords} onChange={(e) => set("keywords", e.target.value)} className={inputCls} />
            </label>
            <div className="mt-4 border border-gray-200 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Podgląd snippetu Google:</div>
              <div className="text-blue-800 text-base leading-tight truncate">
                {form.seoTitle || `${form.title} - Dieta na luzie`}
              </div>
              <div className="text-green-700 text-xs">dietanaluzie.pl{form.uri}</div>
              <div className="text-gray-600 text-xs line-clamp-2">{form.seoDescription || form.lead}</div>
            </div>
          </Section>

          <button onClick={remove} className="text-sm text-red-500 hover:text-red-700 mb-12">
            Usuń przepis
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ req, params }) => {
  if (!isAdminRequest(req)) {
    return { redirect: { destination: "/admin/login", permanent: false } };
  }
  const id = parseInt(params.id as string, 10);
  if (!Number.isInteger(id)) return { notFound: true };
  const [recipe, allCategories] = await Promise.all([
    getRecipeById(id),
    listAllCategories(),
  ]);
  if (!recipe) return { notFound: true };
  return {
    props: {
      initial: JSON.parse(JSON.stringify(recipe)),
      allCategories: JSON.parse(JSON.stringify(allCategories)),
    },
  };
};
