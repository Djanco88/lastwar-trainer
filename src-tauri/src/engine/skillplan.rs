use std::collections::HashMap;

use crate::model::skill::{KernBaum, Prioritaet, SkillDef};

#[derive(Debug, Clone, PartialEq)]
pub struct SkillDiff {
    pub skill_id: String,
    pub name: String,
    pub ist: u32,
    pub soll: u32,
    pub delta: i64,
}

pub fn budget_fuer_level(baum: &KernBaum, profession_level: u32) -> u32 {
    let level = profession_level.min(baum.level_cap);
    let linear = (baum.budget_punkte_lv100 as u64 * level as u64 / baum.level_cap as u64) as u32;
    linear.min(baum.budget_punkte_lv100)
}

pub fn validate_kern_allocation(
    baum: &KernBaum,
    alloc: &HashMap<String, u32>,
    profession_level: u32,
    budget: u32,
) -> Result<(), Vec<String>> {
    let mut fehler = Vec::new();
    let summe: u32 = alloc.values().sum();
    if summe > budget {
        fehler.push(format!(
            "Budget ueberschritten: {} Punkte von {} verbraucht",
            summe, budget
        ));
    }
    for (id, level) in alloc {
        match baum.find_skill(id) {
            None => fehler.push(format!("Unbekannter Skill: {}", id)),
            Some(skill) => {
                if let Some(max) = skill.max_level {
                    if *level > max {
                        fehler.push(format!(
                            "{} ueberschreitet Max-Level {} (ist {})",
                            id, max, level
                        ));
                    }
                }
                if !baum.ist_freigeschaltet(id, profession_level) {
                    fehler.push(format!(
                        "{} ist auf Profession-Level {} nicht freigeschaltet",
                        id, profession_level
                    ));
                }
            }
        }
    }
    if fehler.is_empty() {
        Ok(())
    } else {
        Err(fehler)
    }
}

pub fn prio_liste(baum: &KernBaum) -> Vec<&SkillDef> {
    baum.prioritaet_reihenfolge
        .prio
        .iter()
        .filter_map(|id| baum.find_skill(id))
        .collect()
}

pub fn skip_liste(baum: &KernBaum) -> Vec<&SkillDef> {
    baum.prioritaet_reihenfolge
        .skip
        .iter()
        .filter_map(|id| baum.find_skill(id))
        .collect()
}

pub fn naechste_prio_punkte(
    baum: &KernBaum,
    alloc: &HashMap<String, u32>,
    profession_level: u32,
    budget: u32,
) -> Vec<(String, u32)> {
    let summe: u32 = alloc.values().sum();
    let mut freie = budget.saturating_sub(summe);
    let mut vorschlaege = Vec::new();
    for skill in prio_liste(baum) {
        if freie == 0 {
            break;
        }
        if !baum.ist_freigeschaltet(&skill.id, profession_level) {
            continue;
        }
        let ist = alloc.get(&skill.id).copied().unwrap_or(0);
        let max = skill.max_level.unwrap_or(0);
        if ist < max {
            let naechster = ist + 1;
            vorschlaege.push((skill.id.clone(), naechster));
            freie -= 1;
        }
    }
    vorschlaege
}

pub fn ist_soll_vergleich(
    baum: &KernBaum,
    ist: &HashMap<String, u32>,
    soll: &HashMap<String, u32>,
) -> Vec<SkillDiff> {
    let mut ids: Vec<&String> = ist.keys().chain(soll.keys()).collect();
    ids.sort();
    ids.dedup();
    ids.iter()
        .filter_map(|id| {
            let i = ist.get(*id).copied().unwrap_or(0);
            let s = soll.get(*id).copied().unwrap_or(0);
            if i == s {
                return None;
            }
            let skill = baum.find_skill(id);
            Some(SkillDiff {
                skill_id: (*id).clone(),
                name: skill
                    .map(|s| s.anzeige_name())
                    .unwrap_or_else(|| (*id).clone()),
                ist: i,
                soll: s,
                delta: s as i64 - i as i64,
            })
        })
        .collect()
}

pub fn saison_erstattung(saison_alloc: &HashMap<String, u32>) -> u32 {
    saison_alloc.values().sum()
}

