//! Karte: Generierung (Gras/Fels/Ressourcen/Wasser-Schluchten), deterministisch per Seed.

use crate::cfg::*;

pub struct Map {
    pub w: usize, pub h: usize,
    pub tiles: Vec<u8>, pub ore: Vec<i32>, pub res_kind: Vec<Option<&'static str>>,
    pub ore_tiles: Vec<usize>, pub shade: Vec<f32>,
}

impl Map {
    pub fn gen(seed: u32) -> Map {
        let mut rng = mulberry32(seed);
        let w = MAP_W; let h = MAP_H;
        let mut tiles = vec![0u8; w * h];
        let mut ore = vec![0i32; w * h];
        let mut res_kind = vec![None; w * h];
        let shade: Vec<f32> = (0..w * h).map(|_| 0.9 + rng() * 0.2).collect();
        let mut ore_tiles = Vec::new();
        let in_b = |x: i32, y: i32| x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h;
        let ti = |x: usize, y: usize| y * w + x;
        let phq = (5i32, h as i32 - 8); let ehq = (w as i32 - 8, 4i32);
        for _ in 0..16 {
            let mut cx = 2 + (rng() * (w - 4) as f32) as i32;
            let mut cy = 2 + (rng() * (h - 4) as f32) as i32;
            if ((cx - phq.0) as f32).hypot((cy - phq.1) as f32) < 8.0 || ((cx - ehq.0) as f32).hypot((cy - ehq.1) as f32) < 8.0 { continue; }
            let n = 2 + (rng() * 4.0) as i32;
            for _ in 0..n {
                if in_b(cx, cy) { tiles[ti(cx as usize, cy as usize)] = 1; }
                cx += (rng() * 3.0) as i32 - 1; cy += (rng() * 3.0) as i32 - 1;
            }
        }
        for y in 0..h as i32 {
            let wx = ((w as f32 / 2.0) + 3.0 * (y as f32 * 0.35).sin() + (rng() - 0.5) * 2.0).round() as i32;
            for dx in -1..=1 { if in_b(wx + dx, y) { tiles[ti((wx + dx) as usize, y as usize)] = 3; } }
        }
        for _ in 0..2 {
            let cx = 6 + (rng() * (w - 12) as f32) as i32;
            let cy = 6 + (rng() * (h - 12) as f32) as i32;
            for ly in 0..2 { for lx in 0..2 { if in_b(cx + lx, cy + ly) { tiles[ti((cx + lx) as usize, (cy + ly) as usize)] = 3; } } }
        }
        let clear = |tiles: &mut Vec<u8>, ccx: i32, ccy: i32, r: i32| {
            for dy in -r..=r { for dx in -r..=r { let x = ccx + dx; let y = ccy + dy; if in_b(x, y) { tiles[ti(x as usize, y as usize)] = 0; } } }
        };
        clear(&mut tiles, phq.0 + 1, phq.1 + 1, 7);
        clear(&mut tiles, ehq.0 + 1, ehq.1 + 1, 7);
        let hw = w / 2; let hh = h / 2;
        let clusters: [(&str, i32, i32, usize, usize); 18] = [
            ("ore", 11, h as i32 - 13, 3, 3), ("ore", w as i32 - 17, h as i32 - 13, 3, 3), ("ore", hw as i32 - 9, hh as i32 + 7, 3, 3),
            ("ore", hw as i32 + 9, hh as i32 - 7, 3, 3), ("ore", hw as i32 - 6, hh as i32 - 9, 3, 3),
            ("co2", hw as i32 + 4, hh as i32 + 8, 3, 3), ("co2", hw as i32 - 12, hh as i32, 2, 2), ("co2", 16, hh as i32 + 10, 2, 2),
            ("h1", hw as i32 + 12, hh as i32 + 6, 3, 3), ("h1", 20, h as i32 - 16, 2, 2),
            ("h2", hw as i32 - 4, hh as i32 - 10, 2, 2), ("h2", w as i32 - 20, hh as i32, 2, 2),
            ("h3", hw as i32 - 16, hh as i32 + 13, 2, 2),
            ("neutrino", w as i32 - 13, 12, 3, 3), ("neutrino", hw as i32 + 7, hh as i32 - 8, 2, 2),
            ("ore", hw as i32 - 14, hh as i32 + 12, 2, 2), ("co2", hw as i32 + 14, hh as i32 - 12, 2, 2), ("ore", 8, 10, 2, 2),
        ];
        for (kind, cx0, cy0, cw, ch) in clusters {
            for ry in 0..ch { for rx in 0..cw {
                let x = cx0 + rx as i32; let y = cy0 + ry as i32;
                if !in_b(x, y) { continue; }
                let t = ti(x as usize, y as usize);
                if tiles[t] == 3 { continue; }
                tiles[t] = 2;
                res_kind[t] = Some(kind);
                ore[t] = 400 + (rng() * 300.0) as i32;
                ore_tiles.push(t);
            } }
        }
        Map { w, h, tiles, ore, res_kind, ore_tiles, shade }
    }
    pub fn in_b(&self, x: i32, y: i32) -> bool { x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h }
    pub fn ti(&self, x: usize, y: usize) -> usize { y * self.w + x }
}
