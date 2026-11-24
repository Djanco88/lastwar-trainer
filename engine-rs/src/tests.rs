//! Tests — Spiegel der JS-Smoke-Tests (test/smoke.mjs).

use crate::*;

fn step(st: &mut State, secs: f32) {
    let n = (secs * 60.0) as i32;
    for _ in 0..n { st.tick(1.0 / 60.0); }
}

fn finish_all(st: &mut State, s: Side) {
    for b in st.side_mut(s).buildings.iter_mut() { b.constructing = false; b.build_left = 0.0; }
}

#[test]
fn economy_runs() {
    let mut st = State::new(42);
    assert_eq!(st.side(Side::Enemy).neutrinos, START_NEUTRINOS, "Aliens starten mit Neutrinos");
    let c0 = st.side(Side::Player).credits;
    step(&mut st, 25.0);
    assert!(st.side(Side::Player).credits > c0, "Credits steigen: {} -> {}", c0, st.side(Side::Player).credits);
}

#[test]
fn faction_locks() {
    let mut st = State::new(42);
    st.side_mut(Side::Player).credits = 99999.0;
    st.side_mut(Side::Enemy).credits = 99999.0;
    let hq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let spot = st.find_spot(4, 4, hq.x, hq.y, 12).unwrap();
    assert!(st.place_building(Side::Enemy, "silo", spot.0, spot.1).is_err(), "Aliens kein Nukleararsenal (keine Atomwaffen für jeden)");
    assert!(st.place_building(Side::Player, "weather", spot.0, spot.1).is_err(), "Menschen keine Wetterstation");
    assert!(st.place_building(Side::Player, "lab", spot.0, spot.1).is_err(), "Menschen kein Kreuzungslabor");
}

#[test]
fn hydro_needs_water() {
    let st = State::new(42);
    let mut found_water = false;
    for ty in 0..st.map.h { for tx in 0..st.map.w {
        if st.map.tiles[st.map.ti(tx, ty)] == 3 {
            for dy in -4..=4i32 { for dx in -4..=4i32 {
                let x = tx as i32 + dx; let y = ty as i32 + dy;
                if x >= 0 && y >= 0 && st.can_place_at(Side::Player, "hydro", x as usize, y as usize).is_ok() { found_water = true; }
            } }
        }
    } }
    assert!(found_water, "Hydro an Schlucht platzierbar");
}

#[test]
fn power_deficit_offlines_buildings() {
    let mut st = State::new(42);
    st.side_mut(Side::Player).credits = 99999.0;
    let hq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    for _ in 0..9 {
        if let Some(s) = st.find_spot(3, 3, hq.x, hq.y, 14) {
            let _ = st.place_building(Side::Player, "barracks", s.0, s.1);
        }
    }
    finish_all(&mut st, Side::Player);
    let plant = st.side(Side::Player).buildings.iter().find(|b| b.typ == "plant").unwrap().id;
    st.damage(Side::Player, plant, false, 1e9, "koloss");
    st.tick(1.0 / 60.0);
    step(&mut st, 0.5);
    assert!(st.side(Side::Player).power_demand > st.side(Side::Player).power_supply);
    assert!(st.side(Side::Player).buildings.iter().any(|b| b.offline), "Brownout: manche Gebäude offline");
}

#[test]
fn nuke_two_stage() {
    let mut st = State::new(42);
    st.side_mut(Side::Player).credits = 99999.0;
    let hq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts = st.find_spot(3, 3, hq.x, hq.y, 14).unwrap();
    st.place_building(Side::Player, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Player);
    let ss = st.find_spot(4, 4, hq.x, hq.y, 15).unwrap();
    let silo = st.place_building(Side::Player, "silo", ss.0, ss.1).unwrap();
    finish_all(&mut st, Side::Player);
    st.find_building_mut(Side::Player, silo.id).unwrap().charge = 9999.0;
    st.tick(1.0 / 60.0);
    assert!(st.find_building(Side::Player, silo.id).unwrap().super_ready);
    assert_eq!(st.find_building(Side::Player, silo.id).unwrap().super_key.as_deref(), Some("nuke"), "Stufe 1 = Nuklearrakete");
    let ehq = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let hp0 = ehq.hp;
    st.launch_super(Side::Player, silo.id, ehq.x, ehq.y, 1).unwrap();
    step(&mut st, 6.0);
    let hp1 = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").map(|b| b.hp);
    assert!(hp1.map(|h| h < hp0).unwrap_or(true), "Nuklearrakete traf gegnerisches HQ");
    assert!(!st.find_building(Side::Player, silo.id).unwrap().super_ready, "Silo lädt nach Abschuss neu");
    st.side_mut(Side::Player).research.insert("hbomb".to_string());
    st.tick(1.0 / 60.0);
    assert_eq!(st.find_building(Side::Player, silo.id).unwrap().charge_max, 150.0, "Stufe 2 = H-Bombe (chargeMax)");
}

