use crate::model::held::{CounterRegel, FormationsbonusRegel, HeroTyp};
use crate::model::squad::FormationAuswertung;

fn counts_pro_typ(typen: &[HeroTyp]) -> [usize; 3] {
    let mut counts = [0usize; 3];
    for t in typen {
        match t {
            HeroTyp::Panzer => counts[0] += 1,
            HeroTyp::Rakete => counts[1] += 1,
            HeroTyp::Flugzeug => counts[2] += 1,
        }
    }
    counts
}

pub fn formation_bonus_prozent(typen: &[HeroTyp], regel: &FormationsbonusRegel) -> f64 {
    let mut counts = counts_pro_typ(typen);
    counts.sort_unstable_by(|a, b| b.cmp(a));
    let max = counts[0];
    let second = counts[1];
    if max >= 5 {
        regel.fuenf_x
    } else if max == 4 {
        regel.vier_x
    } else if max == 3 && second == 2 {
        regel.drei_plus_zwei
    } else if max == 3 {
        regel.drei_x
    } else {
        0.0
    }
}

pub fn formation_faktor(typen: &[HeroTyp], regel: &FormationsbonusRegel) -> f64 {
    1.0 + formation_bonus_prozent(typen, regel)
}

pub fn formation_beschreibung(typen: &[HeroTyp], regel: &FormationsbonusRegel) -> String {
    let bonus = formation_bonus_prozent(typen, regel);
    let counts = counts_pro_typ(typen);
    let komposition = format!(
        "Panzer {} / Rakete {} / Flugzeug {}",
        counts[0], counts[1], counts[2]
    );
    if bonus <= 0.0 {
        return format!("{} -> kein Formationsbonus", komposition);
    }
    let muster = if counts.contains(&5) || counts.iter().any(|c| *c > 5) {
        "5x gleicher Typ"
    } else if counts.contains(&4) {
        "4x gleicher Typ"
    } else if counts.contains(&3) && counts.contains(&2) {
        "3+2"
    } else {
        "3x gleicher Typ"
    };
    format!(
        "{} -> {} ({:+.0} % auf HP/Angriff/Verteidigung)",
        komposition,
        muster,
        bonus * 100.0
    )
}

pub fn formation_auswertung(
    typen: &[HeroTyp],
    regel: &FormationsbonusRegel,
) -> FormationAuswertung {
    let bonus = formation_bonus_prozent(typen, regel);
    FormationAuswertung {
        bonus_prozent: bonus,
        faktor: 1.0 + bonus,
        beschreibung: formation_beschreibung(typen, regel),
    }
}

pub fn schaden_genommen_faktor(
    verteidiger: HeroTyp,
    angreifer: HeroTyp,
    regel: &CounterRegel,
) -> f64 {
    match (verteidiger, angreifer) {
        (HeroTyp::Flugzeug, HeroTyp::Panzer) => regel.flugzeug_nimmt_von_panzer,
        (HeroTyp::Rakete, HeroTyp::Flugzeug) => regel.rakete_nimmt_von_flugzeug,
        (HeroTyp::Panzer, HeroTyp::Rakete) => regel.panzer_nimmt_von_rakete,
        _ => 1.0,
    }
}

pub fn counter_faktor(angreifer: HeroTyp, gegner: HeroTyp, regel: &CounterRegel) -> f64 {
    let genommen = schaden_genommen_faktor(gegner, angreifer, regel);
    if genommen > 0.0 && genommen < 1.0 {
        1.0 / genommen
    } else {
        1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed_data;

    fn regeln() -> (FormationsbonusRegel, CounterRegel) {
        let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("seed laden: {}", e));
        (defs.formationsbonus, defs.counter_regel)
    }

    #[test]
    fn fuenf_gleiche_typen_plus_20_prozent() {
        let (f, _) = regeln();
        let typen = [HeroTyp::Panzer; 5];
        assert!((formation_bonus_prozent(&typen, &f) - 0.20).abs() < 1e-9);
        assert!((formation_faktor(&typen, &f) - 1.20).abs() < 1e-9);
    }

    #[test]
    fn vier_gleiche_typen_plus_15_prozent() {
        let (f, _) = regeln();
        let typen = [
            HeroTyp::Panzer,
            HeroTyp::Panzer,
            HeroTyp::Panzer,
            HeroTyp::Panzer,
            HeroTyp::Rakete,
        ];
        assert!((formation_bonus_prozent(&typen, &f) - 0.15).abs() < 1e-9);
    }

    #[test]
    fn drei_plus_zwei_plus_10_prozent() {
        let (f, _) = regeln();
        let typen = [
            HeroTyp::Rakete,
            HeroTyp::Rakete,
            HeroTyp::Rakete,
            HeroTyp::Panzer,
            HeroTyp::Panzer,
        ];
        assert!((formation_bonus_prozent(&typen, &f) - 0.10).abs() < 1e-9);
    }

    #[test]
    fn drei_gleiche_typen_plus_5_prozent() {
        let (f, _) = regeln();
        let typen = [
            HeroTyp::Flugzeug,
            HeroTyp::Flugzeug,
            HeroTyp::Flugzeug,
            HeroTyp::Panzer,
            HeroTyp::Rakete,
        ];
        assert!((formation_bonus_prozent(&typen, &f) - 0.05).abs() < 1e-9);
    }

    #[test]
    fn gemischt_kein_bonus() {
        let (f, _) = regeln();
        let typen = [
            HeroTyp::Panzer,
            HeroTyp::Panzer,
            HeroTyp::Rakete,
            HeroTyp::Flugzeug,
            HeroTyp::Rakete,
        ];
        assert!(formation_bonus_prozent(&typen, &f).abs() < 1e-9);
    }

    #[test]
    fn counter_triade_80_prozent_schaden() {
        let (_, c) = regeln();
        assert!(
            (schaden_genommen_faktor(HeroTyp::Flugzeug, HeroTyp::Panzer, &c) - 0.8).abs() < 1e-9
        );
        assert!(
            (schaden_genommen_faktor(HeroTyp::Rakete, HeroTyp::Flugzeug, &c) - 0.8).abs() < 1e-9
        );
        assert!((schaden_genommen_faktor(HeroTyp::Panzer, HeroTyp::Rakete, &c) - 0.8).abs() < 1e-9);
        assert!(
            (schaden_genommen_faktor(HeroTyp::Panzer, HeroTyp::Flugzeug, &c) - 1.0).abs() < 1e-9
        );
        assert!(
            (schaden_genommen_faktor(HeroTyp::Flugzeug, HeroTyp::Flugzeug, &c) - 1.0).abs() < 1e-9
        );
    }

    #[test]
    fn counter_faktor_125_prozent_beim_counter() {
        let (_, c) = regeln();
        assert!((counter_faktor(HeroTyp::Panzer, HeroTyp::Flugzeug, &c) - 1.25).abs() < 1e-9);
        assert!((counter_faktor(HeroTyp::Flugzeug, HeroTyp::Rakete, &c) - 1.25).abs() < 1e-9);
        assert!((counter_faktor(HeroTyp::Rakete, HeroTyp::Panzer, &c) - 1.25).abs() < 1e-9);
        assert!((counter_faktor(HeroTyp::Flugzeug, HeroTyp::Panzer, &c) - 1.0).abs() < 1e-9);
        assert!((counter_faktor(HeroTyp::Panzer, HeroTyp::Panzer, &c) - 1.0).abs() < 1e-9);
    }
}
