use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::held::HeldInstanz;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Ressourcen {
    pub nahrung: u64,
    pub eisen: u64,
    pub gold: u64,
    pub oel: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Beschleuniger {
    #[serde(default)]
    pub bau_1h: u64,
    #[serde(default)]
    pub forschung_1h: u64,
    #[serde(default)]
    pub heilung_5min: u64,
    #[serde(default)]
    pub universal_5min: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Gebaeude {
    pub id: String,
    pub name_de: String,
    pub level: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Vip {
    pub level: u32,
    pub punkte: u64,
    pub punkte_naechster_level: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Waehrungen {
    pub diamanten: u64,
    #[serde(default)]
    pub universal_hero_shards: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Taktikkarten {
    pub anzahl: u64,
    #[serde(default)]
    pub battle_karten: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SkillBaumIst {
    pub profession_level: u32,
    #[serde(default)]
    pub kern: HashMap<String, u32>,
    #[serde(default)]
    pub saison_s6: HashMap<String, u32>,
}

impl SkillBaumIst {
    pub fn kern_punkte(&self) -> u32 {
        self.kern.values().sum()
    }

    pub fn saison_punkte(&self) -> u32 {
        self.saison_s6.values().sum()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoreEintrag {
    pub name: String,
    pub pro_woche: Option<u64>,
    pub pro_monat: Option<u64>,
    #[serde(default)]
    pub gekauft_woche: u64,
    #[serde(default)]
    pub gekauft_monat: u64,
}

impl StoreEintrag {
    pub fn verbleibend_woche(&self) -> Option<u64> {
        self.pro_woche.map(|l| l.saturating_sub(self.gekauft_woche))
    }

    pub fn verbleibend_monat(&self) -> Option<u64> {
        self.pro_monat.map(|l| l.saturating_sub(self.gekauft_monat))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Profil {
    pub version: u32,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub hinweis: Option<String>,
    pub server: u32,
    pub hq_level: u32,
    #[serde(default)]
    pub tech_zentrum_level: Option<u32>,
    #[serde(default)]
    pub tech_zentrum_konflikt_notiz: Option<String>,
    pub ressourcen: Ressourcen,
    #[serde(default)]
    pub beschleuniger: Beschleuniger,
    #[serde(default)]
    pub gebaeude: Vec<Gebaeude>,
    #[serde(default)]
    pub vip: Option<Vip>,
    #[serde(default)]
    pub waehrungen: Option<Waehrungen>,
    #[serde(default)]
    pub tech_forschung_prozent: HashMap<String, u8>,
    #[serde(default)]
    pub taktikkarten: Option<Taktikkarten>,
    #[serde(default)]
    pub ueberlebende: Option<u64>,
    #[serde(default)]
    pub dekorationen: Vec<String>,
    #[serde(default)]
    pub helden: Vec<HeldInstanz>,
    #[serde(default)]
    pub squad: Vec<String>,
    #[serde(default)]
    pub skill_baum_ist: Option<SkillBaumIst>,
    #[serde(default)]
    pub store_limits: Vec<StoreEintrag>,
}

impl Profil {
    pub fn leer(server: u32) -> Profil {
        Profil {
            version: crate::model::APP_VERSION,
            quelle: vec!["nutzerangabe".to_string()],
            hinweis: None,
            server,
            hq_level: 1,
            tech_zentrum_level: None,
            tech_zentrum_konflikt_notiz: None,
            ressourcen: Ressourcen {
                nahrung: 0,
                eisen: 0,
                gold: 0,
                oel: 0,
            },
            beschleuniger: Beschleuniger {
                bau_1h: 0,
                forschung_1h: 0,
                heilung_5min: 0,
                universal_5min: 0,
            },
            gebaeude: Vec::new(),
            vip: None,
            waehrungen: None,
            tech_forschung_prozent: HashMap::new(),
            taktikkarten: None,
            ueberlebende: None,
            dekorationen: Vec::new(),
            helden: Vec::new(),
            squad: Vec::new(),
            skill_baum_ist: None,
            store_limits: Vec::new(),
        }
    }
}
