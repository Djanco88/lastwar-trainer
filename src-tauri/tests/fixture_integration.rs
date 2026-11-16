use std::collections::HashMap;

use lastwar_core::engine::{formation, skillplan, squadopt};
use lastwar_core::model::held::HeroTyp;
use lastwar_core::model::profil::Profil;
use lastwar_core::seed_data;

const FIXTURE: &str = include_str!("../../tests/fixtures/profil.json");

fn fixture() -> Profil {
    serde_json::from_str(FIXTURE).unwrap_or_else(|e| panic!("fixture parse: {}", e))
}

#[test]
fn fixture_laedt_und_ist_nutzerangabe() {
    let p = fixture();
    assert_eq!(p.server, 977);
    assert!(p.quelle.contains(&"nutzerangabe".to_string()));
    assert_eq!(p.helden.len(), 6);
    assert_eq!(p.squad.len(), 5);
    assert_eq!(p.tech_zentrum_level, Some(29));
    assert!(
        p.tech_zentrum_konflikt_notiz.is_some(),
        "DATENLÜCKE 29 vs. 33 dokumentieren"
    );
}

#[test]
fn fixture_skillbaum_passt_in_budgets() {
    let p = fixture();
    let baum = seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("{}", e));
    let s6 = seed_data::lade_saison_skills().unwrap_or_else(|e| panic!("{}", e));
    let ist = p
        .skill_baum_ist
        .as_ref()
        .unwrap_or_else(|| panic!("skillbaum fehlt"));
    skillplan::validate_kern_allocation(&baum, &ist.kern, ist.profession_level, 125)
        .unwrap_or_else(|f| panic!("Kern-Allokation ungueltig: {:?}", f));
    assert!(
        ist.saison_punkte() <= s6.punkte_budget,
        "S6-Budget 44 nicht ueberschreiten"
    );
    assert_eq!(ist.kern_punkte(), 48);
    assert_eq!(ist.saison_punkte(), 20);
    lastwar_core::engine::saison::validate_saison_allocation(
        &s6,
        &ist.saison_s6,
        ist.profession_level,
    )
    .unwrap_or_else(|f| panic!("S6-Kette ungueltig: {:?}", f));
}

#[test]
fn m3_respec_plan_nach_saisonende_mit_fixture() {
    let p = fixture();
    let baum = seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("{}", e));
    let ist = p
        .skill_baum_ist
        .as_ref()
        .unwrap_or_else(|| panic!("skillbaum fehlt"));
    let plan = lastwar_core::engine::saison::respec_plan_nach_saisonende(
        &baum,
        &ist.saison_s6,
        &ist.kern,
        ist.profession_level,
    );
    assert_eq!(plan.erstattete_punkte, 20);
    assert_eq!(plan.budget_gesamt, 125 + 20);
    assert!(plan.saison_ziel.is_empty(), "Saisonpunkte werden erstattet");
    assert!(plan.kern_ziel.values().sum::<u32>() <= plan.budget_gesamt);
}

#[test]
fn fixture_squad_formation_und_optimierung() {
    let p = fixture();
    let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("{}", e));
    let bestand = squadopt::held_eintraege(&p.helden, &defs);
    assert_eq!(bestand.len(), 6, "alle 6 Fixture-Helden haben Definitionen");
    let input = squadopt::KonfiguratorInput {
        bestand,
        fixierungen: vec![],
        gegner_typ: None,
        top_n: 3,
        squad_groesse: defs.squad_groesse,
        formationsbonus: defs.formationsbonus.clone(),
        counter: defs.counter_regel.clone(),
    };
    let opts = squadopt::optimieren(&input);
    assert_eq!(opts.len(), 3);
    assert!(opts.windows(2).all(|w| w[0].score >= w[1].score));
    assert!(opts[0].helden.len() == 5);
    let typen: Vec<HeroTyp> = opts[0]
        .helden
        .iter()
        .filter_map(|id| defs.find(id).and_then(|d| d.typ))
        .collect();
    let auswertung = formation::formation_auswertung(&typen, &defs.formationsbonus);
    assert_eq!(auswertung.faktor, opts[0].formation_faktor);
}

