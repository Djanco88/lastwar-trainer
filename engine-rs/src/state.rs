//! Spielzustand + Aktionen (Bauen, Produzieren, Forschen, Superwaffen, Schaden).

use std::collections::HashSet;
use crate::cfg::*;
use crate::map::Map;

#[derive(Clone)]
pub struct Unit {
    pub id: u32, pub side: Side, pub typ: String, pub cls: &'static str,
    pub x: f32, pub y: f32, pub hp: f32, pub max_hp: f32, pub speed: f32,
    pub state: String, pub tx: f32, pub ty: f32, pub target_id: Option<u32>,
    pub cd: f32, pub carrying: f32, pub harvest_t: f32, pub ore_ti: Option<usize>,
    pub res_kind: Option<&'static str>, pub angle: f32, pub mutated: bool, pub hero: bool,
}

#[derive(Clone)]
pub struct QueueItem { pub kind: String, pub key: String, pub a: String, pub b: String, pub left: f32, pub max: f32 }

#[derive(Clone)]
pub struct Building {
    pub id: u32, pub side: Side, pub typ: String, pub tx: usize, pub ty: usize, pub w: usize, pub h: usize,
    pub x: f32, pub y: f32, pub hp: f32, pub max_hp: f32, pub constructing: bool, pub build_left: f32,
    pub queue: Vec<QueueItem>, pub rally: Option<(f32, f32)>, pub charge: f32, pub charge_max: f32,
    pub super_ready: bool, pub super_key: Option<String>, pub super2_ready: bool, pub super2_charge: f32,
    pub cd: f32, pub angle: f32, pub offline: bool, pub irradiated: f32,
}

#[derive(Clone)]
pub struct Projectile { pub x: f32, pub y: f32, pub tx: f32, pub ty: f32, pub tid: Option<u32>, pub src: String, pub dmg: f32, pub speed: f32, pub side: Side }
#[derive(Clone)]
pub struct Missile { pub x: f32, pub y: f32, pub tx: f32, pub ty: f32, pub t: f32, pub dur: f32, pub kind: String, pub side: Side }
#[derive(Clone)]
pub struct Storm { pub x: f32, pub y: f32, pub r: f32, pub side: Side, pub left: f32, pub acc: f32 }
#[derive(Clone)]
pub struct Singularity { pub x: f32, pub y: f32, pub r: f32, pub core: f32, pub side: Side, pub exposure: f32 }
#[derive(Clone)]
pub struct Beam { pub x1: f32, pub y1: f32, pub x2: f32, pub y2: f32, pub side: Side, pub left: f32, pub max: f32 }

pub struct SideState {
    pub faction: &'static str, pub credits: f32, pub neutrinos: f32,
    pub research: HashSet<String>, pub buildings: Vec<Building>, pub units: Vec<Unit>,
    pub power_supply: f32, pub power_demand: f32,
}

pub struct State {
    pub time: f32, pub over: Option<&'static str>, pub next_id: u32,
    pub map: Map, pub occ: Vec<u32>,
    pub projectiles: Vec<Projectile>, pub missiles: Vec<Missile>, pub storms: Vec<Storm>,
    pub singularities: Vec<Singularity>, pub beams: Vec<Beam>,
    pub events: Vec<String>, pub rng_state: u32,
    pub sides: [SideState; 2],
    pub hybrids: Vec<(String, UnitCfg)>,
}

