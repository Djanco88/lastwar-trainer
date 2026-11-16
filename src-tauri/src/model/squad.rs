use serde::{Deserialize, Serialize};

use super::held::HeroTyp;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Squad {
    #[serde(default)]
    pub helden: Vec<String>,
    #[serde(default)]
    pub fixierungen: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FormationAuswertung {
    pub bonus_prozent: f64,
    pub faktor: f64,
    pub beschreibung: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SquadOption {
    pub helden: Vec<String>,
    pub score: f64,
    pub formation_faktor: f64,
    pub counter_faktor: f64,
    pub staerke_summe: f64,
    pub begruendung: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AenderungsVorschlag {
    pub alt: Vec<String>,
    pub neu: Vec<String>,
    pub score_alt: f64,
    pub score_neu: f64,
    pub begruendung: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GegenTypWahl {
    #[serde(rename_all = "lowercase")]
    Panzer,
    #[serde(rename_all = "lowercase")]
    Rakete,
    #[serde(rename_all = "lowercase")]
    Flugzeug,
}

impl From<GegenTypWahl> for HeroTyp {
    fn from(g: GegenTypWahl) -> HeroTyp {
        match g {
            GegenTypWahl::Panzer => HeroTyp::Panzer,
            GegenTypWahl::Rakete => HeroTyp::Rakete,
            GegenTypWahl::Flugzeug => HeroTyp::Flugzeug,
        }
    }
}
