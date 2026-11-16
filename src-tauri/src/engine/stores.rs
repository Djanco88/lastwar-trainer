use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime};

use crate::model::profil::StoreEintrag;

pub use crate::model::profil::StoreEintrag as StoreLimit;

pub fn letzter_montag_0000_serverzeit(jetzt_serverzeit: NaiveDateTime) -> NaiveDateTime {
    let datum = jetzt_serverzeit.date();
    let tage_seit_montag = datum.weekday().num_days_from_monday() as i64;
    let montag = datum - Duration::days(tage_seit_montag);
    montag.and_hms_opt(0, 0, 0).unwrap_or(jetzt_serverzeit)
}

pub fn naechster_montag_0000_serverzeit(jetzt_serverzeit: NaiveDateTime) -> NaiveDateTime {
    letzter_montag_0000_serverzeit(jetzt_serverzeit) + Duration::days(7)
}

pub fn naechster_monatserster_serverzeit(jetzt_serverzeit: NaiveDateTime) -> NaiveDateTime {
    let datum = jetzt_serverzeit.date();
    let (jahr, monat) = if datum.month() == 12 {
        (datum.year() + 1, 1u32)
    } else {
        (datum.year(), datum.month() + 1)
    };
    NaiveDate::from_ymd_opt(jahr, monat, 1)
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .unwrap_or(jetzt_serverzeit)
}

pub fn reset_faellig_seit(letzter_reset: NaiveDateTime, jetzt_serverzeit: NaiveDateTime) -> bool {
    letzter_montag_0000_serverzeit(jetzt_serverzeit) > letzter_reset
}

pub fn store_kauf(
    eintrag: &mut StoreEintrag,
    betrag: u64,
    letzter_reset: NaiveDateTime,
    jetzt_serverzeit: NaiveDateTime,
) {
    if reset_faellig_seit(letzter_reset, jetzt_serverzeit) {
        eintrag.gekauft_woche = 0;
        eintrag.gekauft_monat = 0;
    }
    eintrag.gekauft_woche = eintrag.gekauft_woche.saturating_add(betrag);
    eintrag.gekauft_monat = eintrag.gekauft_monat.saturating_add(betrag);
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Weekday;

    fn dt(y: i32, m: u32, d: u32, h: u32, mi: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(y, m, d)
            .and_then(|d| d.and_hms_opt(h, mi, 0))
            .unwrap_or_else(|| panic!("ungueltiges Testdatum"))
    }

    #[test]
    fn reset_deadline_montag_0000_wird_als_letzter_reset_erkannt() {
        let mittwoch = dt(2026, 11, 11, 15, 30);
        let reset = letzter_montag_0000_serverzeit(mittwoch);
        assert_eq!(reset.weekday(), Weekday::Mon);
        assert_eq!(reset, dt(2026, 11, 9, 0, 0));
    }

    #[test]
    fn reset_deadline_naechster_montag_ab_mittwoch_ist_naechste_woche() {
        let mittwoch = dt(2026, 11, 11, 15, 30);
        assert_eq!(
            naechster_montag_0000_serverzeit(mittwoch),
            dt(2026, 11, 16, 0, 0)
        );
    }

    #[test]
    fn reset_deadline_naechster_montag_exakt_um_0000_ist_in_7_tagen() {
        let montag_0000 = dt(2026, 11, 9, 0, 0);
        assert_eq!(letzter_montag_0000_serverzeit(montag_0000), montag_0000);
        assert_eq!(
            naechster_montag_0000_serverzeit(montag_0000),
            dt(2026, 11, 16, 0, 0)
        );
        assert!(reset_faellig_seit(dt(2026, 11, 2, 0, 0), montag_0000));
        assert!(!reset_faellig_seit(montag_0000, montag_0000));
    }

    #[test]
    fn reset_deadline_monatserster() {
        assert_eq!(
            naechster_monatserster_serverzeit(dt(2026, 11, 15, 12, 0)),
            dt(2026, 12, 1, 0, 0)
        );
        assert_eq!(
            naechster_monatserster_serverzeit(dt(2026, 12, 31, 23, 59)),
            dt(2027, 1, 1, 0, 0)
        );
    }

    #[test]
    fn wochenschema_verbleibend_woche_und_monat() {
        let l = StoreEintrag {
            name: "Diamanten-Paket".to_string(),
            pro_woche: Some(10),
            pro_monat: Some(40),
            gekauft_woche: 4,
            gekauft_monat: 12,
        };
        assert_eq!(l.verbleibend_woche(), Some(6));
        assert_eq!(l.verbleibend_monat(), Some(28));
    }

    #[test]
    fn wochenschema_kauf_mit_reset_nach_montag_0000() {
        let mut e = StoreEintrag {
            name: "Paket".to_string(),
            pro_woche: Some(10),
            pro_monat: Some(40),
            gekauft_woche: 8,
            gekauft_monat: 30,
        };
        let letzter_reset = dt(2026, 11, 2, 0, 0);
        let mittwoch = dt(2026, 11, 11, 10, 0);
        store_kauf(&mut e, 5, letzter_reset, mittwoch);
        assert_eq!(
            e.gekauft_woche, 5,
            "Wochenzaehler nach Montag 0:00 neu gestartet"
        );
        assert_eq!(
            e.gekauft_monat, 5,
            "Monatszaehler nach Montag 0:00 neu gestartet"
        );
        assert_eq!(e.verbleibend_woche(), Some(5));
    }

    #[test]
    fn wochenschema_kauf_ohne_reset_zaehlt_hoch() {
        let mut e = StoreEintrag {
            name: "Paket".to_string(),
            pro_woche: Some(10),
            pro_monat: Some(40),
            gekauft_woche: 2,
            gekauft_monat: 2,
        };
        let letzter_reset = dt(2026, 11, 9, 0, 0);
        let dienstag = dt(2026, 11, 10, 10, 0);
        store_kauf(&mut e, 3, letzter_reset, dienstag);
        assert_eq!(e.gekauft_woche, 5);
        assert_eq!(e.gekauft_monat, 5);
    }
}
