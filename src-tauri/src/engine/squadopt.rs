use serde::{Deserialize, Serialize};

use crate::engine::formation;
use crate::model::held::{
    CounterRegel, FormationsbonusRegel, HeldDef, HeldInstanz, HeldenDefinitionen, HeroTyp,
};
use crate::model::squad::{AenderungsVorschlag, SquadOption};

pub const LEVEL_FAKTOR_PRO_STUFE: f64 = 0.02;
pub const STERN_FAKTOR_PRO_STERN: f64 = 0.05;
pub const GEAR_FAKTOR_PRO_STUFE: f64 = 0.01;
pub const ERWECKT_FAKTOR: f64 = 1.20;

#[derive(Debug, Clone)]
pub struct HeldEintrag {
    pub instanz: HeldInstanz,
    pub def: HeldDef,
    pub staerke: f64,
    pub typ: Option<HeroTyp>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FehlenderWert {
    pub held_id: String,
    pub feld: String,
}

pub fn fehlende_werte(bestand: &[HeldEintrag]) -> Vec<FehlenderWert> {
    let mut out = Vec::new();
    for h in bestand {
        let id = &h.instanz.held_id;
        if h.instanz.level.is_none() {
            out.push(FehlenderWert {
                held_id: id.clone(),
                feld: "level".to_string(),
            });
        }
        if h.instanz.hp.is_none() {
            out.push(FehlenderWert {
                held_id: id.clone(),
                feld: "hp".to_string(),
            });
        }
        if h.instanz.angriff.is_none() {
            out.push(FehlenderWert {
                held_id: id.clone(),
                feld: "angriff".to_string(),
            });
        }
        if h.instanz.verteidigung.is_none() {
            out.push(FehlenderWert {
                held_id: id.clone(),
                feld: "verteidigung".to_string(),
            });
        }
    }
    out
}

pub fn helden_staerke(instanz: &HeldInstanz, def: &HeldDef) -> f64 {
    let basis = instanz.hp.unwrap_or(0) as f64
        + instanz.angriff.unwrap_or(0) as f64
        + instanz.verteidigung.unwrap_or(0) as f64;
    let level_faktor = match instanz.level {
        Some(l) if l > 1 => 1.0 + LEVEL_FAKTOR_PRO_STUFE * (l - 1) as f64,
        _ => 1.0,
    };
    let stern_faktor = 1.0 + STERN_FAKTOR_PRO_STERN * instanz.sterne.saturating_sub(1) as f64;
    let gear_faktor = 1.0 + GEAR_FAKTOR_PRO_STUFE * instanz.gear_summe() as f64;
    let erweckt_faktor = if instanz.erweckt { ERWECKT_FAKTOR } else { 1.0 };
    let _ = def;
    basis * level_faktor * stern_faktor * gear_faktor * erweckt_faktor
}

pub fn held_eintraege(helden: &[HeldInstanz], defs: &HeldenDefinitionen) -> Vec<HeldEintrag> {
    helden
        .iter()
        .filter_map(|h| {
            defs.find(&h.held_id).map(|d| HeldEintrag {
                staerke: helden_staerke(h, d),
                instanz: h.clone(),
                typ: d.typ,
                def: d.clone(),
            })
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct KonfiguratorInput {
    pub bestand: Vec<HeldEintrag>,
    pub fixierungen: Vec<String>,
    pub gegner_typ: Option<HeroTyp>,
    pub top_n: usize,
    pub squad_groesse: usize,
    pub formationsbonus: FormationsbonusRegel,
    pub counter: CounterRegel,
}

pub fn kombinationen_anzahl(bestand: usize, squad_groesse: usize) -> u128 {
    if squad_groesse > bestand {
        return 0;
    }
    let n = bestand as u128;
    let k = squad_groesse as u128;
    let mut result: u128 = 1;
    for i in 0..k {
        result = result * (n - i) / (i + 1);
    }
    result
}

fn kombinationen(pool: &[usize], k: usize) -> Vec<Vec<usize>> {
    let mut out = Vec::new();
    let mut aktuell = Vec::with_capacity(k);
    build(pool, k, 0, &mut aktuell, &mut out);
    out
}

fn build(
    pool: &[usize],
    k: usize,
    start: usize,
    aktuell: &mut Vec<usize>,
    out: &mut Vec<Vec<usize>>,
) {
    if aktuell.len() == k {
        out.push(aktuell.clone());
        return;
    }
    let noetig = k - aktuell.len();
    if pool.len() - start < noetig {
        return;
    }
    let bis = pool.len() - noetig + 1;
    for i in start..bis {
        aktuell.push(pool[i]);
        build(pool, k, i + 1, aktuell, out);
        aktuell.pop();
    }
}

pub fn score_fuer(kombo: &[&HeldEintrag], input: &KonfiguratorInput) -> (f64, f64, f64, f64) {
    let typen: Vec<HeroTyp> = kombo.iter().filter_map(|h| h.typ).collect();
    let formation_faktor = if typen.len() == kombo.len() {
        formation::formation_faktor(&typen, &input.formationsbonus)
    } else {
        1.0
    };
    let staerke_summe: f64 = kombo.iter().map(|h| h.staerke).sum();
    let counter_faktor = match input.gegner_typ {
        Some(g) if typen.len() == kombo.len() => {
            let summe: f64 = kombo
                .iter()
                .zip(typen.iter())
                .map(|(h, t)| h.staerke * formation::counter_faktor(*t, g, &input.counter))
                .sum();
            if staerke_summe > 0.0 {
                summe / staerke_summe
            } else {
                1.0
            }
        }
        _ => 1.0,
    };
    let score = staerke_summe * formation_faktor * counter_faktor;
    (score, formation_faktor, counter_faktor, staerke_summe)
}

pub fn begruendung(
    kombo: &[&HeldEintrag],
    input: &KonfiguratorInput,
    formation_faktor: f64,
    counter_faktor: f64,
) -> String {
    let typen: Vec<HeroTyp> = kombo.iter().filter_map(|h| h.typ).collect();
    let f_text = formation::formation_beschreibung(&typen, &input.formationsbonus);
    let c_text = match input.gegner_typ {
        Some(g) => format!("; Counter gegen {} x{:.2}", g.name_de(), counter_faktor),
        None => String::new(),
    };
    let namen: Vec<String> = kombo.iter().map(|h| h.def.anzeige_name()).collect();
    let helden_text = format!(" — Helden: {}", namen.join(", "));
    format!(
        "{} ({:+.0} %);{}{}",
        f_text,
        (formation_faktor - 1.0) * 100.0,
        c_text,
        helden_text
    )
}

pub fn optimieren(input: &KonfiguratorInput) -> Vec<SquadOption> {
    let k = input.squad_groesse.max(1);
    let fix: Vec<usize> = input
        .bestand
        .iter()
        .enumerate()
        .filter(|(_, h)| input.fixierungen.contains(&h.instanz.held_id))
        .map(|(i, _)| i)
        .collect();
    let freie: Vec<usize> = (0..input.bestand.len())
        .filter(|i| !fix.contains(i))
        .collect();
    let frei_anzahl = k.saturating_sub(fix.len());
    let mut optionen = Vec::new();
    if fix.len() > k || freie.len() < frei_anzahl {
        return optionen;
    }
    for kombo_frei in kombinationen(&freie, frei_anzahl) {
        let mut kombo_idx: Vec<usize> = fix.clone();
        kombo_idx.extend(kombo_frei);
        let kombo: Vec<&HeldEintrag> = kombo_idx.iter().map(|i| &input.bestand[*i]).collect();
        let (score, ff, cf, ss) = score_fuer(&kombo, input);
        optionen.push(SquadOption {
            helden: kombo.iter().map(|h| h.instanz.held_id.clone()).collect(),
            score,
            formation_faktor: ff,
            counter_faktor: cf,
            staerke_summe: ss,
            begruendung: begruendung(&kombo, input, ff, cf),
        });
    }
    optionen.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    optionen.truncate(input.top_n.max(1));
    optionen
}

pub fn aenderungs_vorschlag(
    alter_squad: &[String],
    bestand: &[HeldEintrag],
    input: &KonfiguratorInput,
) -> Option<AenderungsVorschlag> {
    let beste = optimieren(input).into_iter().next()?;
    let alt_score = score_kombo(alter_squad, bestand, input);
    if beste.helden == alter_squad && (beste.score - alt_score).abs() < f64::EPSILON {
        return None;
    }
    Some(AenderungsVorschlag {
        alt: alter_squad.to_vec(),
        neu: beste.helden.clone(),
        score_alt: alt_score,
        score_neu: beste.score,
        begruendung: format!(
            "Bestandsänderung erkannt: {} (Score {:.0}) -> {} (Score {:.0}). {}",
            alter_squad.join(", "),
            alt_score,
            beste.helden.join(", "),
            beste.score,
            beste.begruendung
        ),
    })
}

fn score_kombo(squad: &[String], bestand: &[HeldEintrag], input: &KonfiguratorInput) -> f64 {
    let kombo: Vec<&HeldEintrag> = squad
        .iter()
        .filter_map(|id| bestand.iter().find(|h| &h.instanz.held_id == id))
        .collect();
    if kombo.is_empty() {
        return 0.0;
    }
    score_fuer(&kombo, input).0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::held::{Basiswerte, Rolle, Seltenheit};
    use crate::seed_data;

    fn defs() -> HeldenDefinitionen {
        seed_data::lade_helden().unwrap_or_else(|e| panic!("seed: {}", e))
    }

    fn mk_held(id: &str, typ: HeroTyp, staerke: u64) -> HeldEintrag {
        let def = HeldDef {
            id: id.to_string(),
            name: Some(id.to_string()),
            seltenheit: Some(Seltenheit::Ur),
            typ: Some(typ),
            rolle: Some(Rolle::Angriff),
            promotable: false,
            erweckung: false,
            basiswerte: Basiswerte {
                hp: Some(staerke),
                angriff: None,
                verteidigung: None,
            },
            quelle: vec!["nutzerangabe".to_string()],
            is_unsicher: false,
            konflikt_notiz: None,
        };
        let instanz = HeldInstanz {
            held_id: id.to_string(),
            sterne: 1,
            level: Some(1),
            hp: Some(staerke),
            angriff: None,
            verteidigung: None,
            gear: vec![],
            erweckt: false,
            erweckung_level: None,
            faehigkeiten_level: vec![],
            quelle: vec!["nutzerangabe".to_string()],
        };
        HeldEintrag {
            staerke: helden_staerke(&instanz, &def),
            instanz,
            def,
            typ: Some(typ),
        }
    }

    fn input(bestand: Vec<HeldEintrag>, gegner: Option<HeroTyp>) -> KonfiguratorInput {
        let d = defs();
        KonfiguratorInput {
            bestand,
            fixierungen: vec![],
            gegner_typ: gegner,
            top_n: 5,
            squad_groesse: 5,
            formationsbonus: d.formationsbonus,
            counter: d.counter_regel,
        }
    }

    #[test]
    fn kombinationen_31_choose_5_ist_169911() {
        assert_eq!(kombinationen_anzahl(31, 5), 169_911);
    }

    #[test]
    fn plus_20_prozent_formation_ist_auffindbar() {
        let bestand: Vec<HeldEintrag> = (0..6)
            .map(|i| mk_held(&format!("panzer_{}", i), HeroTyp::Panzer, 1000 + i as u64))
            .collect();
        let opts = optimieren(&input(bestand, None));
        assert!(!opts.is_empty());
        let top = &opts[0];
        assert!((top.formation_faktor - 1.20).abs() < 1e-9);
        assert_eq!(top.helden.len(), 5);
        assert!(top.helden.iter().all(|h| h.starts_with("panzer_")));
    }

    #[test]
    fn fixierungen_werden_uebernommen() {
        let mut bestand: Vec<HeldEintrag> = (0..6)
            .map(|i| mk_held(&format!("p{}", i), HeroTyp::Panzer, 1000 + i as u64))
            .collect();
        bestand.push(mk_held("rakete_0", HeroTyp::Rakete, 5000));
        let mut inp = input(bestand, None);
        inp.fixierungen = vec!["rakete_0".to_string()];
        let opts = optimieren(&inp);
        assert!(opts
            .iter()
            .all(|o| o.helden.contains(&"rakete_0".to_string())));
    }

    #[test]
    fn counter_faktor_gegen_gewaehlten_gegner_typ() {
        let bestand: Vec<HeldEintrag> = (0..5)
            .map(|i| mk_held(&format!("p{}", i), HeroTyp::Panzer, 1000))
            .chain((0..5).map(|i| mk_held(&format!("f{}", i), HeroTyp::Flugzeug, 1000)))
            .collect();
        let opts = optimieren(&input(bestand, Some(HeroTyp::Flugzeug)));
        assert!((opts[0].counter_faktor - 1.25).abs() < 1e-9);
        assert!(opts[0].helden.iter().all(|h| h.starts_with('p')));
        let opts_ohne = optimieren(&input(
            (0..5)
                .map(|i| mk_held(&format!("p{}", i), HeroTyp::Panzer, 1000))
                .chain((0..5).map(|i| mk_held(&format!("f{}", i), HeroTyp::Flugzeug, 1000)))
                .collect(),
            None,
        ));
        assert!((opts_ohne[0].counter_faktor - 1.0).abs() < 1e-9);
    }

    #[test]
    fn top_n_sortiert_absteigend() {
        let bestand: Vec<HeldEintrag> = (0..8)
            .map(|i| mk_held(&format!("h{}", i), HeroTyp::Panzer, 500 + i as u64 * 100))
            .collect();
        let opts = optimieren(&input(bestand, None));
        assert!(opts.len() <= 5);
        for w in opts.windows(2) {
            assert!(w[0].score >= w[1].score);
        }
    }

    #[test]
    fn staerke_beruecksichtigt_level_sterne_gear_erweckung() {
        let d = defs();
        let def = d
            .find("kimberly")
            .unwrap_or_else(|| panic!("kimberly fehlt"));
        let basis = HeldInstanz {
            held_id: "kimberly".to_string(),
            sterne: 1,
            level: Some(1),
            hp: Some(1000),
            angriff: Some(0),
            verteidigung: Some(0),
            gear: vec![],
            erweckt: false,
            erweckung_level: None,
            faehigkeiten_level: vec![],
            quelle: vec![],
        };
        let hoch = HeldInstanz {
            level: Some(100),
            sterne: 5,
            gear: vec![Some(10), Some(10), Some(10), Some(10)],
            erweckt: true,
            ..basis.clone()
        };
        assert!(helden_staerke(&hoch, def) > helden_staerke(&basis, def));
        assert!((helden_staerke(&basis, def) - 1000.0).abs() < 1e-9);
    }

    #[test]
    fn fehlende_werte_erkennt_null_felder() {
        let d = defs();
        let def = d.find("dva").unwrap_or_else(|| panic!("dva fehlt"));
        let instanz = HeldInstanz {
            held_id: "dva".to_string(),
            sterne: 4,
            level: None,
            hp: None,
            angriff: None,
            verteidigung: None,
            gear: vec![],
            erweckt: true,
            erweckung_level: Some(20),
            faehigkeiten_level: vec![],
            quelle: vec!["nutzerangabe".to_string()],
        };
        let bestand = vec![HeldEintrag {
            staerke: helden_staerke(&instanz, def),
            typ: def.typ,
            def: def.clone(),
            instanz,
        }];
        let f = fehlende_werte(&bestand);
        for feld in ["level", "hp", "angriff", "verteidigung"] {
            assert!(
                f.iter().any(|x| x.held_id == "dva" && x.feld == feld),
                "fehlender Wert {} fehlt",
                feld
            );
        }
    }

    #[test]
    fn aenderungs_vorschlag_nach_bestandsaenderung() {
        let bestand: Vec<HeldEintrag> = (0..5)
            .map(|i| mk_held(&format!("p{}", i), HeroTyp::Panzer, 1000))
            .collect();
        let inp = input(bestand.clone(), None);
        let alt = vec![
            "p0".to_string(),
            "p1".to_string(),
            "p2".to_string(),
            "p3".to_string(),
            "p4".to_string(),
        ];
        assert!(aenderungs_vorschlag(&alt, &bestand, &inp).is_none());
        let mut neu = bestand.clone();
        neu.push(mk_held("p9", HeroTyp::Panzer, 99999));
        let inp2 = input(neu.clone(), None);
        let vorschlag = aenderungs_vorschlag(&alt, &neu, &inp2);
        assert!(vorschlag.is_some());
        let v = vorschlag.unwrap_or_else(|| panic!("vorschlag fehlt"));
        assert!(v.neu.contains(&"p9".to_string()));
        assert!(v.score_neu > v.score_alt);
    }
}
