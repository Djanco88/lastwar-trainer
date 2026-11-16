# PROJEKTANWEISUNG — Last-War-Trainer-App (verbindlich)

Desktop-Trainer für **Last War: Survival Game**. Rust mit **Tauri 2**: Rust-Kern (Datenmodell, Berechnungs-Engine, JSON-Persistenz), React+TypeScript-Frontend im Tauri-Webview. UI **deutsch**, dunkles Design. Spiel-Assets erlaubt (Icons, Helden-Porträts, Skill-Bilder; lokal einbetten, Urheberrechtshinweis des Herstellers anzeigen).

Verbindliche Wissensbasis: `docs/wissensbasis/` (`spielwissen.md`, `saisons-events.md`, `quellen-katalog.md`, `spielstand.md`). **Nichts erfinden; fehlende Werte sind `null`/offen.**

## Kernregeln

1. App startet mit **leerem Profil**. Der persönliche Spielstand wird ausschließlich in der App erfasst. Der Spielstand aus der Wissensbasis (`spielstand.md`) ist nur Testdaten-Satz für Unit-/Integrationstests (`tests/fixtures/`), niemals App-Standard.
2. Jeder Datenwert trägt eine **Quelle** (`cpt-hedge`, `lastwartutorial`, `wardawgg`, `lastwarvault`, `pocketgamer`, `packsify`, `ldshop`, `nutzerangabe`), Flag `is_unsicher` bei unsicheren Werten, `konflikt_notiz` bei Quellabweichungen. **Nutzerangaben haben immer Vorrang.**
3. Rust: rustfmt, clippy ohne Warnungen, kein `unwrap`/`expect`, Unit-Tests für jede Berechnungsregel, `cargo test` grün.
4. TypeScript: strict, kein `any`. Konventionelle Commits.
5. Struktur: `src-tauri/` (`model/`, `engine/` mit `formation.rs`, `squadopt.rs`, `skillplan.rs`, `stores.rs`, `storage/`, `commands/`, `tests/`), `src/` (`components/` mit SkillTree, HeroCard, SquadPlanner, SquadConfigurator, ResourcePanel, EventCalendar; `state/`, `data/`, `assets/`), `seed/` (statische Spieldaten), `tests/fixtures/` (Testprofil), `docs/`.

## Features

### Kern zuerst

1. **Skill-Baum-Trainer**: Engineer-Kern-Baum Lv.1–100 (21 Tiers, 42 Kern-Skills mit Max-Level), interaktiv, Punkte-Budget-Simulation (125 Punkte), Ist/Soll-Vergleich gegen erfassten Stand, Prioritäts-Engine nach Community-Konsens (Prio: One More Time, Build Now, Research Now, Master Builder, Medical Aid, Rapid Production, Resource-Saving, Recycling, Outstanding Contribution, Extra Meal, Free Teleport, Speedup Box; Skip: Random Visitors, Durability Mine, Win-Win Cooperation, Fearless Defense, Blast), Effektanzeige je Level.
2. **Saison-Spalten** je Saison (S6 vollständig, 21 Skills), Saisonende-Erstattung simulieren, Respec-Planer, S7-Startplan.
3. **Spielstand-Formulare**: Ressourcen, Beschleuniger, Gebäude (inkl. Mehrfachnennungen), VIP-Punkte-Fortschritt, Währungen, Tech-Forschung je Zweig in Prozent, Taktikkarten, Überlebende, Dekorationen.
4. **Helden-Manager**: 31 Helden (Name, Seltenheit, Typ Panzer/Rakete/Flugzeug, Rolle, Sterne, Level nullable, HP/Angriff/Verteidigung, Gear 4 Slots, Erweckung, Fähigkeiten).
5. **Squad-Planer mit Squad-Konfigurator**: Formationsbonus automatisch (5x gleicher Typ +20 %, 4x +15 %, 3+2 +10 %, 3x +5 %, bezogen auf HP/Angriff/Verteidigung), Typ-Counter (Flugzeug nimmt 80 % Schaden von Panzern, Rakete 80 % von Flugzeug, Panzer 80 % von Rakete). Konfigurator: automatische Optimierung der besten Zusammenstellung aus dem Heldenbestand (Score = Heldenstärke × Formationsbonus-Faktor, optional × Counter-Faktor gegen wählbaren Gegner-Typ; Bruteforce über alle 5er-Kombinationen, bei 31 Helden max. 169.911), Fixierungen je Held, Top-N-Vorschläge mit Begründung, automatische Neuberechnung bei Bestandsänderungen (neuer Held, Level-Up, Erweckung, Gear-Upgrade) mit Änderungsvorschlag, Sandbox-Modus zum freien Durchtesten ohne Profiländerung, Meta-Gewichtung aus externen Tier-Listen optional mit Quellen-Flag.

### Später (M3–M5)

HQ-/Bau-Planer mit Speedup-Rechner, Event-Kalender (wiederkehrende Events plus S7-Fahrplan, Countdowns), Store-Tracker mit Wochen-/Monats-Limits und Reset-Erinnerungen (Montag 0:00 Serverzeit), Taktikkarten-, Drohnen-, Overlord-Tracker, Enzyklopädie aus der Wissensbasis, JSON-Export/Import (verlustfrei, Roundtrip-Test).

## DATENLÜCKEN — niemals still glätten

- DVA-Helden-Level offen (Erweckung Lv.20 belegt).
- Tech-Zentrum 29 vs. 33 (beide führen).
- Gear-Stückzahlen unsicher.
- Effekte von Helping Hand, Willing Helper, Truck Expansion, Coop II, Blast **nicht extern belegt** → als „Effekt unbekannt" führen, gegen lastwarvault/ldshop/pocketgamer/packsify prüfen.
- S7-Termine Server 977 unbekannt (Countdown editierbar).

## Meilensteine

- **M0** Repo, Struktur, Seed-Extraktion mit Gegenprobe gegen die Wissensbasis (jeder Wert belegt, unsichere mit Flag).
- **M1** Skill-Baum-Trainer (Abnahme: 125-Punkte-Budget, alle 42 Kern-Skills korrekt).
- **M2** Formulare, Helden-Manager, Squad-Planer mit Konfigurator (Abnahme: Formationsbonus korrekt, +20 %-Formation auffindbar, Sandbox ändert Profil nicht, Neuberechnung greift).
- **M3** Saison-Spalten, Respec, S7-Plan. **M4** HQ/Bau, Store, Events. **M5** Enzyklopädie, Export/Import.
- Nach jedem Meilenstein: `cargo test`, `clippy`, `tsc`, Abnahmekriterien prüfen.

## Nicht machen

Keine Bots oder Automatisierung gegen das Spiel, keine Account-Drittanbindung, keine MMO-Features.
