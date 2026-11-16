#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;

use lastwar_core::commands::AppState;
use lastwar_core::model::profil::Profil;

fn main() {
    let state = AppState {
        profil: Mutex::new(Profil::leer(977)),
    };
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            lastwar_core::commands::kern_baum_laden,
            lastwar_core::commands::saison_s6_laden,
            lastwar_core::commands::helden_definitionen_laden,
            lastwar_core::commands::s7_fahrplan_laden,
            lastwar_core::commands::profil_aktuell,
            lastwar_core::commands::skill_level_setzen,
            lastwar_core::commands::squad_optimieren,
            lastwar_core::commands::formation_fuer_squad,
            lastwar_core::commands::fehlende_werte_konfigurator,
            lastwar_core::commands::speedup_rechner,
            lastwar_core::commands::naechster_store_reset,
            lastwar_core::commands::profil_export,
            lastwar_core::commands::profil_import,
            lastwar_core::commands::profil_speichern,
            lastwar_core::commands::profil_laden,
            lastwar_core::commands::enzyklopaedie_eintraege,
            lastwar_core::commands::skillplan_validieren,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| panic!("Tauri-Fehler: {}", e));
}
