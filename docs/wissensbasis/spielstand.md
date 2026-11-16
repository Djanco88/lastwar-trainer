# Spielstand — NUR Testdaten-Satz

Dieser Spielstand ist **ausschließlich Test-Fixture** (`tests/fixtures/profil.json`) für Unit-/Integrationstests. Die App startet immer mit **leerem Profil**; dieser Satz ist niemals App-Standard.

## Beispiel-Testprofil (fiktiv, zum Testen)

- Server: 977 (fiktiv), HQ 30, Tech-Zentrum 29 (DATENLÜCKE 29 vs. 33 — Fixture führt 29).
- Ressourcen: Nahrung 1,2 Mrd., Eisen 800 Mio., Gold 350 Mio., Öl 120 Mio.
- Beschleuniger: Bau 40× 1h, Forschung 25× 1h, Heilung 10× 5min, Universal 60× 5min.
- Gebäude: HQ 30, Kaserne 30, Tech-Zentrum 29, Mauer 30, Lager 28, Sägewerk 27, Eisenmine 27, Ölfeld 26, Goldmine 26 (je Einfachnennung; Mehrfachnennungen über Extra-Felder).
- VIP: 12, 340 Punkte (nächster Level bei 500).
- Währungen: Diamanten 45.000, Hero-Shards (universal) 120.
- Tech-Forschung: Zweig „Entwicklung“ 62 %, „Militär“ 45 %, „Wirtschaft“ 30 % (in Prozent).
- Taktikkarten: 14 Stück, davon 3× „Battle“-Karten.
- Überlebende: 850.000; Dekorationen: Golden Marshal Statue, Season-Skin S6.
- Helden (Bestand): Kimberly (UR, 5★, Lv 80), DVA (UR, 4★, Lv 75 — DVA-Level offen, Erweckung Lv.20 belegt), Tesla (UR, 4★, Lv 70), Murphy (UR, 3★, Lv 60), Fiona (UR, 3★, Lv 55), Mason (SSR→UR, 3★, Lv 50) — Erweckung/Gear je Held im Fixture.
- Squad: Kimberly, Murphy, Tesla, Fiona, DVA (gemischt) — für Konfigurator-Tests; erwartete beste Formation: 5× … je nach Bestand.
- Skill-Baum (Ist): Rapid Production 5, Outstanding Contribution 1, Build for Free 5, Research for Free 5, Build Now 5, Research Now 5, Resource-Saving 5, Recycling 5, Master Builder 5, Speedup Box 5 … (Soll/Ist-Vergleich in Tests).

Alle Werte in diesem Dokument sind **nutzerangabe**-simulierende Testwerte und tragen in `tests/fixtures/profil.json` die Quelle `nutzerangabe`.