impl State {
    pub fn new(seed: u32) -> State {
        let map = Map::gen(seed);
        let occ = vec![0u32; map.w * map.h];
        let mk = |faction: &'static str, neutrinos: f32| SideState {
            faction, credits: START_CREDITS, neutrinos,
            research: HashSet::new(), buildings: Vec::new(), units: Vec::new(),
            power_supply: 0.0, power_demand: 0.0,
        };
        let mut st = State {
            time: 0.0, over: None, next_id: 1, map, occ,
            projectiles: Vec::new(), missiles: Vec::new(), storms: Vec::new(),
            singularities: Vec::new(), beams: Vec::new(),
            events: Vec::new(), rng_state: seed ^ 0x9e3779b9,
            sides: [mk("human", 0.0), mk("alien", START_NEUTRINOS)],
            hybrids: Vec::new(),
        };
        let hq_p = st.place_raw(Side::Player, "hq", 4, st.map.h - 8);
        let hq_e = st.place_raw(Side::Enemy, "hq", st.map.w - 8, 4);
        if let Some(s) = st.find_spot(2, 2, hq_p.x, hq_p.y, 9) { st.place_raw(Side::Player, "plant", s.0, s.1); }
        if let Some(s) = st.find_spot(2, 2, hq_e.x, hq_e.y, 9) { st.place_raw(Side::Enemy, "plant", s.0, s.1); }
        if let Some(ti) = st.nearest_ore(hq_p.x, hq_p.y) {
            let cx = (ti % st.map.w) as f32 * TILE + TILE / 2.0;
            let cy = (ti / st.map.w) as f32 * TILE + TILE / 2.0;
            if let Some(s) = st.find_spot(3, 3, cx, cy, 7) { st.place_raw(Side::Player, "refinery", s.0, s.1); }
        }
        if let Some(ti) = st.nearest_ore(hq_e.x, hq_e.y) {
            let cx = (ti % st.map.w) as f32 * TILE + TILE / 2.0;
            let cy = (ti / st.map.w) as f32 * TILE + TILE / 2.0;
            if let Some(s) = st.find_spot(3, 3, cx, cy, 7) { st.place_raw(Side::Enemy, "refinery", s.0, s.1); }
        }
        for _ in 0..2 { st.spawn_near(&hq_p, "harvester"); }
        for _ in 0..4 { st.spawn_near(&hq_p, "infantry"); }
        for _ in 0..2 { st.spawn_near(&hq_e, "harvester"); }
        for _ in 0..4 { st.spawn_near(&hq_e, "larve"); }
        st.events.push("Willkommen bei LASTWAR.".to_string());
        st
    }

    pub fn rng(&mut self) -> f32 {
        let mut a = self.rng_state;
        a = a.wrapping_add(0x6D2B79F5);
        self.rng_state = a;
        let mut t = a.wrapping_mul(1 | a);
        t = (t ^ (t >> 7)).wrapping_mul(61 | t) ^ t;
        ((t ^ (t >> 14)) >> 0) as f32 / 4294967296.0
    }

    pub fn unit_cfg(&self, key: &str) -> Option<UnitCfg> {
        if let Some(h) = self.hybrids.iter().find(|(k, _)| k == key) { return Some(h.1.clone()); }
        unit_cfg_static(key)
    }

    pub fn side(&self, s: Side) -> &SideState { &self.sides[s.idx()] }
    pub fn side_mut(&mut self, s: Side) -> &mut SideState { &mut self.sides[s.idx()] }

    pub fn find_building(&self, s: Side, id: u32) -> Option<&Building> { self.side(s).buildings.iter().find(|b| b.id == id) }
    pub fn find_building_mut(&mut self, s: Side, id: u32) -> Option<&mut Building> { self.side_mut(s).buildings.iter_mut().find(|b| b.id == id) }
    pub fn find_unit_mut(&mut self, s: Side, id: u32) -> Option<&mut Unit> { self.side_mut(s).units.iter_mut().find(|u| u.id == id) }

    pub fn find_global(&self, id: u32) -> Option<(Side, u32, bool)> {
        for s in [Side::Player, Side::Enemy] {
            if let Some(u) = self.side(s).units.iter().find(|u| u.id == id) { return Some((s, u.id, true)); }
            if let Some(b) = self.side(s).buildings.iter().find(|b| b.id == id) { return Some((s, b.id, false)); }
        }
        None
    }

    pub fn has_any(&self, s: Side, t: &str) -> bool { self.side(s).buildings.iter().any(|b| b.typ == t) }
    pub fn has_completed(&self, s: Side, t: &str) -> bool { self.side(s).buildings.iter().any(|b| b.typ == t && !b.constructing) }

    pub fn can_build(&self, s: Side, key: &str) -> Result<(), String> {
        let b = building_cfg(key).ok_or("Unbekanntes Gebäude")?;
        if key == "hq" { return Err("Nicht baubar".into()); }
        let fac = self.side(s).faction;
        if let Some(f) = b.faction { if f != fac { return Err(format!("Nur für {}", f)); } }
        if let Some(r) = b.req { if !self.has_completed(s, r) { return Err(format!("Benötigt {}", r)); } }
        Ok(())
    }

    pub fn rect_free(&self, tx: usize, ty: usize, w: usize, h: usize) -> bool {
        for dy in 0..h { for dx in 0..w {
            let x = tx + dx; let y = ty + dy;
            if x >= self.map.w || y >= self.map.h { return false; }
            let t = self.map.ti(x, y);
            if self.map.tiles[t] != 0 { return false; }
            if self.occ[t] != 0 { return false; }
        } }
        true
    }

    pub fn adjacent_water(&self, tx: usize, ty: usize, size: usize) -> bool {
        for dy in -1..=(size as i32) { for dx in -1..=(size as i32) {
            if dx >= 0 && dx < size as i32 && dy >= 0 && dy < size as i32 { continue; }
            let x = tx as i32 + dx; let y = ty as i32 + dy;
            if self.map.in_b(x, y) && self.map.tiles[self.map.ti(x as usize, y as usize)] == 3 { return true; }
        } }
        false
    }

    pub fn can_place_at(&self, s: Side, key: &str, tx: usize, ty: usize) -> Result<(), String> {
        self.can_build(s, key)?;
        let b = building_cfg(key).unwrap();
        if !self.rect_free(tx, ty, b.size, b.size) { return Err("Gelände blockiert".into()); }
        if key == "hydro" && !self.adjacent_water(tx, ty, b.size) { return Err("Benötigt Schlucht (Wasser) in der Nähe".into()); }
        Ok(())
    }

    pub fn find_spot(&self, w: usize, h: usize, cx: f32, cy: f32, max_r: i32) -> Option<(usize, usize)> {
        let cxt = (cx / TILE) as i32; let cyt = (cy / TILE) as i32;
        let mut best: Option<(usize, usize)> = None; let mut bd = f32::MAX;
        for dy in -max_r..=max_r { for dx in -max_r..=max_r {
            let tx = cxt + dx; let ty = cyt + dy;
            if tx < 0 || ty < 0 { continue; }
            let (tx, ty) = (tx as usize, ty as usize);
            if !self.rect_free(tx, ty, w, h) { continue; }
            let d = dist((tx as f32 + w as f32 / 2.0) * TILE, (ty as f32 + h as f32 / 2.0) * TILE, cx, cy);
            if d < bd { bd = d; best = Some((tx, ty)); }
        } }
        best
    }

    pub fn place_raw(&mut self, s: Side, key: &str, tx: usize, ty: usize) -> Building {
        let b = building_cfg(key).unwrap();
        let bd = Building {
            id: self.next_id, side: s, typ: key.to_string(), tx, ty, w: b.size, h: b.size,
            x: (tx as f32 + b.size as f32 / 2.0) * TILE, y: (ty as f32 + b.size as f32 / 2.0) * TILE,
            hp: b.hp, max_hp: b.hp, constructing: b.time > 0.0, build_left: b.time,
            queue: Vec::new(), rally: None, charge: 0.0, charge_max: 0.0, super_ready: false,
            super_key: None, super2_ready: false, super2_charge: 0.0,
            cd: 0.0, angle: -std::f32::consts::FRAC_PI_2, offline: false, irradiated: 0.0,
        };
        self.next_id += 1;
        for dy in 0..bd.h { for dx in 0..bd.w { self.occ[self.map.ti(tx + dx, ty + dy)] = bd.id; } }
        self.side_mut(s).buildings.push(bd.clone());
        bd
    }

    pub fn place_building(&mut self, s: Side, key: &str, tx: usize, ty: usize) -> Result<Building, String> {
        self.can_place_at(s, key, tx, ty)?;
        let cost = building_cfg(key).unwrap().cost;
        if self.side(s).credits < cost { return Err("Zu wenig Credits".into()); }
        self.side_mut(s).credits -= cost;
        Ok(self.place_raw(s, key, tx, ty))
    }

    pub fn spawn_unit(&mut self, s: Side, typ: &str, x: f32, y: f32) -> Unit {
        let c = self.unit_cfg(typ).unwrap();
        let u = Unit {
            id: self.next_id, side: s, typ: typ.to_string(), cls: c.cls,
            x, y, hp: c.hp, max_hp: c.hp, speed: c.speed, state: "idle".into(),
            tx: x, ty: y, target_id: None, cd: 0.0, carrying: 0.0, harvest_t: 0.0,
            ore_ti: None, res_kind: None, angle: 0.0, mutated: false, hero: c.hero,
        };
        self.next_id += 1;
        self.side_mut(s).units.push(u.clone());
        u
    }

    pub fn spawn_near(&mut self, b: &Building, typ: &str) -> Option<Unit> {
        let c = self.unit_cfg(typ)?;
        if c.cls == "aircraft" {
            let ax = b.x; let ay = (b.y - (b.h as f32 * TILE) / 2.0 - 18.0).max(20.0);
            return Some(self.spawn_unit(b.side, typ, ax, ay));
        }
        for r in 1..=6i32 {
            for dy in -r..=r { for dx in -r..=r {
                if dy.abs().max(dx.abs()) != r { continue; }
                let tx = b.tx as i32 + b.w as i32 / 2 + dx;
                let ty = b.ty as i32 + b.h as i32 / 2 + dy;
                if tx < 0 || ty < 0 { continue; }
                let px = (tx as f32 + 0.5) * TILE; let py = (ty as f32 + 0.5) * TILE;
                if !self.pos_blocked(px, py, typ) { return Some(self.spawn_unit(b.side, typ, px, py)); }
            } }
        }
        None
    }

    pub fn pos_blocked(&self, x: f32, y: f32, typ: &str) -> bool {
        if x < 6.0 || y < 6.0 || x >= self.map.w as f32 * TILE - 6.0 || y >= self.map.h as f32 * TILE - 6.0 { return true; }
        for (ox, oy) in [(0.0, 0.0), (8.0, 0.0), (-8.0, 0.0), (0.0, 8.0), (0.0, -8.0)] {
            let tx = ((x + ox) / TILE) as i32; let ty = ((y + oy) / TILE) as i32;
            if !self.map.in_b(tx, ty) { return true; }
            let t = self.map.ti(tx as usize, ty as usize);
            let tile = self.map.tiles[t];
            if tile == 1 || tile == 3 { return true; }
            if tile == 2 && typ != "harvester" { return true; }
            if self.occ[t] != 0 { return true; }
        }
        false
    }

    pub fn can_produce(&self, s: Side, key: &str) -> Result<(), String> {
        let u = self.unit_cfg(key).ok_or("Unbekannt")?;
        let fac = self.side(s).faction;
        if let Some(f) = u.faction { if f != fac { return Err(format!("Nur für {}", f)); } }
        if let Some(r) = u.req { if !self.has_completed(s, r) { return Err(format!("Benötigt {}", r)); } }
        if !self.has_completed(s, u.prod) { return Err(format!("Benötigt {}", u.prod)); }
        Ok(())
    }

    pub fn queue_unit(&mut self, s: Side, b_id: u32, key: &str) -> Result<(), String> {
        let b = self.find_building(s, b_id).cloned().ok_or("Gebäude fehlt")?;
        if b.constructing { return Err("Gebäude nicht fertig".into()); }
        let u = self.unit_cfg(key).ok_or("Unbekannte Einheit")?;
        if u.prod != b.typ { return Err("Falsches Gebäude".into()); }
        self.can_produce(s, key)?;
        if self.side(s).credits < u.cost { return Err("Zu wenig Credits".into()); }
        if b.queue.len() >= 5 { return Err("Warteschlange voll".into()); }
        let hero_taken = u.hero && (self.side(s).units.iter().any(|x| x.typ == key) || self.side(s).buildings.iter().any(|bb| bb.queue.iter().any(|q| q.kind == "unit" && q.key == key)));
        if hero_taken { return Err("Held bereits im Einsatz".into()); }
        self.side_mut(s).credits -= u.cost;
        let q = QueueItem { kind: "unit".into(), key: key.to_string(), a: String::new(), b: String::new(), left: u.time, max: u.time };
        self.find_building_mut(s, b_id).unwrap().queue.push(q);
        Ok(())
    }

    pub fn can_research(&self, s: Side, key: &str) -> Result<(), String> {
        let r = research_cfg(key).ok_or("Unbekannt")?;
        let fac = self.side(s).faction;
        if let Some(f) = r.faction { if f != fac { return Err(format!("Nur für {}", f)); } }
        if self.side(s).research.contains(key) { return Err("Bereits erforscht".into()); }
        if let Some(req) = r.req { if !self.has_any(s, req) { return Err(format!("Benötigt {}", req)); } }
        if !self.has_completed(s, "tech") { return Err("Benötigt Tech-Zentrum".into()); }
        Ok(())
    }

    pub fn queue_research(&mut self, s: Side, b_id: u32, key: &str) -> Result<(), String> {
        let b = self.find_building(s, b_id).cloned().ok_or("Kein Tech-Zentrum")?;
        if b.typ != "tech" || b.constructing { return Err("Kein fertiges Tech-Zentrum".into()); }
        self.can_research(s, key)?;
        if b.queue.iter().any(|q| q.kind == "research" && q.key == key) { return Err("Bereits in Forschung".into()); }
        let r = research_cfg(key).unwrap();
        if self.side(s).credits < r.cost { return Err("Zu wenig Credits".into()); }
        if b.queue.len() >= 3 { return Err("Warteschlange voll".into()); }
        self.side_mut(s).credits -= r.cost;
        let q = QueueItem { kind: "research".into(), key: key.to_string(), a: String::new(), b: String::new(), left: r.time, max: r.time };
        self.find_building_mut(s, b_id).unwrap().queue.push(q);
        Ok(())
    }

    pub fn cross_units(&mut self, s: Side, b_id: u32, a: &str, b: &str) -> Result<(), String> {
        let lab = self.find_building(s, b_id).cloned().ok_or("Kein Kreuzungslabor")?;
        if lab.typ != "lab" || lab.constructing { return Err("Kein fertiges Kreuzungslabor".into()); }
        if self.side(s).faction != "alien" { return Err("Nur für Aliens".into()); }
        if a == b { return Err("Zwei verschiedene Klassen wählen".into()); }
        if self.side(s).credits < CROSS_COST { return Err("Zu wenig Credits".into()); }
        if lab.queue.len() >= 2 { return Err("Labor ausgelastet".into()); }
        self.side_mut(s).credits -= CROSS_COST;
        let q = QueueItem { kind: "cross".into(), key: String::new(), a: a.to_string(), b: b.to_string(), left: CROSS_TIME, max: CROSS_TIME };
        self.find_building_mut(s, b_id).unwrap().queue.push(q);
        Ok(())
    }

    pub fn make_hybrid(&mut self, s: Side, lab_id: u32, a: &str, b: &str) -> Option<Unit> {
        let key = format!("hyb_{}_{}", a, b);
        if !self.hybrids.iter().any(|(k, _)| k == &key) {
            let ca = self.unit_cfg(a)?; let cb = self.unit_cfg(b)?;
            let cls = if ca.cls == "aircraft" || cb.cls == "aircraft" { "aircraft" } else if ca.cls == "vehicle" || cb.cls == "vehicle" { "vehicle" } else { "infantry" };
            let wa = ca.weapon.unwrap_or(WeaponCfg { range: 3.0, dmg: 8.0, rate: 1.2, speed: 10.0, anti_air: false });
            let wb = cb.weapon.unwrap_or(wa);
            self.hybrids.push((key.clone(), UnitCfg {
                name: format!("Hybrid {}x{}", ca.name, cb.name), cost: 0.0,
                hp: ca.hp.max(cb.hp) * 1.2, speed: (ca.speed + cb.speed) / 2.0, time: 0.0,
                prod: "lab", cls, faction: Some("alien"), req: None, hero: false,
                weapon: Some(WeaponCfg {
                    range: wa.range.max(wb.range),
                    dmg: ((wa.dmg + wb.dmg) / 2.0 * 1.4).round(),
                    rate: (wa.rate + wb.rate) / 2.0,
                    speed: wa.speed.max(wb.speed),
                    anti_air: wa.anti_air || wb.anti_air,
                }),
            }));
        }
        let lab = self.find_building(s, lab_id)?.clone();
        self.spawn_near(&lab, &key)
    }

    pub fn nearest_ore(&self, x: f32, y: f32) -> Option<usize> {
        let mut best = None; let mut bd = f32::MAX;
        for &t in &self.map.ore_tiles {
            if self.map.ore[t] <= 0 { continue; }
            let tx = (t % self.map.w) as f32 * TILE + TILE / 2.0;
            let ty = (t / self.map.w) as f32 * TILE + TILE / 2.0;
            let d = dist(x, y, tx, ty);
            if d < bd { bd = d; best = Some(t); }
        }
        best
    }

    pub fn move_toward(&mut self, u_id: u32, x: f32, y: f32, dt: f32) -> bool {
        let s = match self.find_global(u_id) { Some((s, _, true)) => s, _ => return false };
        let sp = self.find_unit_mut(s, u_id).unwrap().speed * TILE * dt;
        if self.side(s).faction == "alien" {
            let cost = sp * NEUTRINO_MOVE_COST;
            if self.side(s).neutrinos < cost {
                let u = self.find_unit_mut(s, u_id).unwrap();
                return dist(u.x, u.y, x, y) < 6.0;
            }
            self.side_mut(s).neutrinos -= cost;
        }
        let (ux, uy, cls, typ) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.x, u.y, u.cls, u.typ.clone()) };
        let dx = x - ux; let dy = y - uy; let d = dx.hypot(dy);
        if d < 6.0 { return true; }
        let (nx, ny) = if cls == "aircraft" {
            (ux + dx / d * sp, uy + dy / d * sp)
        } else {
            let tx = ux + dx / d * sp; let ty = uy + dy / d * sp;
            if !self.pos_blocked(tx, ty, &typ) { (tx, ty) }
            else if !self.pos_blocked(tx, uy, &typ) { (tx, uy) }
            else if !self.pos_blocked(ux, ty, &typ) { (ux, ty) }
            else { (ux, uy) }
        };
        let u = self.find_unit_mut(s, u_id).unwrap();
        u.x = nx; u.y = ny; u.angle = dy.atan2(dx);
        dist(nx, ny, x, y) < 6.0
    }

    pub fn in_any_storm(&self, x: f32, y: f32) -> bool {
        self.storms.iter().any(|s| dist(x, y, s.x, s.y) <= s.r)
    }

    pub fn acquire_unit(&self, ux: f32, uy: f32, uside: Side, utyp: &str, wpn: &WeaponCfg, range_px: f32) -> Option<(Side, u32, bool)> {
        let os = self.side(uside.other());
        let mut best: Option<(Side, u32, bool)> = None; let mut bd = range_px;
        for e in &os.units {
            if e.cls == "aircraft" && !wpn.anti_air { continue; }
            let d = dist(ux, uy, e.x, e.y);
            if d <= bd { bd = d; best = Some((e.side, e.id, true)); }
        }
        if best.is_none() && dmg_vs(utyp, "building") > 0.0 {
            for b in &os.buildings {
                let d = dist(ux, uy, b.x, b.y);
                if d <= bd { bd = d; best = Some((b.side, b.id, false)); }
            }
        }
        best
    }

    pub fn damage(&mut self, side: Side, id: u32, is_unit: bool, dmg: f32, src: &str) {
        if is_unit {
            let cls = match self.side(side).units.iter().find(|u| u.id == id) { Some(u) => u.cls, None => return };
            let mult = dmg_vs(src, cls);
            if mult == 0.0 { return; }
            let mut dmg = dmg * mult;
            if self.side(side).research.contains("armor") { dmg *= 0.7; }
            let u = self.find_unit_mut(side, id).unwrap();
            u.hp -= dmg;
            if u.hp <= 0.0 { self.destroy_unit(side, id); }
        } else {
            let mult = dmg_vs(src, "building");
            if mult == 0.0 { return; }
            let mut dmg = dmg * mult;
            if self.side(side).research.contains("armor") { dmg *= 0.7; }
            let b = self.find_building_mut(side, id).unwrap();
            b.hp -= dmg;
            if b.hp <= 0.0 { self.destroy_building(side, id); }
        }
    }

    pub fn destroy_unit(&mut self, side: Side, id: u32) {
        let st = self.side_mut(side);
        if let Some(i) = st.units.iter().position(|u| u.id == id) { st.units.remove(i); }
        self.check_end();
    }

    pub fn destroy_building(&mut self, side: Side, id: u32) {
        let b = self.side(side).buildings.iter().find(|b| b.id == id).cloned();
        if let Some(b) = b {
            {
                let st = self.side_mut(side);
                if let Some(i) = st.buildings.iter().position(|x| x.id == id) { st.buildings.remove(i); }
            }
            for dy in 0..b.h { for dx in 0..b.w { self.occ[self.map.ti(b.tx + dx, b.ty + dy)] = 0; } }
            self.events.push(format!("{} zerstört!", b.typ));
        }
        self.check_end();
    }

    pub fn check_end(&mut self) {
        if self.over.is_some() { return; }
        if !self.has_any(Side::Enemy, "hq") { self.over = Some("win"); }
        else if !self.has_any(Side::Player, "hq") { self.over = Some("lose"); }
    }

    pub fn explode(&mut self, x: f32, y: f32, r_tiles: f32, dmg: f32, side: Side, src: &str, anti: bool) {
        let r = r_tiles * TILE;
        let mut hits: Vec<(Side, u32, bool, f32)> = Vec::new();
        for s in [Side::Player, Side::Enemy] {
            for u in &self.side(s).units {
                let d = dist(u.x, u.y, x, y);
                if d <= r { hits.push((s, u.id, true, dmg * (1.0 - 0.6 * d / r))); }
            }
            for b in &self.side(s).buildings {
                let d = dist(b.x, b.y, x, y);
                if d <= r { hits.push((s, b.id, false, dmg * (1.0 - 0.6 * d / r))); }
            }
        }
        for (s, id, is_u, dd) in hits { self.damage(s, id, is_u, dd, src); }
        if anti {
            let r2 = r;
            let mut kept = Vec::new();
            for sg in self.singularities.drain(..) {
                if dist(sg.x, sg.y, x, y) > r2 { kept.push(sg); } else { self.events.push("Nano-Schwarzes Loch annihiliert!".to_string()); }
            }
            self.singularities = kept;
        }
    }

    pub fn launch_super(&mut self, s: Side, b_id: u32, x: f32, y: f32, which: u8) -> Result<(), String> {
        let b = self.find_building(s, b_id).cloned().ok_or("Gebäude nicht gefunden")?;
        let ready = if which == 2 { b.super2_ready } else { b.super_ready };
        let key = if which == 2 { "npulse".to_string() } else { b.super_key.clone().ok_or("Superwaffe nicht bereit")? };
        if !ready { return Err("Superwaffe nicht bereit".into()); }
        let sup = super_cfg(&key).ok_or("Unbekannte Superwaffe")?;
        let x = clamp(x, 16.0, self.map.w as f32 * TILE - 16.0);
        let y = clamp(y, 16.0, self.map.h as f32 * TILE - 16.0);
        match key.as_str() {
            "storm" => self.storms.push(Storm { x, y, r: sup.radius * TILE, side: s, left: sup.duration, acc: 0.0 }),
            "npulse" => {
                let wpx = sup.width * TILE / 2.0;
                let os = s.other();
                let mut hits: Vec<(u32, bool)> = Vec::new();
                for u in &self.side(os).units {
                    if dist_to_segment(u.x, u.y, b.x, b.y, x, y) <= wpx { hits.push((u.id, true)); }
                }
                for bb in &self.side(os).buildings {
                    if dist_to_segment(bb.x, bb.y, b.x, b.y, x, y) <= wpx { hits.push((bb.id, false)); }
                }
                for (id, is_u) in hits { let d = if is_u { sup.dmg } else { sup.dmg * 0.8 }; self.damage(os, id, is_u, d, "npulse"); }
                self.beams.push(Beam { x1: b.x, y1: b.y, x2: x, y2: y, side: s, left: 0.7, max: 0.7 });
            }
            _ => self.missiles.push(Missile { x: b.x, y: b.y - 20.0, tx: x, ty: y, t: 0.0, dur: sup.missile, kind: key.clone(), side: s }),
        }
        if which == 2 {
            let bb = self.find_building_mut(s, b_id).unwrap();
            bb.super2_ready = false; bb.super2_charge = 0.0;
        } else {
            let bb = self.find_building_mut(s, b_id).unwrap();
            bb.super_ready = false; bb.charge = 0.0;
        }
        Ok(())
    }

    pub fn spawn_singularities(&mut self, side: Side, n: usize) {
        let mut placed = 0; let mut tries = 0;
        while placed < n && tries < 400 {
            tries += 1;
            let tx = 2 + (self.rng() * (self.map.w - 4) as f32) as usize;
            let ty = 2 + (self.rng() * (self.map.h - 4) as f32) as usize;
            if self.map.tiles[self.map.ti(tx, ty)] != 0 { continue; }
            let x = (tx as f32 + 0.5) * TILE; let y = (ty as f32 + 0.5) * TILE;
            let mut ok = true;
            for s in [Side::Player, Side::Enemy] {
                for b in &self.side(s).buildings {
                    if dist(x, y, b.x, b.y) < 4.0 * TILE { ok = false; }
                }
            }
            for sg in &self.singularities {
                if dist(x, y, sg.x, sg.y) < 8.0 * TILE { ok = false; }
            }
            if !ok { continue; }
            self.singularities.push(Singularity { x, y, r: SING_PULL_RADIUS * TILE, core: SING_CORE * TILE, side, exposure: 0.0 });
            placed += 1;
        }
        if placed > 0 { self.events.push(format!("Quarkbosonspalten aktiv: {} Nano-Schwarze-Löcher!", placed)); }
    }
}
