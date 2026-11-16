use lastwar_core::seed_data;

#[test]
fn kernbaum_gegenprobe_21_tiers_42_skills_125_budget() {
    let baum = seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("parse: {}", e));
    assert_eq!(baum.tiers.len(), 21, "21 Tiers erwartet");
    assert_eq!(baum.kern_slot_anzahl(), 42, "42 Kern-Skill-Slots erwartet");
    assert_eq!(baum.kern_skills_gesamt, 42);
    assert_eq!(baum.budget_punkte_lv100, 125, "Budget 125 Punkte");
    assert_eq!(baum.level_cap, 100);
    for (i, tier) in baum.tiers.iter().enumerate() {
        let erwartet = if i == 0 { 1 } else { 5 * i as u32 };
        assert_eq!(tier.level, erwartet, "Tier-Unlock alle 5 Level");
        assert_eq!(tier.skills.len(), 2, "2 Skills pro Tier");
    }
}

#[test]
fn kernbaum_alle_42_slots_namentlich_belegt() {
    let baum = seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("parse: {}", e));
    let namen_los = baum
        .tiers
        .iter()
        .flat_map(|t| t.skills.iter())
        .filter(|s| s.name_de.is_none() && s.name_en.is_none())
        .count();
    assert_eq!(
        namen_los, 0,
        "alle 42 Kern-Slots sollen namentlich belegt sein"
    );
    assert!(baum.unplatzierte_benannte_skills.is_empty());
}

#[test]
fn kernbaum_jeder_wert_hat_quelle_und_unsichere_sind_flaggt() {
    let baum = seed_data::lade_kern_baum().unwrap_or_else(|e| panic!("parse: {}", e));
    for skill in baum.alle_skills() {
        if skill.name_de.is_none() && skill.name_en.is_none() {
            assert!(
                skill.is_unsicher,
                "Skill {} ohne Namen muss is_unsicher=true tragen",
                skill.id
            );
            assert!(
                skill.konflikt_notiz.is_some(),
                "Skill {} ohne Namen braucht DATENLÜCKE-Notiz",
                skill.id
            );
        }
        for q in &skill.quelle {
            assert!(
                seed_data::ist_bekannte_quelle(q),
                "Unbekannte Quelle '{}' bei Skill {}",
                q,
                skill.id
            );
        }
    }
    for id in baum
        .prioritaet_reihenfolge
        .prio
        .iter()
        .chain(&baum.prioritaet_reihenfolge.skip)
    {
        assert!(
            baum.find_skill(id).is_some(),
            "Prio/Skip-Skill '{}' muss im Baum existieren",
            id
        );
    }
}

#[test]
fn s6_spalte_gegenprobe_21_skills_44_punkte_erstattung() {
    let s6 = seed_data::lade_saison_skills().unwrap_or_else(|e| panic!("parse: {}", e));
    assert_eq!(s6.saison, 6);
    assert_eq!(s6.skills.len(), 21, "S6: 21 Skills");
    assert_eq!(s6.anzahl_skills, 21);
    assert_eq!(s6.punkte_budget, 44, "S6: 44 Punkte");
    assert!(s6.erstattung_bei_saisonende, "Saisonende-Erstattung aktiv");
    for q in &s6.punkte_budget_quelle {
        assert!(seed_data::ist_bekannte_quelle(q));
    }
    for skill in &s6.skills {
        assert!(
            skill.name_de.is_some() || skill.name_en.is_some(),
            "S6-Skill {} noch namenlos",
            skill.id
        );
        for q in &skill.quelle {
            assert!(
                seed_data::ist_bekannte_quelle(q),
                "Quelle '{}' unbekannt",
                q
            );
        }
    }
}

#[test]
fn helden_gegenprobe_31_helden_squad5_counter_formation() {
    let defs = seed_data::lade_helden().unwrap_or_else(|e| panic!("parse: {}", e));
    assert_eq!(defs.helden.len(), 31, "31 Helden-Slots");
    assert_eq!(defs.anzahl_helden, 31);
    assert_eq!(defs.squad_groesse, 5, "Squad = 5 Helden");
    assert_eq!(defs.gear_slots_pro_held, 4, "Gear 4 Slots");
    assert!((defs.counter_regel.flugzeug_nimmt_von_panzer - 0.8).abs() < 1e-9);
    assert!((defs.counter_regel.rakete_nimmt_von_flugzeug - 0.8).abs() < 1e-9);
    assert!((defs.counter_regel.panzer_nimmt_von_rakete - 0.8).abs() < 1e-9);
    assert!((defs.formationsbonus.fuenf_x - 0.20).abs() < 1e-9);
    assert!((defs.formationsbonus.vier_x - 0.15).abs() < 1e-9);
    assert!((defs.formationsbonus.drei_plus_zwei - 0.10).abs() < 1e-9);
    assert!((defs.formationsbonus.drei_x - 0.05).abs() < 1e-9);
    for h in &defs.helden {
        if h.name.is_none() {
            assert!(
                h.is_unsicher,
                "Held {} ohne Namen muss unsicher flaggen",
                h.id
            );
        }
        if let Some(t) = h.typ {
            assert!(defs.typen.contains(&t));
        }
        for q in &h.quelle {
            assert!(
                seed_data::ist_bekannte_quelle(q),
                "Quelle '{}' unbekannt",
                q
            );
        }
    }
    let benannte = defs.helden.iter().filter(|h| h.name.is_some()).count();
    assert_eq!(
        benannte, 29,
        "29 namentlich belegte Helden, 2 Slots offen (held_30/31)"
    );
}

#[test]
fn s7_fahrplan_server977_termine_offen_und_editierbar() {
    let s7 = seed_data::lade_s7_fahrplan().unwrap_or_else(|e| panic!("parse: {}", e));
    assert_eq!(s7.saison, 7);
    assert!(s7.server_977.editierbar);
    assert!(
        s7.server_977.pre_season_start.is_none(),
        "DATENLÜCKE: Server 977 Termin null"
    );
    assert!(s7.server_977.haupt_start.is_none());
    assert!(s7.events.iter().all(|e| e.server_977_editierbar));
    assert_eq!(
        s7.pre_season_erste_server.datum.as_deref(),
        Some("2026-11-09"),
        "Präseason erste Batch 09.11.2026 (Server 3-164)"
    );
}