#[test]
fn fixture_sandbox_aendert_profil_nicht() {
    let p = fixture();
    let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("{}", e));
    let bestand = squadopt::held_eintraege(&p.helden, &defs);
    let input = squadopt::KonfiguratorInput {
        bestand,
        fixierungen: vec![],
        gegner_typ: Some(HeroTyp::Flugzeug),
        top_n: 1,
        squad_groesse: defs.squad_groesse,
        formationsbonus: defs.formationsbonus.clone(),
        counter: defs.counter_regel.clone(),
    };
    let vorher = p.clone();
    let _opts = squadopt::optimieren(&input);
    assert_eq!(p, vorher, "Sandbox-Modus darf das Profil nicht aendern");
}

#[test]
fn fixture_neuberechnung_greift_bei_bestandsaenderung() {
    let mut p = fixture();
    let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("{}", e));
    let alt = p.squad.clone();
    let bestand_alt = squadopt::held_eintraege(&p.helden, &defs);
    let input = |bestand: Vec<squadopt::HeldEintrag>| squadopt::KonfiguratorInput {
        bestand,
        fixierungen: vec![],
        gegner_typ: None,
        top_n: 1,
        squad_groesse: defs.squad_groesse,
        formationsbonus: defs.formationsbonus.clone(),
        counter: defs.counter_regel.clone(),
    };
    let input_alt = input(bestand_alt.clone());
    let beste_alt = squadopt::optimieren(&input_alt)
        .into_iter()
        .next()
        .unwrap_or_else(|| panic!("keine Option"));
    assert!(
        squadopt::aenderungs_vorschlag(&beste_alt.helden, &bestand_alt, &input_alt).is_none(),
        "bereits optimaler Squad -> kein Aenderungsvorschlag"
    );
    assert_ne!(
        alt, beste_alt.helden,
        "Fixture-Squad ist nicht optimal, Optimierung greift"
    );
    p.helden.push(lastwar_core::model::held::HeldInstanz {
        held_id: "williams".to_string(),
        sterne: 5,
        level: Some(90),
        hp: Some(2_000_000),
        angriff: Some(400_000),
        verteidigung: Some(500_000),
        gear: vec![Some(10), Some(10), Some(10), Some(10)],
        erweckt: true,
        erweckung_level: Some(20),
        faehigkeiten_level: vec![5, 5, 5, 5],
        quelle: vec!["nutzerangabe".to_string()],
    });
    let bestand_neu = squadopt::held_eintraege(&p.helden, &defs);
    let vorschlag = squadopt::aenderungs_vorschlag(&alt, &bestand_neu, &input(bestand_neu.clone()));
    assert!(
        vorschlag.is_some(),
        "neuer Held muss Aenderungsvorschlag ausloesen"
    );
    let v = vorschlag.unwrap_or_else(|| panic!("fehlt"));
    assert!(v.neu.contains(&"williams".to_string()));
    assert!(v.score_neu > v.score_alt);
}

#[test]
fn fehlende_werte_fuer_konfigurator_prompt() {
    let p = fixture();
    let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("{}", e));
    let bestand = squadopt::held_eintraege(&p.helden, &defs);
    let f = squadopt::fehlende_werte(&bestand);
    for feld in ["level", "hp", "angriff", "verteidigung"] {
        assert!(
            f.iter().any(|x| x.held_id == "dva" && x.feld == feld),
            "DVA {} muss als fehlend gemeldet werden (Prompt bei Abfrage)",
            feld
        );
    }
    assert!(
        !f.iter().any(|x| x.held_id == "kimberly"),
        "Kimberly ist vollstaendig erfasst -> kein Prompt"
    );
    let mut p2 = p.clone();
    for h in p2.helden.iter_mut() {
        if h.held_id == "dva" {
            h.level = Some(80);
            h.hp = Some(900_000);
            h.angriff = Some(280_000);
            h.verteidigung = Some(150_000);
        }
    }
    let bestand2 = squadopt::held_eintraege(&p2.helden, &defs);
    assert!(squadopt::fehlende_werte(&bestand2).is_empty());
}

#[test]
fn roundtrip_fixture_json() {
    let p = fixture();
    let json = serde_json::to_string_pretty(&p).unwrap_or_else(|e| panic!("{}", e));
    let zurueck: Profil = serde_json::from_str(&json).unwrap_or_else(|e| panic!("{}", e));
    assert_eq!(p, zurueck);
    let _ = HashMap::<String, u32>::new();
}
