use std::sync::Mutex;

use tauri::State;

use crate::engine::{formation, skillplan, squadopt};
use crate::model::profil::Profil;
use crate::model::squad::SquadOption;
use crate::seed_data;

pub struct AppState {
    pub profil: Mutex<Profil>,
}

#[tauri::command]
pub fn kern_baum_laden() -> Result<crate::model::skill::KernBaum, String> {
    seed_data::lade_kern_baum().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn saison_s6_laden() -> Result<crate::model::saison::SaisonSkills, String> {
    seed_data::lade_saison_skills().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn helden_definitionen_laden() -> Result<crate::model::held::HeldenDefinitionen, String> {
    seed_data::lade_helden().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn s7_fahrplan_laden() -> Result<crate::model::saison::S7Fahrplan, String> {
    seed_data::lade_s7_fahrplan().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn profil_aktuell(state: State<AppState>) -> Result<Profil, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn skill_level_setzen(
    state: State<AppState>,
    skill_id: String,
    level: u32,
) -> Result<(), String> {
    let mut guard = state.profil.lock().map_err(|e| e.to_string())?;
    let ist = guard
        .skill_baum_ist
        .get_or_insert_with(|| crate::model::profil::SkillBaumIst {
            profession_level: 100,
            kern: Default::default(),
            saison_s6: Default::default(),
        });
    if level == 0 {
        ist.kern.remove(&skill_id);
    } else {
        ist.kern.insert(skill_id, level);
    }
    Ok(())
}

#[tauri::command]
pub fn squad_optimieren(
    state: State<AppState>,
    gegner_typ: Option<String>,
    fixierungen: Vec<String>,
    top_n: usize,
    sandbox: bool,
) -> Result<Vec<SquadOption>, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    let defs = seed_data::lade_helden().map_err(|e| e.to_string())?;
    let bestand = squadopt::held_eintraege(&guard.helden, &defs);
    let gegner = gegner_typ.and_then(|g| match g.as_str() {
        "panzer" => Some(crate::model::held::HeroTyp::Panzer),
        "rakete" => Some(crate::model::held::HeroTyp::Rakete),
        "flugzeug" => Some(crate::model::held::HeroTyp::Flugzeug),
        _ => None,
    });
    let input = squadopt::KonfiguratorInput {
        bestand,
        fixierungen,
        gegner_typ: gegner,
        top_n,
        squad_groesse: defs.squad_groesse,
        formationsbonus: defs.formationsbonus.clone(),
        counter: defs.counter_regel.clone(),
    };
    let ergebnis = squadopt::optimieren(&input);
    if !sandbox {
        if let Some(bester) = ergebnis.first() {
            let mut guard = guard;
            guard.squad = bester.helden.clone();
        }
    }
    Ok(ergebnis)
}

#[tauri::command]
pub fn formation_fuer_squad(
    state: State<AppState>,
    helden_ids: Vec<String>,
) -> Result<crate::model::squad::FormationAuswertung, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    let defs = seed_data::lade_helden().map_err(|e| e.to_string())?;
    let typen: Vec<crate::model::held::HeroTyp> = helden_ids
        .iter()
        .filter_map(|id| defs.find(id).and_then(|d| d.typ))
        .collect();
    Ok(formation::formation_auswertung(
        &typen,
        &defs.formationsbonus,
    ))
}

#[tauri::command]
pub fn fehlende_werte_konfigurator(
    state: State<AppState>,
) -> Result<Vec<squadopt::FehlenderWert>, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    let defs = seed_data::lade_helden().map_err(|e| e.to_string())?;
    let bestand = squadopt::held_eintraege(&guard.helden, &defs);
    Ok(squadopt::fehlende_werte(&bestand))
}

#[tauri::command]
pub fn speedup_rechner(
    state: State<AppState>,
    dauer_sek: u64,
) -> Result<crate::engine::bau::SpeedupErgebnis, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    let b = &guard.beschleuniger;
    let posten = crate::engine::bau::speedups_aus_beschleuniger(
        b.bau_1h,
        b.forschung_1h,
        b.heilung_5min,
        b.universal_5min,
    );
    Ok(crate::engine::bau::speedup_rechner(dauer_sek, &posten))
}

#[tauri::command]
pub fn naechster_store_reset() -> String {
    let jetzt = chrono::Local::now().naive_local();
    crate::engine::stores::naechster_montag_0000_serverzeit(jetzt).to_string()
}

#[tauri::command]
pub fn profil_export(state: State<AppState>) -> Result<String, String> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    crate::storage::json_store::export_json(&guard)
}

#[tauri::command]
pub fn profil_import(state: State<AppState>, json: String) -> Result<(), String> {
    let profil = crate::storage::json_store::import_json_validiert(&json)?;
    let mut guard = state.profil.lock().map_err(|e| e.to_string())?;
    *guard = profil;
    Ok(())
}

#[tauri::command]
pub fn profil_speichern(app: tauri::AppHandle, state: State<AppState>) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = crate::storage::json_store::default_profil_pfad(&dir);
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    crate::storage::json_store::save_profil(&path, &guard)?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn profil_laden(app: tauri::AppHandle, state: State<AppState>) -> Result<bool, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = crate::storage::json_store::default_profil_pfad(&dir);
    if !path.exists() {
        return Ok(false);
    }
    let geladen = crate::storage::json_store::load_profil(&path)?;
    let mut guard = state.profil.lock().map_err(|e| e.to_string())?;
    *guard = geladen;
    Ok(true)
}

#[tauri::command]
pub fn enzyklopaedie_eintraege(
) -> Result<Vec<crate::engine::enzyklopaedie::EnzyklopaedieEintrag>, String> {
    Ok(crate::engine::enzyklopaedie::eintraege())
}

#[tauri::command]
pub fn skillplan_validieren(state: State<AppState>, budget: u32) -> Result<(), Vec<String>> {
    let guard = state.profil.lock().map_err(|e| e.to_string())?;
    let baum = seed_data::lade_kern_baum().map_err(|e| e.to_string())?;
    let ist = &guard
        .skill_baum_ist
        .as_ref()
        .map(|s| s.kern.clone())
        .unwrap_or_default();
    let level = guard
        .skill_baum_ist
        .as_ref()
        .map(|s| s.profession_level)
        .unwrap_or(100);
    skillplan::validate_kern_allocation(&baum, ist, level, budget)
}
