use std::fs;
use std::path::Path;

use crate::model::profil::Profil;

pub fn save_profil(path: &Path, profil: &Profil) -> Result<(), String> {
    let json = serde_json::to_string_pretty(profil).map_err(|e| e.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn load_profil(path: &Path) -> Result<Profil, String> {
    let json = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

pub fn export_json(profil: &Profil) -> Result<String, String> {
    serde_json::to_string_pretty(profil).map_err(|e| e.to_string())
}

pub fn import_json(json: &str) -> Result<Profil, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}

pub fn import_json_validiert(json: &str) -> Result<Profil, String> {
    let profil: Profil =
        serde_json::from_str(json).map_err(|e| format!("ungueltiges JSON: {}", e))?;
    if profil.version != crate::model::APP_VERSION {
        return Err(format!(
            "Versionskonflikt: Profil v{}, App erwartet v{}",
            profil.version,
            crate::model::APP_VERSION
        ));
    }
    Ok(profil)
}

pub fn default_profil_pfad(app_data_dir: &Path) -> std::path::PathBuf {
    app_data_dir.join("profil.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_export_import_verlustfrei() {
        let mut profil = Profil::leer(977);
        profil.hq_level = 30;
        profil.ressourcen.nahrung = 1_200_000_000;
        profil.ressourcen.eisen = 800_000_000;
        let json = export_json(&profil).unwrap_or_else(|e| panic!("export: {}", e));
        let zurueck = import_json(&json).unwrap_or_else(|e| panic!("import: {}", e));
        assert_eq!(profil, zurueck);
    }

    #[test]
    fn import_validiert_version_und_json() {
        let mut profil = Profil::leer(977);
        profil.hq_level = 33;
        let json = export_json(&profil).unwrap_or_else(|e| panic!("export: {}", e));
        let ok = import_json_validiert(&json).unwrap_or_else(|e| panic!("import: {}", e));
        assert_eq!(ok, profil);
        let falsch = json.replace("\"version\": 1", "\"version\": 999");
        assert!(
            import_json_validiert(&falsch).is_err(),
            "falsche Version muss ablehnen"
        );
        assert!(
            import_json_validiert("{kaputt").is_err(),
            "kaputtes JSON muss ablehnen"
        );
    }

    #[test]
    fn save_load_roundtrip_ueber_datei() {
        let dir = std::env::temp_dir().join(format!(
            "lastwar-test-{}-{}",
            std::process::id(),
            "save-load"
        ));
        let pfad = default_profil_pfad(&dir);
        let mut profil = Profil::leer(977);
        profil.ueberlebende = Some(850_000);
        save_profil(&pfad, &profil).unwrap_or_else(|e| panic!("save: {}", e));
        let geladen = load_profil(&pfad).unwrap_or_else(|e| panic!("load: {}", e));
        assert_eq!(profil, geladen);
        let _ = fs::remove_dir_all(&dir);
    }
}
