//! Konfiguration & Balance-Daten (eigenständig).

pub const TILE: f32 = 32.0;
pub const MAP_W: usize = 48;
pub const MAP_H: usize = 36;
pub const START_CREDITS: f32 = 4000.0;
pub const START_NEUTRINOS: f32 = 150.0;
pub const HARVEST_AMOUNT: f32 = 25.0;
pub const HARVEST_TIME: f32 = 2.0;
pub const SOLAR_INCOME: f32 = 12.0;
pub const NEUTRINO_MOVE_COST: f32 = 0.03;
pub const CROSS_COST: f32 = 1200.0;
pub const CROSS_TIME: f32 = 25.0;
pub const RADIATION_BUILDING_DOT: f32 = 2.5;
pub const RADIATED_TIME: f32 = 30.0;
pub const MUTATE_CHANCE: f32 = 0.02;
pub const MUTATE_DMG_MULT: f32 = 1.5;
pub const JAM_CHANCE: f32 = 0.4;
pub const SING_COUNT: usize = 6;
pub const SING_PULL_RADIUS: f32 = 6.0;
pub const SING_CORE: f32 = 0.9;
pub const SING_PULL_FORCE: f32 = 140.0;
pub const DIFFUSER_KILL_TIME: f32 = 3.0;
pub const ANTI_HBOMB_RADIUS: f32 = 8.0;
pub const ANTI_HBOMB_DMG: f32 = 2200.0;

pub fn mulberry32(mut a: u32) -> impl FnMut() -> f32 {
    move || {
        a = a.wrapping_add(0x6D2B79F5);
        let mut t = a.wrapping_mul(1 | a);
        t = (t ^ (t >> 7)).wrapping_mul(61 | t) ^ t;
        ((t ^ (t >> 14)) >> 0) as f32 / 4294967296.0
    }
}

pub fn dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 { ((x2 - x1).powi(2) + (y2 - y1).powi(2)).sqrt() }
pub fn clamp(v: f32, a: f32, b: f32) -> f32 { v.max(a).min(b) }