#[test]
fn storm_radiation() {
    let mut st = State::new(42);
    st.side_mut(Side::Enemy).credits = 99999.0;
    let ehq = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts = st.find_spot(3, 3, ehq.x, ehq.y, 12).unwrap();
    st.place_building(Side::Enemy, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    let ws = st.find_spot(3, 3, ehq.x, ehq.y, 13).unwrap();
    let w = st.place_building(Side::Enemy, "weather", ws.0, ws.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    st.side_mut(Side::Enemy).research.insert("weather".to_string());
    st.find_building_mut(Side::Enemy, w.id).unwrap().charge = 9999.0;
    st.tick(1.0 / 60.0);
    assert!(st.find_building(Side::Enemy, w.id).unwrap().super_ready, "Wetterstation lädt Blitzsturm");
    let phq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let hp0 = phq.hp;
    st.launch_super(Side::Enemy, w.id, phq.x, phq.y, 1).unwrap();
    assert_eq!(st.storms.len(), 1, "Blitzsturm aktiv");
    step(&mut st, 3.0);
    assert!(st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().hp < hp0, "Strahlung beschädigt Gebäude (Langzeitschaden)");
    assert!(st.side(Side::Player).buildings.iter().any(|b| b.irradiated > 0.0), "Gebäude verstrahlt");
    step(&mut st, 9.0);
    assert!(st.storms.is_empty(), "Sturm abgelaufen");
}

#[test]
fn solar_income() {
    let mut st = State::new(7);
    let ids: Vec<u32> = st.side(Side::Player).units.iter().filter(|u| u.typ == "harvester").map(|u| u.id).collect();
    for id in ids { st.damage(Side::Player, id, true, 1e9, "koloss"); }
    st.side_mut(Side::Player).research.insert("solar".to_string());
    let c0 = st.side(Side::Player).credits;
    step(&mut st, 5.0);
    let d = st.side(Side::Player).credits - c0;
    assert!(d > 50.0 && d < 72.0, "Solarsatellit ~12 Cr/s, delta={}", d);
}

#[test]
fn neutrino_fuel() {
    let mut st = State::new(7);
    let larve = st.side(Side::Enemy).units.iter().find(|u| u.typ == "larve").unwrap().clone();
    {
        let u = st.find_unit_mut(Side::Enemy, larve.id).unwrap();
        u.state = "move".into(); u.tx = u.x + 300.0; u.ty = u.y;
    }
    st.side_mut(Side::Enemy).neutrinos = 0.0;
    let x0 = st.find_unit_mut(Side::Enemy, larve.id).unwrap().x;
    step(&mut st, 1.0);
    let x1 = st.find_unit_mut(Side::Enemy, larve.id).unwrap().x;
    assert!((x1 - x0).abs() < 1.0, "Ohne Neutrinos keine Bewegung");
    st.side_mut(Side::Enemy).neutrinos = 500.0;
    step(&mut st, 1.0);
    let x2 = st.find_unit_mut(Side::Enemy, larve.id).unwrap().x;
    assert!((x2 - x0).abs() > 5.0, "Mit Neutrinos bewegt sich die Alien-Einheit");
}

#[test]
fn h3_value() {
    let st = State::new(11);
    assert!(st.map.ore_tiles.iter().any(|&t| st.map.res_kind[t] == Some("h3")), "H3-Vorkommen existiert");
    assert_eq!(resource_value("h3"), 8.0, "H3 = 8 Cr/Einheit");
}

#[test]
fn crossing_hybrid() {
    let mut st = State::new(13);
    st.side_mut(Side::Enemy).credits = 99999.0;
    let ehq = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts = st.find_spot(3, 3, ehq.x, ehq.y, 12).unwrap();
    st.place_building(Side::Enemy, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    let ls = st.find_spot(3, 3, ehq.x, ehq.y, 13).unwrap();
    let lab = st.place_building(Side::Enemy, "lab", ls.0, ls.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    st.cross_units(Side::Enemy, lab.id, "larve", "wespe").unwrap();
    step(&mut st, CROSS_TIME + 2.0);
    assert!(st.side(Side::Enemy).units.iter().any(|u| u.typ.starts_with("hyb_")), "Hybride gespawnt");
    assert!(st.cross_units(Side::Player, 1, "larve", "wespe").is_err(), "Menschen dürfen nicht kreuzen");
}

#[test]
fn tech_gating_and_hero_unique() {
    let mut st = State::new(17);
    st.side_mut(Side::Player).credits = 99999.0;
    let phq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let bs = st.find_spot(3, 3, phq.x, phq.y, 10).unwrap();
    let rax = st.place_building(Side::Player, "barracks", bs.0, bs.1).unwrap();
    finish_all(&mut st, Side::Player);
    assert!(st.can_produce(Side::Player, "rocket").is_err(), "Raketenwerfer ohne Tech gesperrt");
    assert!(st.can_produce(Side::Player, "infantry").is_ok(), "Soldat ab Kaserne frei");
    assert!(st.queue_unit(Side::Player, rax.id, "marina").is_err(), "Marina ohne Tech gesperrt");
    let ts = st.find_spot(3, 3, phq.x, phq.y, 12).unwrap();
    st.place_building(Side::Player, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Player);
    assert!(st.can_produce(Side::Player, "rocket").is_ok(), "Raketenwerfer nach Tech frei");
    assert!(st.queue_unit(Side::Player, rax.id, "marina").is_ok());
    assert!(st.queue_unit(Side::Player, rax.id, "marina").is_err(), "Held nur einmal baubar");
}

#[test]
fn fastbuild_combat_win() {
    let mut st = State::new(17);
    st.side_mut(Side::Player).credits = 99999.0;
    let phq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let bs = st.find_spot(3, 3, phq.x, phq.y, 10).unwrap();
    let rax = st.place_building(Side::Player, "barracks", bs.0, bs.1).unwrap();
    let ts = st.find_spot(3, 3, phq.x, phq.y, 12).unwrap();
    st.place_building(Side::Player, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Player);
    st.side_mut(Side::Player).research.insert("fastbuild".to_string());
    st.queue_unit(Side::Player, rax.id, "marina").unwrap();
    let u0 = st.side(Side::Player).units.len();
    step(&mut st, 20.0);
    assert!(st.side(Side::Player).units.len() > u0 && st.side(Side::Player).units.iter().any(|u| u.typ == "marina"), "Schnellfertigung: Marina nach 20s fertig (statt 25s)");
    let inf = st.side(Side::Player).units.iter().find(|u| u.typ == "infantry").unwrap().clone();
    let et = st.spawn_unit(Side::Enemy, "carapax", inf.x + 80.0, inf.y);
    let hp0 = et.hp;
    step(&mut st, 10.0);
    let hp1 = st.side(Side::Enemy).units.iter().find(|u| u.id == et.id).map(|u| u.hp);
    assert!(hp1.map(|h| h < hp0).unwrap_or(true), "Kampf: Carapax wird angegriffen");
    let eids: Vec<u32> = st.side(Side::Enemy).buildings.iter().map(|b| b.id).collect();
    for id in eids { st.damage(Side::Enemy, id, false, 1e9, "koloss"); }
    st.tick(1.0 / 60.0);
    assert_eq!(st.over, Some("win"), "Sieg wenn gegnerische HQ fällt");
}

#[test]
fn quark_and_diffuser() {
    let mut st = State::new(21);
    st.side_mut(Side::Enemy).credits = 99999.0;
    let ehq = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts = st.find_spot(3, 3, ehq.x, ehq.y, 12).unwrap();
    let tech = st.place_building(Side::Enemy, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    st.queue_research(Side::Enemy, tech.id, "quark").unwrap();
    step(&mut st, 42.0);
    assert!(st.singularities.len() >= SING_COUNT - 1, "Nano-Schwarze-Löcher gespawnt: {}", st.singularities.len());
    let sg = st.singularities[0].clone();
    let prey = st.spawn_unit(Side::Player, "tank", sg.x + sg.r * 0.6, sg.y);
    let d0 = dist(prey.x, prey.y, sg.x, sg.y);
    step(&mut st, 2.0);
    let d1 = st.find_unit_mut(Side::Player, prey.id).map(|u| dist(u.x, u.y, sg.x, sg.y)).unwrap_or(0.0);
    assert!(d1 < d0, "Schwarzes Loch zieht Einheit an ({} -> {})", d0, d1);
    st.side_mut(Side::Player).credits = 99999.0;
    let phq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts2 = st.find_spot(3, 3, phq.x, phq.y, 12).unwrap();
    st.place_building(Side::Player, "tech", ts2.0, ts2.1).unwrap();
    finish_all(&mut st, Side::Player);
    let ds = st.find_spot(2, 2, sg.x, sg.y, 8).unwrap();
    let dres = st.place_building(Side::Player, "diffuser", ds.0, ds.1).unwrap();
    finish_all(&mut st, Side::Player);
    let n0 = st.singularities.len();
    step(&mut st, DIFFUSER_KILL_TIME + 2.0);
    assert!(st.singularities.len() < n0, "Diffusormatrix annihiliert Schwarzes Loch ({} -> {})", n0, st.singularities.len());
    let tgt = st.spawn_unit(Side::Enemy, "larve", dres.x + 100.0, dres.y);
    let hp0 = tgt.hp;
    step(&mut st, 5.0);
    let hp1 = st.side(Side::Enemy).units.iter().find(|u| u.id == tgt.id).map(|u| u.hp);
    assert!(hp1.map(|h| h < hp0).unwrap_or(true), "Diffusormatrix feuert selbst (Annihilationsbolzen)");
}

#[test]
fn npulse_and_antimatter() {
    let mut st = State::new(21);
    st.side_mut(Side::Enemy).credits = 99999.0;
    st.side_mut(Side::Player).credits = 99999.0;
    let ehq = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let ts = st.find_spot(3, 3, ehq.x, ehq.y, 12).unwrap();
    st.place_building(Side::Enemy, "tech", ts.0, ts.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    let ws = st.find_spot(3, 3, ehq.x, ehq.y, 13).unwrap();
    let w = st.place_building(Side::Enemy, "weather", ws.0, ws.1).unwrap();
    finish_all(&mut st, Side::Enemy);
    st.side_mut(Side::Enemy).research.insert("weather".to_string());
    st.side_mut(Side::Enemy).research.insert("npulse".to_string());
    st.tick(1.0 / 60.0);
    {
        let b = st.find_building_mut(Side::Enemy, w.id).unwrap();
        b.charge = 9999.0; b.super2_charge = 9999.0;
    }
    st.tick(1.0 / 60.0);
    assert!(st.find_building(Side::Enemy, w.id).unwrap().super2_ready, "Zweiter Slot (Pulsstrahl) geladen");
    let phq = st.side(Side::Player).buildings.iter().find(|b| b.typ == "hq").unwrap().clone();
    let victim = st.spawn_unit(Side::Player, "tank", phq.x, phq.y);
    let hp0 = victim.hp;
    st.launch_super(Side::Enemy, w.id, phq.x + 10.0, phq.y, 2).unwrap();
    assert_eq!(st.beams.len(), 1, "Pulsstrahl abgefeuert");
    let hp1 = st.side(Side::Player).units.iter().find(|u| u.id == victim.id).map(|u| u.hp);
    assert!(hp1.map(|h| h < hp0).unwrap_or(true), "Pulsstrahl beschädigt Einheiten auf der Linie");
    assert!(!st.find_building(Side::Enemy, w.id).unwrap().super2_ready, "Slot lädt neu");
    st.side_mut(Side::Player).research.insert("hbomb".to_string());
    st.side_mut(Side::Player).research.insert("antimatter".to_string());
    let ts2 = st.find_spot(3, 3, phq.x, phq.y, 12).unwrap();
    st.place_building(Side::Player, "tech", ts2.0, ts2.1).unwrap();
    finish_all(&mut st, Side::Player);
    let ss = st.find_spot(4, 4, phq.x, phq.y, 14).unwrap();
    let silo = st.place_building(Side::Player, "silo", ss.0, ss.1).unwrap();
    finish_all(&mut st, Side::Player);
    st.find_building_mut(Side::Player, silo.id).unwrap().charge = 9999.0;
    st.tick(1.0 / 60.0);
    assert_eq!(st.find_building(Side::Player, silo.id).unwrap().super_key.as_deref(), Some("hbomb"));
    st.singularities.push(Singularity { x: ehq.x + 30.0, y: ehq.y, r: 6.0 * TILE, core: 0.9 * TILE, side: Side::Enemy, exposure: 0.0 });
    let n0 = st.singularities.len();
    let hp_e = ehq.hp;
    st.launch_super(Side::Player, silo.id, ehq.x, ehq.y, 1).unwrap();
    step(&mut st, 6.0);
    assert!(st.singularities.len() < n0, "Antimaterie-Sprengkopf annihiliert Schwarze Löcher");
    let hp_e2 = st.side(Side::Enemy).buildings.iter().find(|b| b.typ == "hq").map(|b| b.hp);
    assert!(hp_e2.map(|h| h < hp_e).unwrap_or(true), "H-Bombe (Antimaterie, Radius 8) traf");
}
