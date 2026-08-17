-- Czystka po subscription bombingu (od 12 sierpnia 2026 ~11:50 UTC): boty
-- zapisywały cudze/jednorazowe adresy przez formularz w stopce (~40/dzień),
-- widoczne sygnatury: gmailowy dot-trick, losowe loginy na domenach
-- jednorazowych, firmowe skrzynki ofiar. Usuwamy tylko niepotwierdzone wpisy
-- ze stopki z okna ataku; adresy .pl zostają (jedyny realny pending ze stopki
-- to roksana@dietanaluzie.pl, sprzed ataku). Wypisani (unsubscribed) zostają
-- jako lista supresyjna. Idempotentne:
--   docker compose exec -T db psql -U dnl dietanaluzie < scripts/sql/czystka-bot-pending.sql
delete from subscribers
where status = 'pending'
  and source = 'stopka'
  and consented_at >= '2026-08-12'
  and email not like '%.pl';