pub fn dist_to_segment(px: f32, py: f32, x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    let dx = x2 - x1; let dy = y2 - y1;
    let l2 = dx * dx + dy * dy;
    if l2 == 0.0 { return dist(px, py, x1, y1); }
    let t = (((px - x1) * dx + (py - y1) * dy) / l2).clamp(0.0, 1.0);
    dist(px, py, x1 + t * dx, y1 + t * dy)
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Side { Player, Enemy }
impl Side {
    pub fn other(self) -> Side { match self { Side::Player => Side::Enemy, Side::Enemy => Side::Player } }
    pub fn idx(self) -> usize { match self { Side::Player => 0, Side::Enemy => 1 } }
    pub fn from_idx(i: usize) -> Side { if i == 0 { Side::Player } else { Side::Enemy } }
}

#[derive(Clone, Copy)]
pub struct WeaponCfg { pub range: f32, pub dmg: f32, pub rate: f32, pub speed: f32, pub anti_air: bool }

#[derive(Clone)]
pub struct UnitCfg {
    pub name: String, pub cost: f32, pub hp: f32, pub speed: f32, pub time: f32,
    pub prod: &'static str, pub cls: &'static str, pub faction: Option<&'static str>,
    pub req: Option<&'static str>, pub hero: bool, pub weapon: Option<WeaponCfg>,
}

pub fn unit_cfg_static(key: &str) -> Option<UnitCfg> {
    let w = |range: f32, dmg: f32, rate: f32, speed: f32, aa: bool| Some(WeaponCfg { range, dmg, rate, speed, anti_air: aa });
    let u = |name: &str, cost: f32, hp: f32, speed: f32, time: f32, prod: &'static str, cls: &'static str, fac: Option<&'static str>, req: Option<&'static str>, hero: bool, weapon: Option<WeaponCfg>| UnitCfg {
        name: name.to_string(), cost, hp, speed, time, prod, cls, faction: fac, req, hero, weapon,
    };
    Some(match key {
        "harvester" => u("Sammler", 600.0, 650.0, 2.1, 12.0, "factory", "vehicle", None, None, false, None),
        "infantry" => u("Soldat", 100.0, 80.0, 3.0, 6.0, "barracks", "infantry", Some("human"), Some("barracks"), false, w(4.5, 9.0, 1.0, 14.0, false)),
        "rocket" => u("Raketenwerfer", 300.0, 60.0, 2.6, 12.0, "barracks", "infantry", Some("human"), Some("tech"), false, w(6.0, 28.0, 2.2, 9.0, true)),
        "marina" => u("Kommandantin Marina", 2000.0, 320.0, 3.2, 25.0, "barracks", "infantry", Some("human"), Some("tech"), true, w(5.0, 20.0, 0.5, 14.0, false)),
        "tank" => u("Panzer", 800.0, 430.0, 2.0, 18.0, "factory", "vehicle", Some("human"), Some("factory"), false, w(5.0, 34.0, 1.6, 8.0, false)),
        "koloss" => u("Panzerheld Kimberly", 3000.0, 1300.0, 1.6, 35.0, "factory", "vehicle", Some("human"), Some("tech"), true, w(6.0, 70.0, 2.2, 8.0, false)),
        "vulkan" => u("Raketenheld Tesla", 2200.0, 700.0, 2.0, 30.0, "factory", "vehicle", Some("human"), Some("tech"), true, w(6.5, 55.0, 1.8, 9.0, true)),
        "jet" => u("Abfangjäger Strahl", 1000.0, 260.0, 4.2, 20.0, "airfield", "aircraft", Some("human"), Some("airfield"), false, w(5.5, 24.0, 1.2, 11.0, true)),
        "falke" => u("Luftheld DVA", 3500.0, 600.0, 4.6, 35.0, "airfield", "aircraft", Some("human"), Some("tech"), true, w(6.0, 40.0, 0.9, 12.0, true)),
        "larve" => u("Schattenbrut", 80.0, 60.0, 3.4, 5.0, "barracks", "infantry", Some("alien"), Some("barracks"), false, w(1.8, 12.0, 0.8, 12.0, false)),
        "spitter" => u("Lichtling", 250.0, 70.0, 2.6, 10.0, "barracks", "infantry", Some("alien"), Some("tech"), false, w(5.5, 20.0, 1.8, 9.0, false)),
        "carapax" => u("Aegis-Drohne", 900.0, 520.0, 1.8, 20.0, "factory", "vehicle", Some("alien"), Some("factory"), false, w(5.0, 38.0, 1.8, 8.0, false)),
        "wespe" => u("Gleiter", 900.0, 200.0, 4.4, 18.0, "airfield", "aircraft", Some("alien"), Some("airfield"), false, w(5.0, 22.0, 1.2, 11.0, true)),
        _ => return None,
    })
}

#[derive(Clone, Copy)]
pub struct BuildingCfg {
    pub name: &'static str, pub cost: f32, pub hp: f32, pub size: usize, pub time: f32,
    pub power: i32, pub req: Option<&'static str>, pub faction: Option<&'static str>, pub aura: f32,
}

pub fn building_cfg(key: &str) -> Option<BuildingCfg> {
    Some(match key {
        "hq" => BuildingCfg { name: "Kommandozentrale", cost: 0.0, hp: 3200.0, size: 4, time: 0.0, power: -20, req: None, faction: None, aura: 0.0 },
        "plant" => BuildingCfg { name: "Kraftwerk", cost: 400.0, hp: 700.0, size: 2, time: 8.0, power: 100, req: None, faction: None, aura: 0.0 },
        "solar" => BuildingCfg { name: "Solarpanel", cost: 300.0, hp: 500.0, size: 2, time: 6.0, power: 40, req: None, faction: Some("human"), aura: 0.0 },
        "wind" => BuildingCfg { name: "Windrad", cost: 500.0, hp: 600.0, size: 2, time: 8.0, power: 70, req: None, faction: Some("human"), aura: 0.0 },
        "hydro" => BuildingCfg { name: "Wasserkraftwerk", cost: 1200.0, hp: 1100.0, size: 3, time: 14.0, power: 300, req: None, faction: Some("human"), aura: 0.0 },
        "reactor" => BuildingCfg { name: "Kernreaktor", cost: 2000.0, hp: 1400.0, size: 3, time: 20.0, power: 500, req: Some("tech"), faction: Some("human"), aura: 0.0 },
        "fusion" => BuildingCfg { name: "Fusionsreaktor", cost: 4000.0, hp: 1800.0, size: 4, time: 30.0, power: 1200, req: Some("reactor"), faction: Some("human"), aura: 0.0 },
        "nemitter" => BuildingCfg { name: "Neutrino-Emitter", cost: 400.0, hp: 600.0, size: 2, time: 8.0, power: 120, req: None, faction: Some("alien"), aura: 0.0 },
        "tachreg" => BuildingCfg { name: "Tachyonen-Regenerator", cost: 900.0, hp: 800.0, size: 2, time: 12.0, power: 250, req: Some("tech"), faction: Some("alien"), aura: 0.0 },
        "qts" => BuildingCfg { name: "Quantentachyonenspalt", cost: 2500.0, hp: 1400.0, size: 3, time: 22.0, power: 800, req: Some("tech"), faction: Some("alien"), aura: 0.0 },
        "refinery" => BuildingCfg { name: "Raffinerie", cost: 800.0, hp: 1200.0, size: 3, time: 12.0, power: -10, req: None, faction: None, aura: 0.0 },
        "barracks" => BuildingCfg { name: "Kaserne", cost: 500.0, hp: 1000.0, size: 3, time: 10.0, power: -10, req: None, faction: None, aura: 0.0 },
        "factory" => BuildingCfg { name: "Fabrik", cost: 1200.0, hp: 1500.0, size: 3, time: 15.0, power: -20, req: None, faction: None, aura: 0.0 },
        "airfield" => BuildingCfg { name: "Flugplatz", cost: 1500.0, hp: 1400.0, size: 3, time: 18.0, power: -20, req: Some("factory"), faction: None, aura: 0.0 },
        "tech" => BuildingCfg { name: "Tech-Zentrum", cost: 1500.0, hp: 1600.0, size: 3, time: 20.0, power: -30, req: None, faction: None, aura: 0.0 },
        "silo" => BuildingCfg { name: "Nukleararsenal", cost: 2500.0, hp: 1800.0, size: 4, time: 25.0, power: -40, req: Some("tech"), faction: Some("human"), aura: 0.0 },
        "turret" => BuildingCfg { name: "Geschützturm", cost: 600.0, hp: 900.0, size: 2, time: 8.0, power: -10, req: None, faction: None, aura: 0.0 },
        "sam" => BuildingCfg { name: "SAM-Stellung", cost: 900.0, hp: 850.0, size: 2, time: 10.0, power: -15, req: Some("tech"), faction: None, aura: 0.0 },
        "weather" => BuildingCfg { name: "Wetterkontrollstation", cost: 2200.0, hp: 1500.0, size: 3, time: 22.0, power: -30, req: Some("tech"), faction: Some("alien"), aura: 0.0 },
        "lab" => BuildingCfg { name: "Kreuzungslabor", cost: 1800.0, hp: 1300.0, size: 3, time: 20.0, power: -25, req: Some("tech"), faction: Some("alien"), aura: 0.0 },
        "diffuser" => BuildingCfg { name: "Diffusormatrix", cost: 1500.0, hp: 900.0, size: 2, time: 15.0, power: -20, req: Some("tech"), faction: Some("human"), aura: 5.0 * TILE },
        _ => return None,
    })
}

pub fn building_weapon(key: &str) -> Option<WeaponCfg> {
    match key {
        "turret" => Some(WeaponCfg { range: 5.5, dmg: 22.0, rate: 0.9, speed: 11.0, anti_air: false }),
        "sam" => Some(WeaponCfg { range: 8.0, dmg: 45.0, rate: 1.4, speed: 11.0, anti_air: true }),
        "diffuser" => Some(WeaponCfg { range: 6.0, dmg: 30.0, rate: 1.2, speed: 11.0, anti_air: true }),
        _ => None,
    }
}

#[derive(Clone, Copy)]
pub struct ResearchCfg { pub name: &'static str, pub cost: f32, pub time: f32, pub req: Option<&'static str>, pub faction: Option<&'static str> }

pub fn research_cfg(key: &str) -> Option<ResearchCfg> {
    Some(match key {
        "plasma" => ResearchCfg { name: "Plasma-Waffen", cost: 1500.0, time: 25.0, req: None, faction: None },
        "armor" => ResearchCfg { name: "Verbundpanzerung", cost: 1200.0, time: 20.0, req: None, faction: None },
        "fastbuild" => ResearchCfg { name: "Schnellfertigung", cost: 1500.0, time: 25.0, req: None, faction: None },
        "solar" => ResearchCfg { name: "Solarsatellit", cost: 2000.0, time: 30.0, req: None, faction: Some("alien") },
        "hbomb" => ResearchCfg { name: "H-Bombe", cost: 3000.0, time: 40.0, req: Some("silo"), faction: Some("human") },
        "weather" => ResearchCfg { name: "Wetterkontrolle", cost: 1500.0, time: 30.0, req: Some("weather"), faction: Some("alien") },
        "npulse" => ResearchCfg { name: "Neutronen-Pulsstrahl", cost: 2000.0, time: 35.0, req: Some("weather"), faction: Some("alien") },
        "quark" => ResearchCfg { name: "Quarkbosonspalten", cost: 2500.0, time: 40.0, req: None, faction: Some("alien") },
        "diffuser" => ResearchCfg { name: "Diffusormatrix-Forschung", cost: 2000.0, time: 30.0, req: Some("tech"), faction: Some("human") },
        "antimatter" => ResearchCfg { name: "Antimaterie-Sprengkopf", cost: 2500.0, time: 35.0, req: Some("silo"), faction: Some("human") },
        _ => return None,
    })
}

#[derive(Clone, Copy)]
pub struct SuperCfg { pub name: &'static str, pub charge: f32, pub radius: f32, pub dmg: f32, pub missile: f32, pub holder: &'static str, pub beam: bool, pub width: f32, pub dps: f32, pub duration: f32 }

pub fn super_cfg(key: &str) -> Option<SuperCfg> {
    Some(match key {
        "nuke" => SuperCfg { name: "Nuklearrakete", charge: 75.0, radius: 3.5, dmg: 700.0, missile: 3.0, holder: "silo", beam: false, width: 0.0, dps: 0.0, duration: 0.0 },
        "hbomb" => SuperCfg { name: "H-Bombe", charge: 150.0, radius: 6.0, dmg: 1500.0, missile: 4.0, holder: "silo", beam: false, width: 0.0, dps: 0.0, duration: 0.0 },
        "storm" => SuperCfg { name: "Blitzsturm (radioaktiv)", charge: 90.0, radius: 4.0, dmg: 0.0, missile: 0.0, holder: "weather", beam: false, width: 0.0, dps: 110.0, duration: 10.0 },
        "npulse" => SuperCfg { name: "Neutronen-Pulsstrahl", charge: 60.0, radius: 0.0, dmg: 900.0, missile: 0.0, holder: "weather", beam: true, width: 2.5, dps: 0.0, duration: 0.0 },
        _ => return None,
    })
}

pub fn super_holder(t: &str) -> Option<&'static str> {
    for k in ["nuke", "hbomb", "storm", "npulse"] { if let Some(s) = super_cfg(k) { if s.holder == t { return Some(k); } } }
    None
}

pub fn resource_value(kind: &str) -> f32 {
    match kind { "ore" | "co2" => 1.0, "h1" => 2.0, "h2" => 4.0, "h3" => 8.0, _ => 0.0 }
}

pub fn dmg_vs(src: &str, cls: &str) -> f32 {
    let key = if let Some(rest) = src.strip_prefix("hyb_") { rest.split('_').next().unwrap_or(src) } else { src };
    let m = |i: f32, v: f32, b: f32, a: f32| match cls { "infantry" => i, "vehicle" => v, "building" => b, "aircraft" => a, _ => 1.0 };
    match key {
        "infantry" => m(1.0, 0.5, 0.6, 0.0),
        "rocket" => m(0.8, 1.5, 2.0, 1.0),
        "tank" => m(1.2, 1.0, 1.0, 0.0),
        "jet" => m(0.8, 1.0, 1.2, 1.2),
        "marina" => m(1.6, 0.7, 0.8, 0.0),
        "koloss" => m(1.3, 1.1, 1.2, 0.0),
        "vulkan" => m(0.9, 1.6, 2.0, 1.0),
        "falke" => m(1.0, 1.2, 1.2, 1.4),
        "larve" => m(1.4, 0.7, 0.9, 0.0),
        "spitter" => m(1.0, 1.0, 1.3, 0.0),
        "carapax" => m(1.2, 1.1, 1.3, 0.0),
        "wespe" => m(1.0, 1.1, 1.0, 1.0),
        "turret" => m(1.0, 0.8, 0.0, 0.0),
        "sam" => m(1.2, 1.2, 0.0, 1.6),
        "storm" | "npulse" | "quark" => m(1.0, 1.0, 1.0, 1.0),
        "diffuser" => m(1.0, 1.0, 0.8, 1.2),
        _ => 1.0,
    }
}
