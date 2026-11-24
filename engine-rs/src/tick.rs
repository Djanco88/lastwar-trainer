//! Simulation pro Tick (Bewegung, Kampf, Ökonomie, Strom, Superwaffen, Strahlung).

use crate::cfg::*;
use crate::state::*;

impl State {
    pub fn update_power(&mut self, sk: Side) {
        let mut supply = 0i32; let mut demand = 0i32;
        for b in &self.side(sk).buildings {
            if b.constructing { continue; }
            let p = building_cfg(&b.typ).map(|c| c.power).unwrap_or(0);
            if p > 0 { supply += p; } else { demand -= p; }
        }
        let deficit = if demand > supply { (demand - supply) as f32 / demand as f32 } else { 0.0 };
        let ids: Vec<u32> = self.side(sk).buildings.iter().map(|b| b.id).collect();
        for id in ids {
            let (bx, by, constructing, is_plant) = {
                let b = self.find_building(sk, id).unwrap();
                (b.x, b.y, b.constructing, building_cfg(&b.typ).map(|c| c.power > 0).unwrap_or(false))
            };
            let off = if constructing || is_plant { false } else { self.rng() < deficit || self.in_any_storm(bx, by) };
            self.find_building_mut(sk, id).unwrap().offline = off;
        }
        let ss = self.side_mut(sk);
        ss.power_supply = supply as f32; ss.power_demand = demand as f32;
    }

    pub fn finish_queue_item(&mut self, s: Side, b_id: u32, q: &QueueItem) -> bool {
        if q.kind == "unit" {
            let uc = match self.unit_cfg(&q.key) { Some(c) => c, None => return true };
            let hero_taken = uc.hero && (self.side(s).units.iter().any(|u| u.typ == q.key)
                || self.side(s).buildings.iter().any(|bb| bb.id != b_id && bb.queue.iter().any(|qq| qq.kind == "unit" && qq.key == q.key)));
            if hero_taken { return true; }
            let b = self.find_building(s, b_id).unwrap().clone();
            match self.spawn_near(&b, &q.key) {
                Some(u) => {
                    let id = u.id;
                    let mut uu = self.find_unit_mut(s, id).unwrap();
                    if let Some(r) = b.rally { uu.state = "move".into(); uu.tx = r.0; uu.ty = r.1; }
                    true
                }
                None => false,
            }
        } else if q.kind == "research" {
            self.side_mut(s).research.insert(q.key.clone());
            if q.key == "quark" { let n = SING_COUNT; self.spawn_singularities(s, n); }
            true
        } else if q.kind == "cross" {
            self.make_hybrid(s, b_id, &q.a, &q.b);
            true
        } else { true }
    }

