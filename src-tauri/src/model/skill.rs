use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Prioritaet {
    Prio,
    Skip,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SkillDef {
    pub id: String,
    pub name_de: Option<String>,
    pub name_en: Option<String>,
    pub unlock_level: Option<u32>,
    pub max_level: Option<u32>,
    pub effekt_pro_level: Option<String>,
    pub effekt_max: Option<String>,
    pub kategorie: Option<String>,
    pub prioritaet: Option<Prioritaet>,
    pub quelle: Vec<String>,
    pub is_unsicher: bool,
    pub konflikt_notiz: Option<String>,
}

impl SkillDef {
    pub fn anzeige_name(&self) -> String {
        self.name_de
            .clone()
            .or_else(|| self.name_en.clone())
            .unwrap_or_else(|| format!("{} (Name offen)", self.id))
    }

    pub fn effekt_auf_level(&self, level: u32) -> Option<String> {
        if level == 0 {
            return None;
        }
        if self.max_level == Some(level) {
            if let Some(max) = &self.effekt_max {
                return Some(max.clone());
            }
        }
        if let Some(pro) = &self.effekt_pro_level {
            return Some(format!("{} (Stufe {})", pro, level));
        }
        if let Some(max) = &self.effekt_max {
            return Some(max.clone());
        }
        Some("Effekt unbekannt".to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tier {
    pub level: u32,
    pub skills: Vec<SkillDef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PrioReihenfolge {
    pub quelle: Vec<String>,
    pub prio: Vec<String>,
    pub skip: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KernBaum {
    pub profession: String,
    pub baum: String,
    pub level_cap: u32,
    pub budget_punkte_lv100: u32,
    pub budget_hinweis: Option<String>,
    pub tiers_pro_5_level: u32,
    pub skills_pro_tier: u32,
    pub kern_skills_gesamt: u32,
    pub tiers: Vec<Tier>,
    pub unplatzierte_benannte_skills: Vec<SkillDef>,
    pub prioritaet_reihenfolge: PrioReihenfolge,
}

impl KernBaum {
    pub fn alle_skills(&self) -> Vec<&SkillDef> {
        let mut v: Vec<&SkillDef> = self.tiers.iter().flat_map(|t| t.skills.iter()).collect();
        v.extend(self.unplatzierte_benannte_skills.iter());
        v
    }

    pub fn kern_slot_anzahl(&self) -> usize {
        self.tiers.iter().map(|t| t.skills.len()).sum()
    }

    pub fn find_skill(&self, id: &str) -> Option<&SkillDef> {
        self.alle_skills().into_iter().find(|s| s.id == id)
    }

    pub fn tier_fuer_skill(&self, id: &str) -> Option<u32> {
        self.tiers
            .iter()
            .find(|t| t.skills.iter().any(|s| s.id == id))
            .map(|t| t.level)
    }

    pub fn ist_freigeschaltet(&self, skill_id: &str, profession_level: u32) -> bool {
        match self.tier_fuer_skill(skill_id) {
            Some(tier) => tier <= profession_level,
            None => self
                .unplatzierte_benannte_skills
                .iter()
                .any(|s| s.id == skill_id && s.unlock_level.unwrap_or(1) <= profession_level),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SkillDefRoh {
    pub id: String,
    pub name_de: Option<String>,
    pub name_en: Option<String>,
    pub max_level: Option<u32>,
    pub effekt_pro_level: Option<String>,
    pub effekt_max: Option<String>,
    pub kategorie: Option<String>,
    pub prioritaet: Option<Prioritaet>,
    #[serde(default)]
    pub quelle: Vec<String>,
    #[serde(default)]
    pub is_unsicher: bool,
    pub konflikt_notiz: Option<String>,
}

impl SkillDefRoh {
    fn into_def(self, unlock_level: Option<u32>) -> SkillDef {
        SkillDef {
            id: self.id,
            name_de: self.name_de,
            name_en: self.name_en,
            unlock_level,
            max_level: self.max_level,
            effekt_pro_level: self.effekt_pro_level,
            effekt_max: self.effekt_max,
            kategorie: self.kategorie,
            prioritaet: self.prioritaet,
            quelle: self.quelle,
            is_unsicher: self.is_unsicher,
            konflikt_notiz: self.konflikt_notiz,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TierRoh {
    pub level: u32,
    pub skills: Vec<SkillDefRoh>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KernBaumRoh {
    pub profession: String,
    pub baum: String,
    pub level_cap: u32,
    pub budget_punkte_lv100: u32,
    pub budget_hinweis: Option<String>,
    pub tiers_pro_5_level: u32,
    pub skills_pro_tier: u32,
    pub kern_skills_gesamt: u32,
    pub tiers: Vec<TierRoh>,
    pub unplatzierte_benannte_skills: Vec<SkillDefRoh>,
    pub prioritaet_reihenfolge: PrioReihenfolge,
}

impl KernBaumRoh {
    pub fn into_baum(self) -> KernBaum {
        let tiers = self
            .tiers
            .into_iter()
            .map(|t| Tier {
                level: t.level,
                skills: t
                    .skills
                    .into_iter()
                    .map(|s| s.into_def(Some(t.level)))
                    .collect(),
            })
            .collect();
        let unplatzierte_benannte_skills = self
            .unplatzierte_benannte_skills
            .into_iter()
            .map(|s| s.into_def(None))
            .collect();
        KernBaum {
            profession: self.profession,
            baum: self.baum,
            level_cap: self.level_cap,
            budget_punkte_lv100: self.budget_punkte_lv100,
            budget_hinweis: self.budget_hinweis,
            tiers_pro_5_level: self.tiers_pro_5_level,
            skills_pro_tier: self.skills_pro_tier,
            kern_skills_gesamt: self.kern_skills_gesamt,
            tiers,
            unplatzierte_benannte_skills,
            prioritaet_reihenfolge: self.prioritaet_reihenfolge,
        }
    }
}
