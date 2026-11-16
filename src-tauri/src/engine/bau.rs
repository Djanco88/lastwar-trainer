use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpeedupPosten {
    pub anzahl: u64,
    pub sekunden_pro_stueck: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpeedupErgebnis {
    pub dauer_sek: u64,
    pub gedeckt_sek: u64,
    pub rest_sek: u64,
    pub ueberhang_sek: u64,
    pub deckung_prozent: f64,
    pub vollstaendig: bool,
}

pub fn speedup_rechner(dauer_sek: u64, posten: &[SpeedupPosten]) -> SpeedupErgebnis {
    let gesamt: u64 = posten
        .iter()
        .map(|p| p.anzahl.saturating_mul(p.sekunden_pro_stueck))
        .sum();
    let gedeckt = gesamt.min(dauer_sek);
    SpeedupErgebnis {
        dauer_sek,
        gedeckt_sek: gedeckt,
        rest_sek: dauer_sek - gedeckt,
        ueberhang_sek: gesamt - gedeckt,
        deckung_prozent: if dauer_sek == 0 {
            100.0
        } else {
            gedeckt as f64 / dauer_sek as f64 * 100.0
        },
        vollstaendig: gedeckt >= dauer_sek,
    }
}

pub fn speedups_aus_beschleuniger(
    bau_1h: u64,
    forschung_1h: u64,
    heilung_5min: u64,
    universal_5min: u64,
) -> Vec<SpeedupPosten> {
    vec![
        SpeedupPosten {
            anzahl: bau_1h,
            sekunden_pro_stueck: 3600,
        },
        SpeedupPosten {
            anzahl: forschung_1h,
            sekunden_pro_stueck: 3600,
        },
        SpeedupPosten {
            anzahl: heilung_5min,
            sekunden_pro_stueck: 300,
        },
        SpeedupPosten {
            anzahl: universal_5min,
            sekunden_pro_stueck: 300,
        },
    ]
}

pub fn bauzeit_format(sek: u64) -> String {
    let tage = sek / 86_400;
    let stunden = (sek % 86_400) / 3_600;
    let minuten = (sek % 3_600) / 60;
    let sekunden = sek % 60;
    let mut teile = Vec::new();
    if tage > 0 {
        teile.push(format!("{}d", tage));
    }
    if stunden > 0 {
        teile.push(format!("{}h", stunden));
    }
    if minuten > 0 {
        teile.push(format!("{}m", minuten));
    }
    if sekunden > 0 || teile.is_empty() {
        teile.push(format!("{}s", sekunden));
    }
    teile.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn speedup_deckung_vollstaendig_mit_ueberhang() {
        let posten = vec![SpeedupPosten {
            anzahl: 10,
            sekunden_pro_stueck: 3600,
        }];
        let e = speedup_rechner(5 * 3600, &posten);
        assert!(e.vollstaendig);
        assert_eq!(e.rest_sek, 0);
        assert_eq!(e.ueberhang_sek, 5 * 3600);
        assert!((e.deckung_prozent - 100.0).abs() < 1e-9);
    }

    #[test]
    fn speedup_deckung_teilweise() {
        let posten = vec![SpeedupPosten {
            anzahl: 2,
            sekunden_pro_stueck: 3600,
        }];
        let e = speedup_rechner(5 * 3600, &posten);
        assert!(!e.vollstaendig);
        assert_eq!(e.gedeckt_sek, 2 * 3600);
        assert_eq!(e.rest_sek, 3 * 3600);
        assert!((e.deckung_prozent - 40.0).abs() < 1e-9);
    }

    #[test]
    fn speedup_deckung_keine_speedups_und_dauer_null() {
        let e = speedup_rechner(3600, &[]);
        assert_eq!(e.gedeckt_sek, 0);
        assert_eq!(e.rest_sek, 3600);
        assert!((e.deckung_prozent - 0.0).abs() < 1e-9);
        let e0 = speedup_rechner(0, &[]);
        assert!(e0.vollstaendig);
        assert!((e0.deckung_prozent - 100.0).abs() < 1e-9);
    }

    #[test]
    fn speedups_aus_beschleuniger_profilswerten() {
        let posten = speedups_aus_beschleuniger(40, 25, 10, 60);
        let gesamt: u64 = posten
            .iter()
            .map(|p| p.anzahl * p.sekunden_pro_stueck)
            .sum();
        assert_eq!(gesamt, 40 * 3600 + 25 * 3600 + 10 * 300 + 60 * 300);
    }

    #[test]
    fn bauzeit_formatierung() {
        assert_eq!(bauzeit_format(90061), "1d 1h 1m 1s");
        assert_eq!(bauzeit_format(0), "0s");
        assert_eq!(bauzeit_format(3600), "1h");
    }
}
