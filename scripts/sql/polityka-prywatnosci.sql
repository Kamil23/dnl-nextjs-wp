-- Nowa polityka prywatności (2026-08-06): opisuje realne przetwarzanie
-- (newsletter/Resend, oceny, listy zakupów, GA4, logi/Hetzner), bez AdSense,
-- administrator bez adresu fizycznego. Uruchom na dowolnym środowisku:
--   docker compose exec -T db psql -U dnl dietanaluzie < scripts/sql/polityka-prywatnosci.sql
UPDATE pages SET updated_at = now(), content_html = $POLICY$
<p><em>Ostatnia aktualizacja: 6 sierpnia 2026</em></p>

<h2>1. Informacje ogólne</h2>
<p>Niniejsza polityka dotyczy serwisu <strong>dietanaluzie.pl</strong> (dalej: Serwis).</p>
<p>Administratorem danych osobowych jest <strong>Kamil Cieplicki</strong>. W każdej sprawie dotyczącej Twoich danych napisz na adres: <a href="mailto:kontakt@dietanaluzie.pl">kontakt@dietanaluzie.pl</a>.</p>
<p>Serwis nie wyświetla reklam, nie sprzedaje danych i nie buduje profili marketingowych. Zbieramy tylko to, co jest potrzebne do działania opisanych niżej funkcji.</p>

<h2>2. Jakie dane przetwarzamy i po co</h2>

<h3>Newsletter</h3>
<p>Jeśli zapiszesz się na newsletter, przetwarzamy Twój adres e-mail oraz informację o miejscu i dacie zapisu (dowód zgody). Zapis wymaga potwierdzenia kliknięciem w link (double opt-in). Podstawa prawna: Twoja zgoda (art. 6 ust. 1 lit. a RODO). Dane przechowujemy do momentu wypisania się: link do rezygnacji znajdziesz w stopce każdej wiadomości, a wypis działa natychmiast.</p>

<h3>Oceny przepisów</h3>
<p>Przy oddaniu głosu zapisujemy ocenę oraz nieodwracalny skrót techniczny (hash) utworzony z adresu IP i przeglądarki. Skrót służy wyłącznie temu, aby jedna osoba nie mogła oddać wielu głosów na ten sam przepis, i nie pozwala nam ustalić Twojej tożsamości. Podstawa prawna: prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO), czyli wiarygodność ocen.</p>

<h3>Listy zakupów</h3>
<p>Lista zakupów działa w Twojej przeglądarce (localStorage) i nie jest wysyłana na serwer. Jeśli skorzystasz z funkcji udostępnienia, treść listy zapisujemy na serwerze pod losowym adresem: każdy, kto zna link, może ją zobaczyć i edytować, więc nie wpisuj do niej danych osobowych. Nieużywane listy usuwamy automatycznie po 60 dniach.</p>

<h3>Statystyki odwiedzin</h3>
<p>Korzystamy z Google Analytics 4, aby wiedzieć, które przepisy są czytane i jak ulepszać Serwis. Google zbiera dane o sposobie korzystania ze strony z użyciem plików cookies. Dane mają charakter statystyczny i nie łączymy ich z innymi informacjami o Tobie.</p>

<h3>Logi serwera</h3>
<p>Serwer zapisuje standardowe logi techniczne (adres IP, czas i adres żądania). Wykorzystujemy je wyłącznie do zapewnienia bezpieczeństwa i diagnozowania awarii. Podstawa prawna: prawnie uzasadniony interes administratora (art. 6 ust. 1 lit. f RODO).</p>

<h2>3. Komu powierzamy dane</h2>
<p>Korzystamy z usług podmiotów, które przetwarzają dane w naszym imieniu:</p>
<ul>
<li><strong>Hetzner Online GmbH</strong> (Niemcy/Finlandia, UE): hosting Serwisu i bazy danych.</li>
<li><strong>Resend</strong> (USA): techniczna wysyłka wiadomości e-mail newslettera. Transfer danych odbywa się na podstawie standardowych klauzul umownych oraz programu EU-US Data Privacy Framework.</li>
<li><strong>Google</strong> (USA): statystyki odwiedzin (Google Analytics), na analogicznych podstawach transferu.</li>
</ul>
<p>Nie przekazujemy danych innym podmiotom ani nie wykorzystujemy ich do reklam.</p>

<h2>4. Pliki cookies</h2>
<p>Serwis używa plików cookies wyłącznie w celach statystycznych (Google Analytics). Możesz je w każdej chwili usunąć lub zablokować w ustawieniach przeglądarki: strona będzie działać normalnie. Część funkcji (lista zakupów, tryb gotowania) korzysta z pamięci localStorage w Twojej przeglądarce, której zawartość nie opuszcza Twojego urządzenia, dopóki sam jej nie udostępnisz.</p>

<h2>5. Twoje prawa</h2>
<p>W związku z przetwarzaniem danych masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia, wniesienia sprzeciwu oraz cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem wcześniejszego przetwarzania). Wystarczy e-mail na <a href="mailto:kontakt@dietanaluzie.pl">kontakt@dietanaluzie.pl</a>.</p>
<p>Masz też prawo złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).</p>

<h2>6. Bezpieczeństwo</h2>
<p>Połączenie z Serwisem jest szyfrowane (HTTPS). Dostęp do bazy danych mają wyłącznie osoby administrujące Serwisem, a kopie zapasowe wykonujemy regularnie i przechowujemy w sposób zabezpieczony.</p>

<h2>7. Zmiany polityki</h2>
<p>Polityka może być aktualizowana, gdy w Serwisie pojawią się nowe funkcje. Aktualna wersja jest zawsze dostępna pod tym adresem, wraz z datą ostatniej zmiany.</p>
$POLICY$
WHERE uri = '/polityka-prywatnosci/';
