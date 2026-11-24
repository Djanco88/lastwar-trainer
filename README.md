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

### Helden (einmalig pro Seite, eigene Original-Designs)

- **Kommandantin Marina** — Elite-Infanterie (Kaserne + Tech)
- **Panzerheld Koloss** — schwerer Panzer (Fabrik + Tech)
- **Raketenheld Vulkan** — zählt als Panzer/Fahrzeugklasse (Fabrik + Tech)
- **Luftheld Falke** — Elite-Flugzeugmodell (Flugplatz + Tech)

## Superwaffen — zweistufig

1. **Laden**: Das Superwaffen-Gebäude lädt nach Fertigstellung auf (Fortschritt als Ring am Gebäude bzw. Leiste im Superwaffen-Panel).
2. **Feuern**: Button „ZIEL WÄHLEN“ (oder Hotkey `N`), dann Ziel auf der Karte klicken. Rakete fliegt (Fluganimation) und schlägt ein; der Blitzsturm wütet 10 s im Zielgebiet. Danach lädt das Gebäude erneut.

- **Nuklearrakete** (75 s) / **H-Bombe „Weltenbrand“** (150 s, Forschung, Radius 6 statt 3,5): Schaden mitAbstands-Falloff, alle im Radius.
- **Blitzsturm (radioaktiv)** (90 s, Aliens): Schaden über Zeit im Radius + **Nebenwirkungen**:
  - **EMP**: Strom fällt im Sturmgebiet aus (Gebäude gehen offline, „⚡“), Radar/Waffen nur auf Kurzstrecke (Reichweite halbiert, Fehlschüsse)
  - **Radioaktive Strahlung**: Gebäude erleiden Langzeitschäden (Verstrahlung, grüner Rahmen, DoT auch nach dem Sturm), Bodeneinheiten können **mutieren** (stärker, grün, mehr Schaden)

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
