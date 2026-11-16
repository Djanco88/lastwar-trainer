use serde::{Deserialize, Serialize};

use crate::seed_data;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EnzyklopaedieEintrag {
    pub id: String,
    pub titel: String,
    pub kategorie: String,
    pub text: String,
    pub quelle: Vec<String>,
}

fn skill_text(s: &crate::model::skill::SkillDef, tier: Option<u32>) -> String {
    let mut teile = Vec::new();
    if let Some(t) = tier {
        teile.push(format!("Unlock ab Profession-Level {}", t));
    }
    if let Some(max) = s.max_level {
        teile.push(format!("Max-Level {}", max));
    } else {
        teile.push("Max-Level offen (DATENLÜCKE)".to_string());
    }
    match (&s.effekt_pro_level, &s.effekt_max) {
        (Some(pro), _) => teile.push(format!("Effekt pro Stufe: {}", pro)),
        (None, Some(max)) => teile.push(format!("Effekt: {}", max)),
        (None, None) => teile.push("Effekt unbekannt".to_string()),
    }
    if s.is_unsicher {
        teile.push("Wert unsicher (is_unsicher)".to_string());
    }
    if let Some(k) = &s.konflikt_notiz {
        teile.push(format!("Konflikt: {}", k));
    }
    teile.join(" · ")
}

