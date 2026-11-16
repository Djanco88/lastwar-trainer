use std::collections::HashMap;

use chrono::{Duration, NaiveDate};

use crate::engine::skillplan;
use crate::model::saison::{S7Fahrplan, SaisonSkills};
use crate::model::skill::KernBaum;

#[derive(Debug, Clone, PartialEq)]
pub struct RespecPlan {
    pub kern_ziel: HashMap<String, u32>,
    pub saison_ziel: HashMap<String, u32>,
    pub erstattete_punkte: u32,
    pub budget_gesamt: u32,
    pub erklaerung: Vec<String>,
}

pub fn validate_saison_allocation(
    saison: &SaisonSkills,
    alloc: &HashMap<String, u32>,
    profession_level: u32,
) -> Result<(), Vec<String>> {
    let mut fehler = Vec::new();
    let summe: u32 = alloc.values().sum();
    if summe > saison.punkte_budget {
        fehler.push(format!(
            "S{}-Budget ueberschritten: {} von {} Punkten",
            saison.saison, summe, saison.punkte_budget
        ));
    }
    let mut luecke = false;
    for skill in &saison.skills {
        let level = alloc.get(&skill.id).copied().unwrap_or(0);
        if level > 0 {
            if luecke {
                fehler.push(format!(
                    "S{}: lineare Kette — '{}' hat 0 Punkte, aber '{}' hat {} (kein Ueberspringen)",
                    saison.saison, skill.id, skill.id, level
                ));
            }
            if let Some(max) = skill.max_level {
                if level > max {
                    fehler.push(format!("{} ueberschreitet Max-Level {}", skill.id, max));
                }
            }
            if let Some(unlock) = skill.unlock_level {
                if unlock > profession_level {
                    fehler.push(format!(
                        "{} ist auf Profession-Level {} nicht freigeschaltet (Unlock {})",
                        skill.id, profession_level, unlock
                    ));
                }
            }
        } else {
            luecke = true;
        }
    }
    for id in alloc.keys() {
        if saison.find(id).is_none() {
            fehler.push(format!("Unbekannter S{}-Skill: {}", saison.saison, id));
        }
    }
    if fehler.is_empty() {
        Ok(())
    } else {
        Err(fehler)
    }
}

pub fn saisonende_erstattung(saison_alloc: &HashMap<String, u32>) -> u32 {
    skillplan::saison_erstattung(saison_alloc)
}

