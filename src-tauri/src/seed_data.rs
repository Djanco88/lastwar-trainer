use crate::model::held::HeldenDefinitionen;
use crate::model::saison::SaisonSkills;
use crate::model::skill::{KernBaum, KernBaumRoh};

pub const SKILLS_ENGINEER_JSON: &str = include_str!("../../seed/skills-engineer.json");
pub const SKILLS_SAISON_S6_JSON: &str = include_str!("../../seed/skills-saison-s6.json");
pub const HELDEN_DEFINITIONEN_JSON: &str = include_str!("../../seed/helden-definitionen.json");
pub const SAISON_S7_FAHRPLAN_JSON: &str = include_str!("../../seed/saison-s7-fahrplan.json");

pub const BEKANNTE_QUELLEN: [&str; 8] = [
    "cpt-hedge",
    "lastwartutorial",
    "wardawgg",
    "lastwarvault",
    "pocketgamer",
    "packsify",
    "ldshop",
    "nutzerangabe",
];

pub const SEKUNDAER_QUELLEN: [&str; 14] = [
    "lastwar.wiki",
    "lastwarhandbook",
    "lastwarhub",
    "heaven-guardian",
    "lastwargame.online",
    "last-war-survival.fandom.com",
    "lastwarcodex",
    "lastwarsurvival.com",
    "metammo",
    "r5tools",
    "gamezoneacademy",
    "lastwar-tutorial.com",
    "reddit.com",
    "bluestacks.com",
];

pub fn ist_bekannte_quelle(q: &str) -> bool {
    BEKANNTE_QUELLEN.contains(&q) || SEKUNDAER_QUELLEN.contains(&q)
}

pub fn lade_kern_baum() -> Result<KernBaum, serde_json::Error> {
    let roh: KernBaumRoh = serde_json::from_str(SKILLS_ENGINEER_JSON)?;
    Ok(roh.into_baum())
}

pub fn lade_saison_skills() -> Result<SaisonSkills, serde_json::Error> {
    serde_json::from_str(SKILLS_SAISON_S6_JSON)
}

pub fn lade_helden() -> Result<HeldenDefinitionen, serde_json::Error> {
    serde_json::from_str(HELDEN_DEFINITIONEN_JSON)
}

pub fn lade_s7_fahrplan() -> Result<crate::model::saison::S7Fahrplan, serde_json::Error> {
    serde_json::from_str(SAISON_S7_FAHRPLAN_JSON)
}
