# lastwar-trainer

**LASTWAR** — ein eigenständiger Echtzeitstrategie-Prototyp im Browser (HTML5 Canvas + Vanilla JS, keine Engine, keine externen Assets). Genre-inspiriert, aber komplett eigene Namen, Einheiten, Gebäude und Grafiken (rein programmatisch gezeichnet).

## Start

- `index.html` direkt im Browser öffnen (funktioniert via `file://`), oder
- `python3 -m http.server` im Repo-Ordner und `http://localhost:8000` aufrufen.

## Ziel

Baue deine Basis aus, sammle Rohstoffe, produziere Armee und zerstöre die gegnerische Kommandozentrale. Wird deine Kommandozentrale zerstört, ist das Spiel verloren.

## Fraktionen (asymmetrisch)

| | Menschen-Föderation (Spieler) | Xylith-Kollektiv (KI-Gegner, Aliens) |
|---|---|---|
| Energie | Kraftwerk, Solarpanel, Windrad, Wasserkraftwerk (nur an Schluchten), Kernreaktor, Fusionsreaktor | Neutrino-Emitter (Grundlast), Tachyonen-Regenerator, Quantentachyonenspalt |
| Superwaffe | **Nukleararsenal**: Nuklearrakete, per Forschung **H-Bombe „Weltenbrand“** (Atomwaffen nur für Menschen) | **Wetterkontrollstation**: radioaktiver **Blitzsturm** |
| Bonus | Schnellfertigung (+50 % Ba.speed) | **Solarsatellit** (+12 Cr/s) |
| Einheiten | hierarchisch nach Gebäuden: Kaserne → Soldat, Tech → Raketenwerfer/Marina, Fabrik → Panzer/Koloss/Vulkan, Flugplatz → Strahl/Falke | 4 Basisklassen (Larve, Spitter, Carapax, Wespe), **Kreuzungslabor** kreuzt zwei Klassen zu Hybriden |
| Treibstoff | — | Aliens **brauchen Neutrinos zum Fahren** (Neutrino-Vorkommen abbauen, an Raffinerie abliefern) |

### Helden (einmalig pro Seite)

Die menschlichen Helden sind als **Modell-Vorlagen an die LastWar-Helden** (`seed/helden-definitionen.json` im Projekt: Typen panzer/rakete/flugzeug) angelehnt:

- **Panzerheld Kimberly** — Vorlage: LastWar-Held Typ *panzer* (UR, Angriff) — Fabrik + Tech
- **Raketenheld Tesla** — Vorlage: Typ *rakete* (UR), **zählt als Panzer/Fahrzeugklasse** — Fabrik + Tech
- **Luftheld DVA** — Vorlage: Typ *flugzeug* (UR) — Flugplatz + Tech
- **Kommandantin Marina** — eigene Kreation (Elite-Infanterie, eigener Name) — Kaserne + Tech

Die **Aliens** sind design-inspiriert an einer Mischung aus dunklen Bio-Schiffen, alten Energiewesen und fortgeschrittener Tech-Zivilisation — mit eigenen Namen/Designs: **Schattenbrut** (organisch, Nahkampf), **Lichtling** (Energiewesen, Fernkampf), **Aegis-Drohne** (schwere Tech-Drohne), **Gleiter** (Untertassen-Fluggerät).

## Superwaffen — zweistufig

1. **Laden**: Das Superwaffen-Gebäude lädt nach Fertigstellung auf (Fortschritt als Ring am Gebäude bzw. Leiste im Superwaffen-Panel).
2. **Feuern**: Button „ZIEL WÄHLEN“ (oder Hotkey `N`), dann Ziel auf der Karte klicken. Rakete fliegt (Fluganimation) und schlägt ein; der Blitzsturm wütet 10 s im Zielgebiet. Danach lädt das Gebäude erneut.

- **Nuklearrakete** (75 s) / **H-Bombe „Weltenbrand“** (150 s, Forschung, Radius 6 statt 3,5): Schaden mit Abstands-Falloff, alle im Radius. Mit Forschung **Antimaterie-Sprengkopf**: H-Bombe als Antimaterie-Variante (Radius 8, 2200 Schaden) und **annihiliert Nano-Schwarze-Löcher** im Einschlag.
- **Blitzsturm (radioaktiv)** (90 s, Aliens, Wetterstation): Schaden über Zeit im Radius + **Nebenwirkungen**:
  - **EMP**: Strom fällt im Sturmgebiet aus (Gebäude gehen offline, „⚡“), Radar/Waffen nur auf Kurzstrecke (Reichweite halbiert, Fehlschüsse)
  - **Radioaktive Strahlung**: Gebäude erleiden Langzeitschäden (Verstrahlung, grüner Rahmen, DoT auch nach dem Sturm), Bodeneinheiten können **mutieren** (stärker, grün, mehr Schaden)
- **Neutronen-Pulsstrahl** (60 s, Aliens): zweiter Superwaffen-Slot der Wetterstation — sofortiger Strahl entlang einer Linie, hoher Schaden für alles auf der Linie.
- **Quarkbosonspalten** (passiv, Aliens): Forschung schleudert **6 Nano-Schwarze-Löcher** auf die Karte. Diese **ziehen Einheiten in ihrem Umkreis an** und **fangen sie im Kern ein** (vernichtet). Gegenmaßnahme der Menschen: **Diffusormatrix** (Gebäude): Annihilations-Aura zerstört Schwarze Löcher nach 3 s und **kann selbst feuern** (Annihilationsbolzen, auch gegen Luftziele).

## Strom

Jedes Gebäude verbraucht/erzeugt Strom (Werte siehe Tooltips). Bei Defizit (Anzeige oben: `Strom: Versorgung/Bedarf`) fallen Gebäude zufällig aus (Brownout). Kraftwerke/Solar/Wind/Wasser/Kern/Fusion (Menschen) bzw. Neutrino-Emitter/Tachyonen/Quantentachyon (Aliens) liefern Versorgung. Das Wasserkraftwerk muss an Wasser (Schlucht/Fluss) gebaut werden.

## Rohstoffe (an der Raffinerie abgeladen)

- **Erz** und **CO₂-Rückgewinnung**: 1 Cr/Einheit
- **Wasserstoff H / H2 / H3**: 2 / 4 / 8 Cr/Einheit (gestaffelte Vorkommen, H3 selten)
- **Neutrinos** (Aliens): füllen den Neutrino-Tank (Treibstoff für Bewegung)

## Steuerung

- Linksklick: auswählen / Gebäude platzieren / Superwaffen-Ziel
- Rechtsklick: bewegen / angreifen / Sammler auf Rohstoff schicken / Rally-Punkt setzen
- Ziehen: Box-Auswahl; Kamera: WASD/Pfeile/Bildschirmrand
- Hotkeys auf den Buttons (z. B. `Q` Raffinerie, `T` Nukleararsenal, `N` Superwaffe, `M` Ton)
- `Esc`: Abbrechen

## Tests

Headless-Simulation der Engine (Ökonomie, Fraktionsregeln, Strom/EMP, Superwaffen-Stufen, Strahlung/Mutationen, Neutrinos, Kreuzungen, KI-Langlauf):

```bash
node test/smoke.mjs
```
