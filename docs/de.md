# Homebox

Verfolge das Inventar deines Zuhauses in Gladys mit
[Homebox](https://github.com/sysadminsmedia/homebox), dem selbst gehosteten
Inventar- und Ordnungssystem: wie viele Gegenstände du besitzt, was sie wert
sind, welche Garantien bald ablaufen und welche Wartungen anstehen. Alles
bleibt in deinem lokalen Netzwerk: Gladys spricht direkt mit Homebox und liest
es nur.

Getestet mit echten Homebox-Servern, 0.26.2 und 0.21.0 (das offizielle
Docker-Image). Rückmeldungen sind im Gladys-Forum willkommen.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- Ein Homebox-Server, der vom Gladys-Rechner aus erreichbar ist, standardmäßig
  auf Port 7745, oder hinter einem Reverse-Proxy.
- Ab Homebox 0.26: ein API-Schlüssel (Homebox → dein Profil →
  API-Schlüssel). Bei einem älteren Homebox: E-Mail und Passwort eines
  Homebox-Benutzers. Die Integration sieht das Inventar (die „Gruppe“) dieses
  Benutzers.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. Gib unter **Homebox-Adresse** die IP-Adresse des Servers ein, zum Beispiel
   `192.168.1.50`: Die Integration nutzt dann Port 7745. Füge einen Port hinzu,
   wenn deiner abweicht (`192.168.1.50:3100`). Hinter einem Reverse-Proxy gibst
   du die vollständige Adresse ein (`https://example.org/homebox`).
3. Füge einen **API-Schlüssel** ein, oder fülle **E-Mail** und **Passwort**
   aus. Der API-Schlüssel hat Vorrang, wenn beides ausgefüllt ist.
4. **Garantie endet innerhalb (Tage)**: Eine Garantie gilt so viele Tage vor
   ihrem Ende als bald ablaufend (standardmäßig 30).
5. **Anstehende Wartung innerhalb (Tage)**: wie weit im Voraus eine geplante
   Wartung als anstehend gilt (standardmäßig 7).
6. **Ein Gerät pro Ort** (standardmäßig aus) fügt für jeden Hauptort von
   Homebox ein Gerät hinzu.
7. **Homebox lesen alle**: 5, 15 (Standard), 30 oder 60 Minuten.
8. **Sprache der Namen und Meldungen** legt die Namen der Funktionen (beim
   Hinzufügen des Geräts festgelegt), die Texte und die Daten der
   Szenenvariablen fest. Standardmäßig Französisch.
9. Speichere, dann nutze **Verbindung testen**: Das zeigt die Homebox-Version
   und die Anzahl der Gegenstände und Orte.
10. Füge im Reiter **Entdecken** die Geräte hinzu, die du verfolgen willst.

## Geräte

**Homebox** (ein Gerät für dein Inventar):

| Funktion                  | Wert                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| Gegenstände               | Anzahl der Gegenstände, ohne archivierte                             |
| Orte                      | Anzahl der Orte                                                      |
| Gesamtwert                | Kaufpreis × Menge jedes Gegenstands, in der Währung der Gruppe       |
| Bald ablaufende Garantien | Gegenstände, deren Garantie im eingestellten Fenster endet           |
| Überfällige Wartungen     | geplante Wartungen, deren Datum vorbei ist                           |
| Anstehende Wartungen      | geplante Wartungen im eingestellten Fenster                          |
| Nächste Wartung           | Name, Gegenstand und Datum der nächsten Wartung, oder „Keine“        |
| Nächstes Garantieende     | Gegenstand und Datum der nächsten ablaufenden Garantie, oder „Keine“ |

Gladys hat eine Einheit für Euro, Dollar und Pfund Sterling; eine andere
Währung erscheint im Namen der Funktion, zum Beispiel „Gesamtwert (CHF)“.
Lebenslange Garantien enden nie; bereits abgelaufene Garantien werden nicht
gezählt.

**Ein Ort** (Option): **Gegenstände** (Anzahl der dort gelagerten
Gegenstände, Unterorte eingeschlossen) und **Wert**. Nur die Hauptorte
bekommen ein Gerät.

## Dashboard-Widget

**Hausinventar**: vier Kacheln (Gegenstände, Wert, Garantien, fällige
Wartungen) und die Liste dessen, was als Nächstes ansteht, das Früheste
zuerst: überfällige Wartungen (rot), anstehende Wartungen, ablaufende
Garantien. Nur lesend.

## Szenen-Auslöser

- **Garantie läuft bald ab**: Die Garantie eines Gegenstands erreicht das
  eingestellte Fenster. Einmal pro Gegenstand und Enddatum. Variablen:
  Gegenstand, Ort, Enddatum, verbleibende Tage.
- **Wartung fällig**: Eine geplante Wartung erreicht ihr Datum, ohne erledigt
  zu sein. Einmal pro Wartung. Variablen: Wartung, Gegenstand, geplantes
  Datum, Tage überfällig.

Das erste Lesen nach der Installation ist still: Was bereits ansteht, wird am
Gerät angezeigt, nicht angekündigt. Die Auslöser feuern beim ersten Lesen nach
der Änderung (nach Mitternacht, im eingestellten Intervall).

## Szenen-Aktionen

**Gegenstand in Homebox suchen**: Gib einen Namen an (`AA-Batterien`); die
Aktion liest Homebox und liefert **Gefunden**, **Passende Gegenstände**,
**Gegenstand**, **Ort** (der vollständige Pfad, `Garage / Regal`) und
**Menge**. Der genaue Name hat Vorrang, dann die Namen, die ihn enthalten;
archivierte Gegenstände werden ignoriert.

## Szenen-Beispiele

- **Wartungserinnerung**: Auslöser „Wartung fällig“ → Nachricht senden „Zeit
  für {{triggerEvent.data.maintenance}} an {{triggerEvent.data.item}}“.
- **Garantie**: Auslöser „Garantie läuft bald ab“ → Nachricht „Die Garantie
  von {{triggerEvent.data.item}} endet am {{triggerEvent.data.expires}}“.
- **Bestand prüfen**: jeden Sonntag um 10:00 → „Gegenstand in Homebox suchen“
  (`AA-Batterien`) → nur fortfahren, wenn die Menge unter 4 liegt → Nachricht
  „Nur noch wenige AA-Batterien (gelagert in …)“.

## Fehlerbehebung

- **„Zugriff verweigert“**: Prüfe den API-Schlüssel (er kann abgelaufen oder
  in Homebox gelöscht sein), oder E-Mail und Passwort. API-Schlüssel gibt es
  erst ab Homebox 0.26: Bei einer älteren Version nutzt du E-Mail und
  Passwort.
- **„Homebox antwortet nicht“**: Prüfe Adresse und Port vom Gladys-Rechner
  aus. Der Container läuft in einem Bridge-Netzwerk: `localhost` ist der
  Container selbst, gib stattdessen die IP-Adresse des Servers ein.
- **„Diese Adresse antwortet nicht wie Homebox“**: Eine Anmeldeseite eines
  Proxys antwortet anstelle von Homebox. Gib die Adresse von Homebox selbst
  ein, oder lass den Gladys-Rechner durch den Proxy.
- Für mehr Details in den Protokollen der Integration setze
  `LOG_LEVEL=debug`.

## Grenzen

- Nur lesend: Die Integration ändert dein Inventar nie.
- Jedes Lesen sind etwa fünf Anfragen (darunter der CSV-Export des ganzen
  Inventars): Wähle bei einem sehr großen Inventar ein langes Intervall.
- Eine einzige Homebox-Gruppe, die des API-Schlüssels oder Benutzers.
- Nicht mit dem Homebox-Projekt verbunden.