pub fn respec_plan_nach_saisonende(
    baum: &KernBaum,
    saison_alloc: &HashMap<String, u32>,
    ist_kern: &HashMap<String, u32>,
    profession_level: u32,
) -> RespecPlan {
    let erstattung = saisonende_erstattung(saison_alloc);
    let kern_budget = skillplan::budget_fuer_level(baum, profession_level);
    let budget_gesamt = kern_budget + erstattung;
    let mut kern_ziel: HashMap<String, u32> = HashMap::new();
    let mut freie = budget_gesamt;
    let mut erklaerung = vec![format!(
        "Saisonende: {} Saisonpunkte werden voll erstattet und stehen zusaetzlich zum Kern-Budget ({}) zur Verfuegung -> {} Punkte gesamt.",
        erstattung, kern_budget, budget_gesamt
    )];
    for skill in skillplan::prio_liste(baum) {
        if !baum.ist_freigeschaltet(&skill.id, profession_level) {
            continue;
        }
        let max = skill.max_level.unwrap_or(0);
        let alt = ist_kern.get(&skill.id).copied().unwrap_or(0);
        let nehm = max.min(alt + freie);
        if nehm > 0 {
            kern_ziel.insert(skill.id.clone(), nehm);
            freie = freie.saturating_sub(nehm.saturating_sub(alt));
        }
    }
    erklaerung.push(format!(
        "Kern-Ziel nach Prio-Reihenfolge gefuellt: {} Punkte von {} vergeben, {} unverteilt.",
        kern_ziel.values().sum::<u32>(),
        budget_gesamt,
        freie
    ));
    erklaerung.push(
        "Saison-Ziel bleibt leer: Saisonpunkte wurden erstattet (Saisonspalte startet jede Saison bei 0)."
            .to_string(),
    );
    RespecPlan {
        kern_ziel,
        saison_ziel: HashMap::new(),
        erstattete_punkte: erstattung,
        budget_gesamt,
        erklaerung,
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Phase {
    pub id: String,
    pub name_de: String,
    pub start: Option<NaiveDate>,
    pub dauer_tage: u32,
}

pub fn s7_phasen(fahrplan: &S7Fahrplan, pre_season_start: Option<NaiveDate>) -> Vec<Phase> {
    let z = &fahrplan.zyklus;
    let pre_tage = z.pre_season_wochen * 7;
    let haupt_tage = z.haupt_saison_wochen * 7;
    let cel_tage = z.celebration_week * 7;
    let (pre, haupt, cel, off) = match pre_season_start {
        Some(s) => {
            let h = s + Duration::days(pre_tage as i64);
            let c = h + Duration::days(haupt_tage as i64);
            let o = c + Duration::days(cel_tage as i64);
            (Some(s), Some(h), Some(c), Some(o))
        }
        None => (None, None, None, None),
    };
    vec![
        Phase {
            id: "pre_season".to_string(),
            name_de: format!("S{} Präseason", fahrplan.saison),
            start: pre,
            dauer_tage: pre_tage,
        },
        Phase {
            id: "haupt".to_string(),
            name_de: format!("S{} Hauptsaison", fahrplan.saison),
            start: haupt,
            dauer_tage: haupt_tage,
        },
        Phase {
            id: "celebration".to_string(),
            name_de: "Celebration Week".to_string(),
            start: cel,
            dauer_tage: cel_tage,
        },
        Phase {
            id: "off_season".to_string(),
            name_de: "Off-Season".to_string(),
            start: off,
            dauer_tage: 0,
        },
    ]
}

pub fn countdown_tage(ziel: Option<NaiveDate>, heute: NaiveDate) -> Option<i64> {
    ziel.map(|z| (z - heute).num_days())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed_data;

    fn s6() -> SaisonSkills {
        seed_data::lade_saison_skills().unwrap_or_else(|e| panic!("{}", e))
    }

    fn baum() -> KernBaum {
        seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("{}", e))
    }

    #[test]
    fn saison_kette_erlaubt_praefix_und_verbietet_luecken() {
        let s = s6();
        let mut ok = HashMap::new();
        ok.insert("s6_combat_experience".to_string(), 3u32);
        ok.insert("s6_building_inspiration_1".to_string(), 3u32);
        assert!(validate_saison_allocation(&s, &ok, 100).is_ok());
        let mut luecke = ok.clone();
        luecke.insert("s6_double_exchange".to_string(), 3u32);
        let fehler = validate_saison_allocation(&s, &luecke, 100).unwrap_err();
        assert!(fehler.iter().any(|f| f.contains("lineare Kette")));
    }

    #[test]
    fn saison_budget_maxlevel_unlock_werden_geprueft() {
        let s = s6();
        let mut over = HashMap::new();
        over.insert("s6_combat_experience".to_string(), 3u32);
        over.insert("s6_building_inspiration_1".to_string(), 3u32);
        over.insert("s6_rainforest_style".to_string(), 1u32);
        over.insert("s6_double_exchange".to_string(), 3u32);
        over.insert("s6_professional_insights".to_string(), 5u32);
        over.insert("s6_extra_war_merit".to_string(), 5u32);
        over.insert("s6_multi_fishing".to_string(), 1u32);
        over.insert("s6_golden_bait".to_string(), 1u32);
        over.insert("s6_golden_fish_chest".to_string(), 3u32);
        over.insert("s6_homeland_attack".to_string(), 3u32);
        over.insert("s6_homeland_defense".to_string(), 3u32);
        over.insert("s6_invasion_attack".to_string(), 3u32);
        over.insert("s6_invasion_defense".to_string(), 3u32);
        over.insert("s6_ruins_expert".to_string(), 1u32);
        over.insert("s6_free_advanced_teleport".to_string(), 1u32);
        over.insert("s6_trade_discount".to_string(), 1u32);
        over.insert("s6_summon_mummies".to_string(), 1u32);
        over.insert("s6_buddy_fortify".to_string(), 1u32);
        over.insert("s6_wall_fortify".to_string(), 1u32);
        over.insert("s6_offen_a".to_string(), 5u32);
        assert!(over.values().sum::<u32>() > 44);
        assert!(
            validate_saison_allocation(&s, &over, 100).is_err(),
            "ueber 44 Punkte"
        );
        let mut maxfehler = HashMap::new();
        maxfehler.insert("s6_combat_experience".to_string(), 4u32);
        let fehler = validate_saison_allocation(&s, &maxfehler, 100).unwrap_err();
        assert!(fehler.iter().any(|f| f.contains("Max-Level")));
        let mut locked = HashMap::new();
        locked.insert("s6_combat_experience".to_string(), 3u32);
        locked.insert("s6_building_inspiration_1".to_string(), 3u32);
        locked.insert("s6_rainforest_style".to_string(), 1u32);
        locked.insert("s6_double_exchange".to_string(), 3u32);
        locked.insert("s6_professional_insights".to_string(), 5u32);
        locked.insert("s6_extra_war_merit".to_string(), 5u32);
        let fehler2 = validate_saison_allocation(&s, &locked, 25).unwrap_err();
        assert!(fehler2.iter().any(|f| f.contains("nicht freigeschaltet")));
    }

    #[test]
    fn respec_nach_saisonende_rechnet_erstattung_ein() {
        let b = baum();
        let mut saison = HashMap::new();
        saison.insert("s6_combat_experience".to_string(), 3u32);
        saison.insert("s6_extra_war_merit".to_string(), 5u32);
        let ist = HashMap::new();
        let plan = respec_plan_nach_saisonende(&b, &saison, &ist, 100);
        assert_eq!(plan.erstattete_punkte, 8);
        assert_eq!(plan.budget_gesamt, 125 + 8);
        assert!(plan.saison_ziel.is_empty());
        assert_eq!(plan.kern_ziel.get("one_more_time"), Some(&5));
        assert!(plan.kern_ziel.values().sum::<u32>() <= plan.budget_gesamt);
        assert!(!plan.erklaerung.is_empty());
    }

    #[test]
    fn s7_phasen_aus_pre_season_start_2026_11_09() {
        let f = seed_data::lade_s7_fahrplan().unwrap_or_else(|e| panic!("{}", e));
        let start =
            NaiveDate::parse_from_str("2026-11-09", "%Y-%m-%d").unwrap_or_else(|e| panic!("{}", e));
        let phasen = s7_phasen(&f, Some(start));
        assert_eq!(phasen.len(), 4);
        assert_eq!(phasen[0].start, Some(start));
        assert_eq!(phasen[0].dauer_tage, 14);
        assert_eq!(
            phasen[1].start,
            Some(
                NaiveDate::parse_from_str("2026-11-23", "%Y-%m-%d")
                    .unwrap_or_else(|e| panic!("{}", e))
            )
        );
        assert_eq!(phasen[1].dauer_tage, 56);
        assert_eq!(
            phasen[2].start,
            Some(
                NaiveDate::parse_from_str("2027-01-18", "%Y-%m-%d")
                    .unwrap_or_else(|e| panic!("{}", e))
            )
        );
        assert_eq!(
            phasen[3].start,
            phasen[2].start.map(|c| c + Duration::days(7))
        );
    }

    #[test]
    fn s7_phasen_ohne_server977_termin_bleiben_null() {
        let f = seed_data::lade_s7_fahrplan().unwrap_or_else(|e| panic!("{}", e));
        assert!(f.server_977.pre_season_start.is_none());
        let phasen = s7_phasen(&f, None);
        assert!(
            phasen.iter().all(|p| p.start.is_none()),
            "DATENLÜCKE: Server 977 -> null"
        );
    }

    #[test]
    fn s7_offsets_aus_editierbarem_server977_start() {
        let f = seed_data::lade_s7_fahrplan().unwrap_or_else(|e| panic!("{}", e));
        let start =
            NaiveDate::parse_from_str("2026-11-16", "%Y-%m-%d").unwrap_or_else(|e| panic!("{}", e));
        let phasen = s7_phasen(&f, Some(start));
        assert_eq!(phasen[0].start, Some(start));
        assert_eq!(phasen[1].start, Some(start + Duration::days(14)));
        assert_eq!(phasen[2].start, Some(start + Duration::days(70)));
        assert_eq!(phasen[3].start, Some(start + Duration::days(77)));
    }

    #[test]
    fn countdown_tage_bis_start() {
        let heute =
            NaiveDate::parse_from_str("2026-11-01", "%Y-%m-%d").unwrap_or_else(|e| panic!("{}", e));
        let ziel =
            NaiveDate::parse_from_str("2026-11-09", "%Y-%m-%d").unwrap_or_else(|e| panic!("{}", e));
        assert_eq!(countdown_tage(Some(ziel), heute), Some(8));
        assert_eq!(countdown_tage(None, heute), None);
    }
}