pub fn respec_plan(
    baum: &KernBaum,
    ist: &HashMap<String, u32>,
    saison_alloc: &HashMap<String, u32>,
    profession_level: u32,
) -> HashMap<String, u32> {
    let erstattung = saison_erstattung(saison_alloc);
    let budget = budget_fuer_level(baum, profession_level) + erstattung;
    let mut ziel: HashMap<String, u32> = HashMap::new();
    let mut freie = budget;
    for skill in prio_liste(baum) {
        if !baum.ist_freigeschaltet(&skill.id, profession_level) {
            continue;
        }
        let max = skill.max_level.unwrap_or(0);
        let alt = ist.get(&skill.id).copied().unwrap_or(0);
        let nehm = max.min(alt + freie).min(max);
        if nehm > 0 {
            ziel.insert(skill.id.clone(), nehm);
            freie = freie.saturating_sub(nehm.saturating_sub(alt));
        }
    }
    ziel
}

pub fn prioritaet_von(skill: &SkillDef) -> Option<Prioritaet> {
    skill.prioritaet
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed_data;

    fn baum() -> KernBaum {
        seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("seed: {}", e))
    }

    #[test]
    fn kernbaum_hat_21_tiers_und_42_slots() {
        let b = baum();
        assert_eq!(b.tiers.len(), 21);
        assert_eq!(b.kern_slot_anzahl(), 42);
        assert_eq!(b.kern_skills_gesamt, 42);
        for (i, t) in b.tiers.iter().enumerate() {
            let erwartet = if i == 0 { 1 } else { 5 * i as u32 };
            assert_eq!(t.level, erwartet);
            assert_eq!(t.skills.len(), 2);
        }
    }

    #[test]
    fn budget_lv100_ist_125() {
        let b = baum();
        assert_eq!(b.budget_punkte_lv100, 125);
        assert_eq!(budget_fuer_level(&b, 100), 125);
    }

    #[test]
    fn prio_reihenfolge_entspricht_vorgabe() {
        let b = baum();
        let prio: Vec<&str> = prio_liste(&b).iter().map(|s| s.id.as_str()).collect();
        assert_eq!(
            prio,
            vec![
                "one_more_time",
                "build_now",
                "research_now",
                "master_builder",
                "medical_aid",
                "rapid_production",
                "resource_saving",
                "recycling",
                "outstanding_contribution",
                "extra_meal",
                "free_teleport",
                "speedup_box"
            ]
        );
        let skip: Vec<&str> = skip_liste(&b).iter().map(|s| s.id.as_str()).collect();
        assert_eq!(
            skip,
            vec![
                "random_visitors",
                "durability_mine",
                "win_win_cooperation",
                "fearless_defense",
                "blast"
            ]
        );
    }

    #[test]
    fn validierung_erkennt_budget_und_maxlevel_und_sperre() {
        let b = baum();
        let mut alloc = HashMap::new();
        alloc.insert("rapid_production".to_string(), 5u32);
        assert!(validate_kern_allocation(&b, &alloc, 100, 125).is_ok());
        alloc.insert("rapid_production".to_string(), 6u32);
        let fehler = validate_kern_allocation(&b, &alloc, 100, 125).unwrap_err();
        assert!(fehler.iter().any(|f| f.contains("Max-Level")));
        let mut alloc2 = HashMap::new();
        alloc2.insert("master_builder".to_string(), 5u32);
        let fehler2 = validate_kern_allocation(&b, &alloc2, 60, 125).unwrap_err();
        assert!(fehler2.iter().any(|f| f.contains("nicht freigeschaltet")));
        let mut alloc3 = HashMap::new();
        alloc3.insert("rapid_production".to_string(), 5u32);
        alloc3.insert("build_now".to_string(), 5u32);
        alloc3.insert("research_now".to_string(), 5u32);
        alloc3.insert("master_builder".to_string(), 5u32);
        alloc3.insert("resource_saving".to_string(), 5u32);
        alloc3.insert("recycling".to_string(), 5u32);
        alloc3.insert("build_for_free".to_string(), 5u32);
        alloc3.insert("research_for_free".to_string(), 5u32);
        alloc3.insert("efficient_gathering".to_string(), 5u32);
        alloc3.insert("first_aid_expert".to_string(), 5u32);
        alloc3.insert("instant_gathering".to_string(), 5u32);
        alloc3.insert("monster_tracking".to_string(), 5u32);
        alloc3.insert("outstanding_contribution".to_string(), 1u32);
        alloc3.insert("extra_meal".to_string(), 1u32);
        alloc3.insert("speedup_box".to_string(), 5u32);
        alloc3.insert("one_more_time".to_string(), 5u32);
        alloc3.insert("battlefield_cleanup".to_string(), 5u32);
        alloc3.insert("fearless_defense".to_string(), 5u32);
        alloc3.insert("drone_supply".to_string(), 5u32);
        alloc3.insert("support_boost".to_string(), 5u32);
        alloc3.insert("friendly_aid".to_string(), 5u32);
        alloc3.insert("cooperative_construction".to_string(), 5u32);
        alloc3.insert("cooperative_research".to_string(), 5u32);
        alloc3.insert("random_visitors".to_string(), 5u32);
        alloc3.insert("durability_mine".to_string(), 5u32);
        alloc3.insert("medical_aid".to_string(), 5u32);
        alloc3.insert("siege_mastery".to_string(), 5u32);
        alloc3.insert("free_teleport".to_string(), 5u32);
        assert!(alloc3.values().sum::<u32>() > 125);
        let fehler3 = validate_kern_allocation(&b, &alloc3, 100, 125).unwrap_err();
        assert!(fehler3.iter().any(|f| f.contains("Budget")));
    }

    #[test]
    fn naechste_prio_punkte_folgen_reihenfolge() {
        let b = baum();
        let alloc = HashMap::new();
        let v = naechste_prio_punkte(&b, &alloc, 100, 125);
        assert_eq!(v[0], ("one_more_time".to_string(), 1));
        assert_eq!(v[1], ("build_now".to_string(), 1));
    }

    #[test]
    fn ist_soll_vergleichfindet_diffs() {
        let b = baum();
        let mut ist = HashMap::new();
        ist.insert("rapid_production".to_string(), 3u32);
        let mut soll = HashMap::new();
        soll.insert("rapid_production".to_string(), 5u32);
        soll.insert("master_builder".to_string(), 5u32);
        let diffs = ist_soll_vergleich(&b, &ist, &soll);
        assert_eq!(diffs.len(), 2);
        let rp = diffs.iter().find(|d| d.skill_id == "rapid_production");
        assert!(rp.is_some());
        assert_eq!(rp.map(|d| d.delta), Some(2));
    }

    #[test]
    fn saison_erstattung_summiert_alle_saisonpunkte() {
        let mut s = HashMap::new();
        s.insert("s6_combat_experience".to_string(), 3u32);
        s.insert("s6_extra_war_merit".to_string(), 5u32);
        assert_eq!(saison_erstattung(&s), 8);
    }

    #[test]
    fn respec_plan_fuellt_prio_bis_budget() {
        let b = baum();
        let ist = HashMap::new();
        let mut saison = HashMap::new();
        saison.insert("s6_combat_experience".to_string(), 3u32);
        let ziel = respec_plan(&b, &ist, &saison, 100);
        let summe: u32 = ziel.values().sum();
        assert!(summe <= 125 + 3);
        assert_eq!(ziel.get("one_more_time"), Some(&5));
    }

    #[test]
    fn effekt_anzeige_je_level() {
        let b = baum();
        let mb = b.find_skill("master_builder");
        assert!(mb.is_some());
        let mb = mb.unwrap_or_else(|| panic!("master_builder fehlt"));
        assert!(mb.effekt_auf_level(0).is_none());
        let eff5 = mb
            .effekt_auf_level(5)
            .unwrap_or_else(|| panic!("Effekt bei Stufe 5 fehlt"));
        assert!(eff5.contains("25"));
        let ohne = b.find_skill("recycling");
        assert!(ohne.is_some());
        let ohne = ohne.unwrap_or_else(|| panic!("recycling fehlt"));
        assert_eq!(
            ohne.effekt_auf_level(1).unwrap_or_default(),
            "Effekt unbekannt"
        );
    }
}
