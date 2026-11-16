use serde::{Deserialize, Serialize};

use super::skill::SkillDef;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SaisonSkills {
    pub saison: u32,
    pub name_de: String,
    pub start_erste_server: Option<String>,
    pub punkte_budget: u32,
    #[serde(default)]
    pub punkte_budget_quelle: Vec<String>,
    pub erstattung_bei_saisonende: bool,
    pub anzahl_skills: usize,
    #[serde(default)]
    pub kette: Option<String>,
    pub skills: Vec<SkillDef>,
}

impl SaisonSkills {
    pub fn find(&self, id: &str) -> Option<&SkillDef> {
        self.skills.iter().find(|s| s.id == id)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Server977Termine {
    pub hinweis: String,
    pub pre_season_start: Option<String>,
    pub haupt_start: Option<String>,
    pub celebration_week: Option<String>,
    pub off_season: Option<String>,
    pub editierbar: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct S7Event {
    pub id: String,
    pub name_de: String,
    pub start: Option<String>,
    #[serde(default)]
    pub dauer_tage: Option<u32>,
    #[serde(default)]
    pub wiederkehrend: Option<String>,
    pub server_977_editierbar: bool,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub hinweis: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct S7Fahrplan {
    pub saison: u32,
    pub name_de: String,
    pub name_en: String,
    pub pre_season_erste_server: PreSeasonErsteServer,
    pub server_977: Server977Termine,
    pub zyklus: Zyklus,
    #[serde(default)]
    pub features_s7: Vec<S7Feature>,
    pub events: Vec<S7Event>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreSeasonErsteServer {
    pub datum: Option<String>,
    #[serde(default)]
    pub server_batch: Option<String>,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub is_unsicher: bool,
    pub konflikt_notiz: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Zyklus {
    pub pre_season_wochen: u32,
    pub haupt_saison_wochen: u32,
    pub celebration_week: u32,
    pub off_season: bool,
    #[serde(default)]
    pub quelle: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct S7Feature {
    pub name: String,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub is_unsicher: bool,
    pub konflikt_notiz: Option<String>,
}