pub fn eintraege() -> Vec<EnzyklopaedieEintrag> {
    let mut out: Vec<EnzyklopaedieEintrag> = Vec::new();
    let baum = match seed_data::lade_kern_baum() {
        Ok(b) => b,
        Err(_) => return out,
    };
    for tier in &baum.tiers {
        for s in &tier.skills {
            out.push(EnzyklopaedieEintrag {
                id: format!("skill-{}", s.id),
                titel: s.anzeige_name(),
                kategorie: "Skill-Baum (Engineer-Kern)".to_string(),
                text: skill_text(s, Some(tier.level)),
                quelle: if s.quelle.is_empty() {
                    vec!["nutzerangabe".to_string()]
                } else {
                    s.quelle.clone()
                },
            });
        }
    }
    let s6 = match seed_data::lade_saison_skills() {
        Ok(s) => s,
        Err(_) => return out,
    };
    for s in &s6.skills {
        out.push(EnzyklopaedieEintrag {
            id: format!("s6-{}", s.id),
            titel: s.anzeige_name(),
            kategorie: format!("Saison-Spalte S6 ({})", s6.name_de),
            text: skill_text(s, s.unlock_level),
            quelle: if s.quelle.is_empty() {
                vec!["nutzerangabe".to_string()]
            } else {
                s.quelle.clone()
            },
        });
    }
    let defs = match seed_data::lade_helden() {
        Ok(d) => d,
        Err(_) => return out,
    };
    for h in &defs.helden {
        let mut text = Vec::new();
        text.push(format!(
            "Seltenheit: {} · Typ: {} · Rolle: {}",
            h.seltenheit
                .map(|s| format!("{:?}", s))
                .unwrap_or_else(|| "offen".to_string()),
            h.typ
                .map(|t| t.name_de().to_string())
                .unwrap_or_else(|| "offen".to_string()),
            h.rolle
                .map(|r| format!("{:?}", r))
                .unwrap_or_else(|| "offen".to_string()),
        ));
        if h.promotable {
            text.push("promotable SSR->UR (ab 5 Sternen)".to_string());
        }
        if h.erweckung {
            text.push("Erweckung verfügbar".to_string());
        }
        text.push("Basiswerte HP/Angriff/Verteidigung: null (DATENLÜCKE)".to_string());
        if let Some(k) = &h.konflikt_notiz {
            text.push(format!("Konflikt: {}", k));
        }
        out.push(EnzyklopaedieEintrag {
            id: format!("held-{}", h.id),
            titel: h.anzeige_name(),
            kategorie: "Helden".to_string(),
            text: text.join(" · "),
            quelle: if h.quelle.is_empty() {
                vec!["nutzerangabe".to_string()]
            } else {
                h.quelle.clone()
            },
        });
    }
    let f = defs.formationsbonus;
    out.push(EnzyklopaedieEintrag {
        id: "regel-formation".to_string(),
        titel: "Formationsbonus".to_string(),
        kategorie: "Regeln".to_string(),
        text: format!(
            "5x gleicher Typ +{:.0} % · 4x +{:.0} % · 3+2 +{:.0} % · 3x +{:.0} % auf HP/Angriff/Verteidigung; Squad = {} Helden",
            f.fuenf_x * 100.0,
            f.vier_x * 100.0,
            f.drei_plus_zwei * 100.0,
            f.drei_x * 100.0,
            defs.squad_groesse
        ),
        quelle: f.quelle.clone(),
    });
    let c = defs.counter_regel;
    out.push(EnzyklopaedieEintrag {
        id: "regel-counter".to_string(),
        titel: "Typ-Counter".to_string(),
        kategorie: "Regeln".to_string(),
        text: format!(
            "Flugzeug nimmt {:.0} % Schaden von Panzern · Rakete {:.0} % von Flugzeug · Panzer {:.0} % von Rakete (Dreieck Panzer > Flugzeug > Rakete > Panzer)",
            c.flugzeug_nimmt_von_panzer * 100.0,
            c.rakete_nimmt_von_flugzeug * 100.0,
            c.panzer_nimmt_von_rakete * 100.0
        ),
        quelle: c.quelle.clone(),
    });
    out.push(EnzyklopaedieEintrag {
        id: "datenluecken".to_string(),
        titel: "DATENLÜCKEN (nie still glätten)".to_string(),
        kategorie: "Regeln".to_string(),
        text: defs.datenluecken.join(" · "),
        quelle: vec!["nutzerangabe".to_string()],
    });
    if let Ok(s7) = seed_data::lade_s7_fahrplan() {
        out.push(EnzyklopaedieEintrag {
            id: "s7-fahrplan".to_string(),
            titel: format!("S{} {} — Fahrplan", s7.saison, s7.name_de),
            kategorie: "Saisons".to_string(),
            text: format!(
                "Präseason erste Server-Batch ({}): {} · Zyklus: {} Wo. Präseason, {} Wo. Haupt, {} Wo. Celebration, Off-Season. Server 977: Termine {} (editierbar).",
                s7.pre_season_erste_server.server_batch.unwrap_or_else(|| "?".to_string()),
                s7.pre_season_erste_server.datum.unwrap_or_else(|| "offen".to_string()),
                s7.zyklus.pre_season_wochen,
                s7.zyklus.haupt_saison_wochen,
                s7.zyklus.celebration_week,
                if s7.server_977.pre_season_start.is_none() { "unbekannt/null" } else { "gesetzt" }
            ),
            quelle: s7.pre_season_erste_server.quelle.clone(),
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enzyklopaedie_hat_eintraege_fuer_skills_helden_regeln() {
        let e = eintraege();
        assert!(
            e.len() >= 42 + 21 + 31 + 3,
            "Eintraege: {} (Skills 42 + S6 21 + Helden 31 + Regeln)",
            e.len()
        );
        assert!(e.iter().any(|x| x.id == "skill-master_builder"));
        assert!(e.iter().any(|x| x.id == "held-dva"));
        assert!(e.iter().any(|x| x.id == "regel-formation"));
        assert!(e.iter().any(|x| x.id == "datenluecken"));
        assert!(e
            .iter()
            .any(|x| x.titel.contains("DVA") || x.text.contains("DVA")));
    }

    #[test]
    fn jeder_eintrag_hat_quelle() {
        for e in eintraege() {
            assert!(!e.quelle.is_empty(), "Eintrag {} ohne Quelle", e.id);
            for q in &e.quelle {
                assert!(
                    crate::seed_data::ist_bekannte_quelle(q),
                    "unbekannte Quelle {}",
                    q
                );
            }
        }
    }
}