    pub fn update_building(&mut self, s: Side, b_id: u32, dt: f32) {
        {
            let b = match self.find_building_mut(s, b_id) { Some(b) => b, None => return };
            if b.constructing {
                b.build_left -= dt;
                if b.build_left <= 0.0 { b.constructing = false; }
            }
            if b.irradiated > 0.0 {
                b.irradiated -= dt;
                b.hp -= RADIATION_BUILDING_DOT * dt;
                if b.hp <= 0.0 { self.destroy_building(s, b_id); return; }
            }
        }
        if self.find_building(s, b_id).unwrap().constructing { return; }
        {
            let offline = self.find_building(s, b_id).unwrap().offline;
            let has_q = !self.find_building(s, b_id).unwrap().queue.is_empty();
            if !offline && has_q {
                let spd = if self.side(s).research.contains("fastbuild") { 1.5 } else { 1.0 };
                self.find_building_mut(s, b_id).unwrap().queue[0].left -= dt * spd;
                let done = self.find_building(s, b_id).unwrap().queue[0].left <= 0.0;
                if done {
                    let q2 = self.find_building(s, b_id).unwrap().queue[0].clone();
                    if self.finish_queue_item(s, b_id, &q2) {
                        self.find_building_mut(s, b_id).unwrap().queue.remove(0);
                    }
                }
            }
        }
        {
            let typ0 = self.find_building(s, b_id).unwrap().typ.clone();
            let w = building_weapon(&typ0);
            if let Some(w) = w {
                let offline = self.find_building(s, b_id).unwrap().offline;
                if !offline {
                    self.find_building_mut(s, b_id).unwrap().cd -= dt;
                    let range_px = w.range * TILE;
                    let os = s.other();
                    let (bx, by) = { let b = self.find_building(s, b_id).unwrap(); (b.x, b.y) };
                    let mut best: Option<u32> = None; let mut bd = range_px;
                    for e in &self.side(os).units {
                        if e.cls == "aircraft" && !w.anti_air { continue; }
                        let d = dist(bx, by, e.x, e.y);
                        if d <= bd { bd = d; best = Some(e.id); }
                    }
                    if let Some(tid) = best {
                        let (tx, ty) = { let t = self.side(os).units.iter().find(|u| u.id == tid).unwrap(); (t.x, t.y) };
                        let cd_left = self.find_building(s, b_id).unwrap().cd;
                        let plasma = self.side(s).research.contains("plasma");
                        let dmg = w.dmg * if plasma { 1.35 } else { 1.0 };
                        if cd_left <= 0.0 {
                            self.projectiles.push(Projectile { x: bx, y: by, tx, ty, tid: Some(tid), src: typ0.clone(), dmg, speed: w.speed * TILE, side: s });
                        }
                        let b2 = self.find_building_mut(s, b_id).unwrap();
                        b2.angle = (ty - by).atan2(tx - bx);
                        if cd_left <= 0.0 { b2.cd = w.rate; }
                    }
                }
            }
        }
        {
            let typ = self.find_building(s, b_id).unwrap().typ.clone();
            let mut holder = super_holder(&typ);
            if holder == Some("storm") && !self.side(s).research.contains("weather") { holder = None; }
            if let Some(h) = holder {
                let has_hbomb = self.side(s).research.contains("hbomb");
                let key = if typ == "silo" { if has_hbomb { "hbomb" } else { "nuke" } } else { h };
                let b = self.find_building_mut(s, b_id).unwrap();
                if !b.offline {
                    let sup = super_cfg(key).unwrap();
                    b.super_key = Some(key.to_string());
                    b.charge_max = sup.charge;
                    if !b.super_ready {
                        b.charge += dt;
                        if b.charge >= sup.charge { b.charge = sup.charge; b.super_ready = true; }
                    }
                }
            }
            if typ == "weather" && self.side(s).research.contains("npulse") {
                let b = self.find_building_mut(s, b_id).unwrap();
                if !b.offline && !b.super2_ready {
                    b.super2_charge += dt;
                    let cmax = super_cfg("npulse").unwrap().charge;
                    if b.super2_charge >= cmax { b.super2_charge = cmax; b.super2_ready = true; }
                }
            }
        }
    }

