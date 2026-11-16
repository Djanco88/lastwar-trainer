use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HeroTyp {
    Panzer,
    Rakete,
    Flugzeug,
}

impl HeroTyp {
    pub fn name_de(&self) -> &'static str {
        match self {
            HeroTyp::Panzer => "Panzer",
            HeroTyp::Rakete => "Rakete",
            HeroTyp::Flugzeug => "Flugzeug",
        }
    }

    pub fn alle() -> [HeroTyp; 3] {
        [HeroTyp::Panzer, HeroTyp::Rakete, HeroTyp::Flugzeug]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Rolle {
    Angriff,
    Verteidigung,
    Support,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Seltenheit {
    #[serde(rename = "SR")]
    Sr,
    #[serde(rename = "SSR")]
    Ssr,
    #[serde(rename = "UR")]
    Ur,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Basiswerte {
    pub hp: Option<u64>,
    pub angriff: Option<u64>,
    pub verteidigung: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeldDef {
    pub id: String,
    pub name: Option<String>,
    pub seltenheit: Option<Seltenheit>,
    pub typ: Option<HeroTyp>,
    pub rolle: Option<Rolle>,
    pub promotable: bool,
    pub erweckung: bool,
    pub basiswerte: Basiswerte,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub is_unsicher: bool,
    pub konflikt_notiz: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CounterRegel {
    pub schaden_genommen_von_counter: f64,
    pub flugzeug_nimmt_von_panzer: f64,
    pub rakete_nimmt_von_flugzeug: f64,
    pub panzer_nimmt_von_rakete: f64,
    #[serde(default)]
    pub quelle: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormationsbonusRegel {
    #[serde(rename = "5x_gleicher_typ")]
    pub fuenf_x: f64,
    #[serde(rename = "4x_gleicher_typ")]
    pub vier_x: f64,
    #[serde(rename = "3plus2")]
    pub drei_plus_zwei: f64,
    #[serde(rename = "3x_gleicher_typ")]
    pub drei_x: f64,
    pub gilt_auf: Vec<String>,
    #[serde(default)]
    pub quelle: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeldenDefinitionen {
    pub stand: String,
    pub anzahl_helden: usize,
    pub squad_groesse: usize,
    pub gear_slots_pro_held: usize,
    pub typen: Vec<HeroTyp>,
    pub rollen: Vec<Rolle>,
    pub seltenheiten: Vec<Seltenheit>,
    pub counter_regel: CounterRegel,
    pub formationsbonus: FormationsbonusRegel,
    pub helden: Vec<HeldDef>,
    #[serde(default)]
    pub datenluecken: Vec<String>,
}

impl HeldenDefinitionen {
    pub fn find(&self, held_id: &str) -> Option<&HeldDef> {
        self.helden.iter().find(|h| h.id == held_id)
    }
}

impl HeldDef {
    pub fn anzeige_name(&self) -> String {
        self.name
            .clone()
            .unwrap_or_else(|| format!("{} (Name offen)", self.id))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HeldInstanz {
    pub held_id: String,
    pub sterne: u8,
    pub level: Option<u32>,
    pub hp: Option<u64>,
    pub angriff: Option<u64>,
    pub verteidigung: Option<u64>,
    #[serde(default)]
    pub gear: Vec<Option<u8>>,
    #[serde(default)]
    pub erweckt: bool,
    pub erweckung_level: Option<u32>,
    #[serde(default)]
    pub faehigkeiten_level: Vec<u8>,
    #[serde(default)]
    pub quelle: Vec<String>,
}

impl HeldInstanz {
    pub fn gear_summe(&self) -> u32 {
        self.gear.iter().flatten().map(|g| *g as u32).sum()
    }
}
