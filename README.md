# Last-War-Trainer

Desktop-Trainer für **Last War: Survival Game** — Rust-Kern (Tauri 2) + React/TypeScript-Frontend. UI deutsch, dunkles Design. Verbindliche Anweisung: `docs/PROJEKTANWEISUNG.md`; Wissensbasis: `docs/wissensbasis/`.

## Struktur

- `src-tauri/` — Rust-Kern: `model/` (Datenmodell), `engine/` (`skillplan.rs`, `formation.rs`, `squadopt.rs`, `stores.rs`), `storage/` (JSON-Persistenz), `commands/` (Tauri-Commands, Feature `gui`), `tests/` (Integrationstests)
- `src/` — React+TS: `components/` (SkillTree, HeroCard, SquadPlanner/SquadConfigurator, ResourcePanel, EventCalendar), `state/`, `data/`, `assets/`
- `seed/` — statische Spieldaten mit Quellen/Flags (`skills-engineer.json`, `skills-saison-s6.json`, `helden-definitionen.json`, `saison-s7-fahrplan.json`)
- `tests/fixtures/` — Testprofil (nur für Tests, nie App-Standard)
- `docs/` — Anweisung + Wissensbasis

## Verifikation

```bash
cd src-tauri && cargo test && cargo clippy --all-targets && cargo fmt --check   # Core (ohne GUI-Feature)
npm install && npm run build                                                    # tsc strict + vite build
cd src-tauri && cargo build --features gui                                      # GUI-Build (Linux: webkit2gtk)
```

## Windows / WebView2 (Desktop-Ziel)

Auf Windows nutzt Tauri 2 automatisch **WebView2** (Edge-Chromium-Runtime). Voraussetzungen: WebView2 Runtime auf dem Ziel-PC (Installer holt sie via `bundle.windows.webviewInstallMode: "downloadBootstrapper"` in `src-tauri/tauri.conf.json` nach).

```powershell
npm install
npm run build                                   # dist/ für das Webview
cd src-tauri
cargo install tauri-cli --version "^2"          # einmalig
cargo tauri build                               # MSI/NSIS-Installer mit WebView2-Bootstrapper
```

Icons liegen in `src-tauri/icons/` (`32x32.png`, `128x128.png`, `icon.ico`, `icon.icns`). `main.rs` setzt bereits `windows_subsystem = "windows"`.

Kein `unwrap`/`expect` im Produktivcode, clippy ohne Warnungen, TS strict ohne `any`. Jeder Datenwert trägt Quelle + `is_unsicher`-Flag; Datenlücken bleiben `null`/offen.