    pub fn update_harvester(&mut self, s: Side, u_id: u32, dt: f32) {
        let st = self.find_unit_mut(s, u_id).unwrap().state.clone();
        if st == "mine" {
            let ore_ti0 = self.find_unit_mut(s, u_id).unwrap().ore_ti;
            let ti = match ore_ti0 { Some(t) if self.map.ore[t] > 0 => t, _ => { self.find_unit_mut(s, u_id).unwrap().state = "idle".into(); return; } };
            let ht = self.find_unit_mut(s, u_id).unwrap().harvest_t + dt;
            if ht >= HARVEST_TIME {
                let take = HARVEST_AMOUNT.min(self.map.ore[ti] as f32);
                self.map.ore[ti] -= take as i32;
                {
                    let u = self.find_unit_mut(s, u_id).unwrap();
                    u.carrying += take; u.harvest_t = 0.0; u.state = "return".into();
                }
                if self.map.ore[ti] <= 0 {
                    self.map.tiles[ti] = 0;
                    if let Some(i) = self.map.ore_tiles.iter().position(|&x| x == ti) { self.map.ore_tiles.remove(i); }
                    self.find_unit_mut(s, u_id).unwrap().ore_ti = None;
                }
            } else {
                self.find_unit_mut(s, u_id).unwrap().harvest_t = ht;
            }
            return;
        }
        if st == "return" {
            let (ux, uy) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.x, u.y) };
            let rb = self.side(s).buildings.iter().filter(|b| b.typ == "refinery" && !b.constructing)
                .min_by(|a, b| dist(ux, uy, a.x, a.y).partial_cmp(&dist(ux, uy, b.x, b.y)).unwrap()).cloned();
            let rb = match rb { Some(b) => b, None => { self.find_unit_mut(s, u_id).unwrap().state = "idle".into(); return; } };
            if dist(ux, uy, rb.x, rb.y) < (rb.w.max(rb.h) as f32) * TILE / 2.0 + 18.0 {
                let (kind, carrying) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.res_kind.unwrap_or("ore"), u.carrying) };
                {
                    let ss = self.side_mut(s);
                    if kind == "neutrino" { ss.neutrinos += carrying; } else { ss.credits += carrying * resource_value(kind); }
                }
                let u = self.find_unit_mut(s, u_id).unwrap();
                u.carrying = 0.0; u.state = "goto".into();
                return;
            }
            self.move_toward(u_id, rb.x, rb.y, dt);
            return;
        }
        if st == "goto" || st == "idle" {
            let ore_ti2 = { let u = self.find_unit_mut(s, u_id).unwrap(); u.ore_ti };
            let bad = match ore_ti2 { Some(t) => self.map.ore[t] <= 0, None => true };
            if bad {
                let (ux, uy) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.x, u.y) };
                match self.nearest_ore(ux, uy) {
                    Some(t) => {
                        let rk = self.map.res_kind[t];
                        let u = self.find_unit_mut(s, u_id).unwrap();
                        u.ore_ti = Some(t); u.res_kind = rk; u.state = "goto".into();
                    }
                    None => { self.find_unit_mut(s, u_id).unwrap().state = "idle".into(); return; }
                }
            }
            let (ti, ux, uy) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.ore_ti.unwrap(), u.x, u.y) };
            let cx = (ti % self.map.w) as f32 * TILE + TILE / 2.0;
            let cy = (ti / self.map.w) as f32 * TILE + TILE / 2.0;
            if self.move_toward(u_id, cx, cy, dt) {
                let u = self.find_unit_mut(s, u_id).unwrap();
                u.state = "mine".into(); u.harvest_t = 0.0;
            }
            return;
        }
        if st == "move" {
            let (tx, ty) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.tx, u.ty) };
            if self.move_toward(u_id, tx, ty, dt) { self.find_unit_mut(s, u_id).unwrap().state = "idle".into(); }
        }
    }

    pub fn update_unit(&mut self, s: Side, u_id: u32, dt: f32) {
        {
            let u = self.find_unit_mut(s, u_id).unwrap();
            u.cd -= dt;
        }
        let typ = self.find_unit_mut(s, u_id).unwrap().typ.clone();
        if typ == "harvester" { self.update_harvester(s, u_id, dt); return; }
        let wpn = match self.unit_cfg(&typ).and_then(|c| c.weapon) {
            Some(w) => w,
            None => {
                let st = self.find_unit_mut(s, u_id).unwrap().state.clone();
                if st == "move" || st == "attackMove" {
                    let (tx, ty) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.tx, u.ty) };
                    if self.move_toward(u_id, tx, ty, dt) { self.find_unit_mut(s, u_id).unwrap().state = "idle".into(); }
                }
                return;
            }
        };
        let (ux, uy) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.x, u.y) };
        let jam = self.in_any_storm(ux, uy);
        let range_px = wpn.range * TILE * if jam { 0.5 } else { 1.0 };
        let tid0 = self.find_unit_mut(s, u_id).unwrap().target_id;
        let (t_side, t_id, t_is_unit) = tid0.and_then(|id| self.find_global(id)).unwrap_or((Side::Player, 0, true));
        let tpos: Option<(f32, f32, &'static str)> = if t_id > 0 {
            if t_is_unit {
                self.side(t_side).units.iter().find(|u| u.id == t_id).map(|u| (u.x, u.y, u.cls))
            } else {
                self.side(t_side).buildings.iter().find(|b| b.id == t_id).map(|b| (b.x, b.y, "building"))
            }
        } else { None };
        let t = match tpos { Some((x, y, cls)) if !(cls == "aircraft" && !wpn.anti_air) => Some((x, y)), _ => None };
        let (st, tx, ty) = { let u = self.find_unit_mut(s, u_id).unwrap(); (u.state.clone(), u.tx, u.ty) };
        if let Some((txp, typ2)) = t {
            if dist(ux, uy, txp, typ2) <= range_px {
                let fire = !(jam && self.rng() < JAM_CHANCE);
                let plasma = self.side(s).research.contains("plasma");
                let (mutated, src) = {
                    let u = self.find_unit_mut(s, u_id).unwrap();
                    (u.mutated, u.typ.clone())
                };
                let mut fire_now = false;
                {
                    let u = self.find_unit_mut(s, u_id).unwrap();
                    u.angle = (typ2 - uy).atan2(txp - ux);
                    u.state = "attack".into();
                    if u.cd <= 0.0 { u.cd = wpn.rate; fire_now = true; }
                }
                if fire_now && fire {
                    let dmg = wpn.dmg * if plasma { 1.35 } else { 1.0 } * if mutated { MUTATE_DMG_MULT } else { 1.0 };
                    self.projectiles.push(Projectile { x: ux, y: uy, tx: txp, ty: typ2, tid: Some(t_id), src, dmg, speed: wpn.speed * TILE, side: s });
                }
                return;
            }
        }
        let goal = if t.is_some() && st == "attack" { t.unwrap() } else { (tx, ty) };
        let moving = st == "move" || st == "attackMove" || st == "attack";
        if moving && dist(ux, uy, goal.0, goal.1) > 6.0 {
            self.move_toward(u_id, goal.0, goal.1, dt);
            if st == "attackMove" {
                let acq = self.acquire_unit(ux, uy, s, &typ, &wpn, range_px);
                if let Some((_, aid, _)) = acq {
                    let u3 = self.find_unit_mut(s, u_id).unwrap();
                    u3.target_id = Some(aid); u3.state = "attack".into();
                }
            }
        } else {
            let acq = self.acquire_unit(ux, uy, s, &typ, &wpn, range_px);
            let u3 = self.find_unit_mut(s, u_id).unwrap();
            if let Some((_, aid, _)) = acq { u3.target_id = Some(aid); u3.state = "attack".into(); }
            else { u3.state = "idle".into(); u3.target_id = None; }
        }
    }

    pub fn tick(&mut self, dt: f32) {
        self.time += dt;
        for sk in [Side::Player, Side::Enemy] {
            if self.side(sk).research.contains("solar") {
                let c = self.side(sk).credits + SOLAR_INCOME * dt;
                self.side_mut(sk).credits = c;
            }
            self.update_power(sk);
        }
        for sk in [Side::Player, Side::Enemy] {
            let ids: Vec<u32> = self.side(sk).buildings.iter().map(|b| b.id).collect();
            for id in ids { self.update_building(sk, id, dt); }
        }
        for sk in [Side::Player, Side::Enemy] {
            let ids: Vec<u32> = self.side(sk).units.iter().map(|u| u.id).collect();
            for id in ids { self.update_unit(sk, id, dt); }
        }
        let mut i = 0;
        while i < self.projectiles.len() {
            let p = self.projectiles[i].clone();
            let t = p.tid.and_then(|id| self.find_global(id));
            let (tx, ty) = match t {
                Some((ts, _, true)) => self.side(ts).units.iter().find(|u| Some(u.id) == p.tid).map(|u| (u.x, u.y)).unwrap_or((p.tx, p.ty)),
                Some((ts, _, false)) => self.side(ts).buildings.iter().find(|b| Some(b.id) == p.tid).map(|b| (b.x, b.y)).unwrap_or((p.tx, p.ty)),
                None => (p.tx, p.ty),
            };
            let d = dist(p.x, p.y, tx, ty);
            let step = p.speed * dt;
            if d <= step.max(6.0) {
                if let Some((ts, tid, is_u)) = t { self.damage(ts, tid, is_u, p.dmg, &p.src); }
                self.projectiles.remove(i);
            } else {
                let np = Projectile { x: p.x + (tx - p.x) / d * step, y: p.y + (ty - p.y) / d * step, ..p };
                self.projectiles[i] = np;
                i += 1;
            }
        }
        let mut i = 0;
        while i < self.missiles.len() {
            let m = self.missiles[i].clone();
            let t = m.t + dt;
            let f = (t / m.dur).min(1.0);
            if f >= 1.0 {
                let mut sup = super_cfg(&m.kind).unwrap();
                let mut anti = false;
                if m.kind == "hbomb" && self.side(m.side).research.contains("antimatter") {
                    sup.radius = ANTI_HBOMB_RADIUS; sup.dmg = ANTI_HBOMB_DMG; anti = true;
                }
                let (r, dmg) = (sup.radius, sup.dmg);
                self.explode(m.tx, m.ty, r, dmg, m.side, &m.kind, anti);
                self.missiles.remove(i);
            } else {
                self.missiles[i].t = t;
                i += 1;
            }
        }
        let storm_dps = super_cfg("storm").unwrap().dps;
        let mut i = 0;
        while i < self.storms.len() {
            let sm = self.storms[i].clone();
            let left = sm.left - dt;
            let mut acc = sm.acc + dt;
            let mut hits: Vec<(Side, u32, bool, f32)> = Vec::new();
            while acc >= 0.25 {
                acc -= 0.25;
                let other = sm.side.other();
                for u in &self.side(other).units {
                    if dist(u.x, u.y, sm.x, sm.y) <= sm.r { hits.push((other, u.id, true, storm_dps * 0.25)); }
                }
                for b in &self.side(other).buildings {
                    if dist(b.x, b.y, sm.x, sm.y) <= sm.r { hits.push((other, b.id, false, storm_dps * 0.25 * 0.6)); }
                }
            }
            for (os, id, is_u, dmg) in hits {
                if is_u {
                    let mutated = self.find_unit_mut(os, id).map(|u| u.mutated).unwrap_or(false);
                    let cls = self.find_unit_mut(os, id).map(|u| u.cls).unwrap_or("infantry");
                    if cls != "aircraft" && !mutated && self.rng() < MUTATE_CHANCE {
                        let u = self.find_unit_mut(os, id).unwrap();
                        u.mutated = true; u.max_hp *= 1.3; u.hp = u.max_hp;
                    }
                }
                self.damage(os, id, is_u, dmg, "storm");
                if !is_u {
                    if let Some(b) = self.find_building_mut(os, id) { b.irradiated = RADIATED_TIME; }
                }
            }
            self.storms[i].left = left; self.storms[i].acc = acc;
            if left <= 0.0 { self.storms.remove(i); } else { i += 1; }
        }
        for i in (0..self.singularities.len()).rev() {
            let sg = self.singularities[i].clone();
            let mut pulls: Vec<(Side, u32)> = Vec::new();
            for sk in [Side::Player, Side::Enemy] {
                for u in &self.side(sk).units {
                    let d = dist(u.x, u.y, sg.x, sg.y);
                    if d < sg.r { pulls.push((sk, u.id)); }
                }
            }
            for (sk, id) in pulls {
                let d = { let u = self.find_unit_mut(sk, id).unwrap(); dist(u.x, u.y, sg.x, sg.y) };
                if d < sg.core { self.damage(sk, id, true, 1e9, "quark"); continue; }
                if d < sg.r {
                    let aircraft = self.find_unit_mut(sk, id).unwrap().cls == "aircraft";
                    let pull = (1.0 - d / sg.r) * SING_PULL_FORCE * if aircraft { 0.5 } else { 1.0 } * dt;
                    let u = self.find_unit_mut(sk, id).unwrap();
                    u.x += (sg.x - u.x) / d * pull;
                    u.y += (sg.y - u.y) / d * pull;
                }
            }
        }
        let diffuser_ids: Vec<(Side, u32)> = [Side::Player, Side::Enemy].iter()
            .flat_map(|&sk| self.side(sk).buildings.iter().filter(|b| b.typ == "diffuser" && !b.constructing && !b.offline).map(move |b| (sk, b.id)))
            .collect();
        for (sk, id) in diffuser_ids {
            let (bx, by) = { let b = self.find_building(sk, id).unwrap(); (b.x, b.y) };
            let aura = building_cfg("diffuser").unwrap().aura;
            let mut i = self.singularities.len();
            while i > 0 {
                i -= 1;
                let sg = &mut self.singularities[i];
                if dist(sg.x, sg.y, bx, by) <= aura {
                    sg.exposure += dt;
                    if sg.exposure >= DIFFUSER_KILL_TIME {
                        self.singularities.remove(i);
                        self.events.push("Nano-Schwarzes Loch von Diffusormatrix annihiliert!".to_string());
                    }
                }
            }
        }
        let mut i = self.beams.len();
        while i > 0 { i -= 1; self.beams[i].left -= dt; if self.beams[i].left <= 0.0 { self.beams.remove(i); } }
    }
}
