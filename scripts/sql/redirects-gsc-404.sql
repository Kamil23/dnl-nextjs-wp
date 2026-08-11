-- Przekierowania dla 404-ek z GSC (sierpień 2026). Idempotentne — można
-- puszczać wielokrotnie: psql "$DATABASE_URL" -f scripts/sql/redirects-gsc-404.sql
--
-- pierniki: przepis istnieje, ale pod URI z segmentem kategorii /wypieki/
-- warianty -2: ślady po kolizjach slugów przy ponownym imporcie z TikToka;
-- cele bez -2 zaczną odpowiadać, gdy te przepisy (dziś draft) zostaną
-- opublikowane — do tego czasu redirect prowadzi na 404, co jest OK.
insert into redirects (source_path, target_path, permanent) values
  ('/przepisy/pierniki-pierniczki-najlepszy-przepis/', '/przepisy/wypieki/pierniki-pierniczki-najlepszy-przepis/', true),
  ('/przepisy/sernik-kinder-czekolada-2/', '/przepisy/sernik-kinder-czekolada/', true),
  ('/przepisy/sernik-z-nutella-bez-pieczenia-2/', '/przepisy/sernik-z-nutella-bez-pieczenia/', true)
on conflict (source_path) do update
  set target_path = excluded.target_path, permanent = excluded.permanent;
