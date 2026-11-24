var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.core = {
  state: null,
  rng: null,

  newSide: function (name) {
    return {
      name: name, faction: LW.cfg.sides[name], credits: LW.cfg.startCredits,
      neutrinos: name === 'enemy' ? LW.cfg.startNeutrinos : 0,
      research: {}, buildings: [], units: [], powerSupply: 0, powerDemand: 0,
    };
  },

  init: function (seed) {
    var cfg = LW.cfg;
    LW.map.gen(seed);
    this.rng = LW.util.mulberry32((seed ^ 0x9e3779b9) >>> 0);
    var st = this.state = {
      seed: seed, time: 0, tick: 0, over: null, shake: 0, nextId: 1,
      occ: new Int32Array(LW.map.W * LW.map.H),
      projectiles: [], missiles: [], storms: [], particles: [], decals: [], events: [],
      aiTimer: 0, aiNextWave: cfg.ai.waveStart,
      sides: { player: this.newSide('player'), enemy: this.newSide('enemy') },
    };
    var hqP = this.placeBuildingRaw('player', 'hq', 4, LW.map.H - 8);
    var hqE = this.placeBuildingRaw('enemy', 'hq', LW.map.W - 8, 4);
    var spot = this.findSpot(2, 2, hqP.x, hqP.y, 9);
    if (spot) this.placeBuildingRaw('player', 'plant', spot.tx, spot.ty);
    spot = this.findSpot(2, 2, hqE.x, hqE.y, 9);
    if (spot) this.placeBuildingRaw('enemy', 'plant', spot.tx, spot.ty);
    var oreP = this.nearestOre(hqP.x, hqP.y), oreE = this.nearestOre(hqE.x, hqE.y), s2;
    if (oreP >= 0) { s2 = this.findSpot(3, 3, (oreP % LW.map.W + 0.5) * cfg.tile, (Math.floor(oreP / LW.map.W) + 0.5) * cfg.tile, 7); if (s2) this.placeBuildingRaw('player', 'refinery', s2.tx, s2.ty); }
    if (oreE >= 0) { s2 = this.findSpot(3, 3, (oreE % LW.map.W + 0.5) * cfg.tile, (Math.floor(oreE / LW.map.W) + 0.5) * cfg.tile, 7); if (s2) this.placeBuildingRaw('enemy', 'refinery', s2.tx, s2.ty); }
    var i, u;
    for (i = 0; i < 2; i++) { u = this.spawnNearBuilding(hqP, 'harvester'); if (u) { u.state = 'idle'; } }
    for (i = 0; i < 4; i++) this.spawnNearBuilding(hqP, 'infantry');
    for (i = 0; i < 2; i++) this.spawnNearBuilding(hqE, 'harvester');
    for (i = 0; i < 4; i++) this.spawnNearBuilding(hqE, 'larve');
    this.pushEvent('Willkommen bei LASTWAR. Bauen Sie Ihre Basis auf und verteidigen Sie die Kommandozentrale.', 'good');
  },

  otherSide: function (side) { return side === 'player' ? 'enemy' : 'player'; },

  findBuilding: function (side, id) {
    var arr = this.state.sides[side].buildings;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  },

  findGlobal: function (id) {
    var sk, arr, i;
    for (sk in this.state.sides) {
      arr = this.state.sides[sk].units;
      for (i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
      arr = this.state.sides[sk].buildings;
      for (i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    }
    return null;
  },

  hasAny: function (side, type) {
    var arr = this.state.sides[side].buildings;
    for (var i = 0; i < arr.length; i++) if (arr[i].type === type) return true;
    return false;
  },

  hasCompleted: function (side, type) {
    var arr = this.state.sides[side].buildings;
    for (var i = 0; i < arr.length; i++) if (arr[i].type === type && !arr[i].constructing) return true;
    return false;
  },

  holderOf: function (buildingType) {
    for (var k in LW.cfg.super) if (LW.cfg.super[k].holder === buildingType) return k;
    return null;
  },

  canBuild: function (side, key) {
    var cfg = LW.cfg, b = cfg.buildings[key], s = this.state.sides[side];
    if (!b) return { ok: false, reason: 'Unbekanntes Gebäude' };
    if (key === 'hq') return { ok: false, reason: 'Nicht baubar' };
    if (b.faction && b.faction !== s.faction) return { ok: false, reason: 'Nur für ' + cfg.factions[b.faction].name };
    if (b.req && !this.hasCompleted(side, b.req)) return { ok: false, reason: 'Benötigt ' + cfg.buildings[b.req].name };
    return { ok: true };
  },

  rectFree: function (tx, ty, w, h) {
    var map = LW.map, st = this.state;
    for (var dy = 0; dy < h; dy++) for (var dx = 0; dx < w; dx++) {
      var x = tx + dx, y = ty + dy;
      if (!map.inB(x, y)) return false;
      var ti = map.ti(x, y);
      if (map.tiles[ti] !== 0) return false;
      if (st.occ[ti] !== 0) return false;
    }
    return true;
  },

  canPlaceAt: function (side, key, tx, ty) {
    var cb = this.canBuild(side, key);
    if (!cb.ok) return cb;
    var b = LW.cfg.buildings[key];
    if (!this.rectFree(tx, ty, b.size, b.size)) return { ok: false, reason: 'Gelände blockiert' };
    if (key === 'hydro' && !this.adjacentWater(tx, ty, b.size)) return { ok: false, reason: 'Benötigt Schlucht (Wasser) in der Nähe' };
    return { ok: true };
  },

  adjacentWater: function (tx, ty, size) {
    var map = LW.map;
    for (var dy = -1; dy <= size; dy++) for (var dx = -1; dx <= size; dx++) {
      if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;
      var x = tx + dx, y = ty + dy;
      if (map.inB(x, y) && map.tiles[map.ti(x, y)] === 3) return true;
    }
    return false;
  },

  findSpot: function (w, h, cx, cy, maxR) {
    var tile = LW.cfg.tile, cxt = Math.floor(cx / tile), cyt = Math.floor(cy / tile);
    var best = null, bd = Infinity;
    for (var dy = -maxR; dy <= maxR; dy++) for (var dx = -maxR; dx <= maxR; dx++) {
      var tx = cxt + dx, ty = cyt + dy;
      if (!this.rectFree(tx, ty, w, h)) continue;
      var d = LW.util.dist((tx + w / 2) * tile, (ty + h / 2) * tile, cx, cy);
      if (d < bd) { bd = d; best = { tx: tx, ty: ty }; }
    }
    return best;
  },

  placeBuildingRaw: function (side, key, tx, ty) {
    var cfg = LW.cfg, b = cfg.buildings[key], st = this.state, map = LW.map;
    var bd = {
      id: st.nextId++, side: side, type: key, tx: tx, ty: ty, w: b.size, h: b.size,
      x: (tx + b.size / 2) * cfg.tile, y: (ty + b.size / 2) * cfg.tile,
      hp: b.hp, maxHp: b.hp, constructing: b.time > 0, buildLeft: b.time,
      queue: [], rally: null, charge: 0, chargeMax: 0, superReady: false, superKey: null,
      cd: 0, angle: -Math.PI / 2, offline: false, irradiated: 0,
      weapon: cfg.buildingWeapons[key] || null,
    };
    for (var dy = 0; dy < bd.h; dy++) for (var dx = 0; dx < bd.w; dx++) st.occ[map.ti(tx + dx, ty + dy)] = bd.id;
    st.sides[side].buildings.push(bd);
    return bd;
  },

  placeBuilding: function (side, key, tx, ty) {
    var cfg = LW.cfg, s = this.state.sides[side];
    var cp = this.canPlaceAt(side, key, tx, ty);
    if (!cp.ok) return cp;
    var b = cfg.buildings[key];
    if (s.credits < b.cost) return { ok: false, reason: 'Zu wenig Credits' };
    s.credits -= b.cost;
    var bd = this.placeBuildingRaw(side, key, tx, ty);
    this.pushEvent(b.name + ' wird gebaut.', '');
    if (LW.audio) LW.audio.play('select');
    return { ok: true, building: bd };
  },

  spawnUnit: function (side, type, x, y) {
    var cfg = LW.cfg, uc = cfg.units[type], st = this.state;
    var u = {
      id: st.nextId++, side: side, type: type, cls: uc.cls, x: x, y: y,
      hp: uc.hp, maxHp: uc.hp, speed: uc.speed, state: 'idle', tx: x, ty: y,
      targetId: null, cd: 0, angle: 0, carrying: 0, harvestT: 0, oreTi: -1,
      mutated: false, hero: !!uc.hero,
    };
    st.sides[side].units.push(u);
    return u;
  },

  spawnNearBuilding: function (b, type) {
    var cfg = LW.cfg, tile = cfg.tile, uc = cfg.units[type];
    if (uc.cls === 'aircraft') {
      var ax = b.x, ay = Math.max(20, b.y - (b.h * tile) / 2 - 18);
      return this.spawnUnit(b.side, type, ax, ay);
    }
    for (var r = 1; r <= 6; r++) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        var tx = b.tx + b.w / 2 + dx, ty = b.ty + b.h / 2 + dy;
        var px = (tx + 0.5) * tile, py = (ty + 0.5) * tile;
        var dummy = { type: type };
        if (!this.posBlocked(px, py, dummy)) return this.spawnUnit(b.side, type, px, py);
      }
    }
    return null;
  },

  canProduce: function (side, key) {
    var cfg = LW.cfg, u = cfg.units[key], s = this.state.sides[side];
    if (!u) return { ok: false, reason: 'Unbekannt' };
    if (u.faction && u.faction !== s.faction) return { ok: false, reason: 'Nur für ' + cfg.factions[u.faction].name };
    if (u.req && !this.hasCompleted(side, u.req)) return { ok: false, reason: 'Benötigt ' + cfg.buildings[u.req].name };
    if (!this.hasCompleted(side, u.prod)) return { ok: false, reason: 'Benötigt ' + cfg.buildings[u.prod].name };
    return { ok: true };
  },

  queueUnit: function (side, bId, key) {
    var cfg = LW.cfg, st = this.state, s = st.sides[side];
    var b = this.findBuilding(side, bId);
    if (!b || b.constructing) return { ok: false, reason: 'Gebäude nicht fertig' };
    var uc = cfg.units[key];
    if (!uc) return { ok: false, reason: 'Unbekannte Einheit' };
    if (uc.prod !== b.type) return { ok: false, reason: 'Wird in ' + cfg.buildings[uc.prod].name + ' produziert' };
    var cp = this.canProduce(side, key);
    if (!cp.ok) return cp;
    if (s.credits < uc.cost) return { ok: false, reason: 'Zu wenig Credits' };
    if (b.queue.length >= 5) return { ok: false, reason: 'Warteschlange voll' };
    if (uc.hero && s.buildings.some(function (bb) { return bb.queue.some(function (q) { return q.kind === 'unit' && q.key === key; }); }) ||
        uc.hero && s.units.some(function (u) { return u.type === key; })) return { ok: false, reason: 'Held bereits im Einsatz' };
    s.credits -= uc.cost;
    b.queue.push({ kind: 'unit', key: key, left: uc.time, max: uc.time });
    return { ok: true };
  },

  canResearch: function (side, key) {
    var cfg = LW.cfg, r = cfg.research[key], s = this.state.sides[side];
    if (!r) return { ok: false, reason: 'Unbekannt' };
    if (r.faction && r.faction !== s.faction) return { ok: false, reason: 'Nur für ' + cfg.factions[r.faction].name };
    if (s.research[key]) return { ok: false, reason: 'Bereits erforscht' };
    if (r.req && !this.hasAny(side, r.req)) return { ok: false, reason: 'Benötigt ' + cfg.buildings[r.req].name };
    if (!this.hasCompleted(side, 'tech')) return { ok: false, reason: 'Benötigt Tech-Zentrum' };
    return { ok: true };
  },

  queueResearch: function (side, bId, key) {
    var cfg = LW.cfg, st = this.state, s = st.sides[side];
    var b = this.findBuilding(side, bId);
    if (!b || b.type !== 'tech' || b.constructing) return { ok: false, reason: 'Kein fertiges Tech-Zentrum' };
    var cr = this.canResearch(side, key);
    if (!cr.ok) return cr;
    if (b.queue.some(function (q) { return q.kind === 'research' && q.key === key; })) return { ok: false, reason: 'Bereits in Forschung' };
    var r = cfg.research[key];
    if (s.credits < r.cost) return { ok: false, reason: 'Zu wenig Credits' };
    if (b.queue.length >= 3) return { ok: false, reason: 'Warteschlange voll' };
    s.credits -= r.cost;
    b.queue.push({ kind: 'research', key: key, left: r.time, max: r.time });
    return { ok: true };
  },

  crossUnits: function (side, bId, a, b) {
    var cfg = LW.cfg, st = this.state, s = st.sides[side];
    var lab = this.findBuilding(side, bId);
    if (!lab || lab.type !== 'lab' || lab.constructing) return { ok: false, reason: 'Kein fertiges Kreuzungslabor' };
    if (s.faction !== 'alien') return { ok: false, reason: 'Nur für Aliens' };
    if (a === b) return { ok: false, reason: 'Zwei verschiedene Klassen wählen' };
    if (!cfg.units[a] || !cfg.units[b]) return { ok: false, reason: 'Unbekannte Klasse' };
    if (s.credits < cfg.cross.cost) return { ok: false, reason: 'Zu wenig Credits' };
    if (lab.queue.length >= 2) return { ok: false, reason: 'Labor ausgelastet' };
    s.credits -= cfg.cross.cost;
    lab.queue.push({ kind: 'cross', a: a, b: b, left: cfg.cross.time, max: cfg.cross.time });
    this.pushEvent('Kreuzung gestartet: ' + cfg.units[a].name + ' × ' + cfg.units[b].name, '');
    return { ok: true };
  },

  makeHybrid: function (side, lab, a, b) {
    var cfg = LW.cfg, A = cfg.units[a], B = cfg.units[b];
    var key = 'hyb_' + a + '_' + b;
    if (!cfg.units[key]) {
      var cls = (A.cls === 'aircraft' || B.cls === 'aircraft') ? 'aircraft' : (A.cls === 'vehicle' || B.cls === 'vehicle') ? 'vehicle' : 'infantry';
      var wa = A.weapon || { range: 3, dmg: 8, rate: 1.2, speed: 10, antiAir: false };
      var wb = B.weapon || wa;
      cfg.units[key] = {
        name: 'Hybrid ' + A.name + '×' + B.name, cost: 0, hp: Math.round(Math.max(A.hp, B.hp) * 1.2),
        speed: (A.speed + B.speed) / 2, time: 0, prod: 'lab', cls: cls, faction: 'alien', hybrid: [a, b],
        weapon: { range: Math.max(wa.range, wb.range), dmg: Math.round((wa.dmg + wb.dmg) / 2 * 1.4), rate: (wa.rate + wb.rate) / 2, speed: Math.max(wa.speed, wb.speed), antiAir: !!(wa.antiAir || wb.antiAir) },
      };
      cfg.dmgVs[key] = cfg.dmgVs[a] || { infantry: 1, vehicle: 1, building: 1, aircraft: 0 };
    }
    var u = this.spawnNearBuilding(lab, key);
    if (u && lab.rally) { u.state = 'move'; u.tx = lab.rally.x; u.ty = lab.rally.y; }
    this.pushEvent('Kreuzung fertig: ' + cfg.units[key].name, 'good');
    return u;
  },

  finishQueueItem: function (b, q) {
    var cfg = LW.cfg, st = this.state, s = st.sides[b.side];
    if (q.kind === 'unit') {
      var uc = cfg.units[q.key];
      if (uc.hero && (s.units.some(function (u) { return u.type === q.key; }) ||
          s.buildings.some(function (bb) { return bb !== b && bb.queue.some(function (qq) { return qq.kind === 'unit' && qq.key === q.key; }); }))) return true;
      var u = this.spawnNearBuilding(b, q.key);
      if (!u) return false;
      if (b.rally) { u.state = 'move'; u.tx = b.rally.x; u.ty = b.rally.y; }
      return true;
    }
    if (q.kind === 'research') {
      s.research[q.key] = true;
      this.pushEvent('Forschung abgeschlossen: ' + cfg.research[q.key].name, 'good');
      if (LW.audio) LW.audio.play('build');
      return true;
    }
    if (q.kind === 'cross') { this.makeHybrid(b.side, b, q.a, q.b); return true; }
    return true;
  },

  nearestOre: function (x, y) {
    var map = LW.map, best = -1, bd = Infinity;
    for (var i = 0; i < map.oreTiles.length; i++) {
      var ti = map.oreTiles[i];
      if (map.ore[ti] <= 0) continue;
      var tx = (ti % map.W + 0.5) * LW.cfg.tile, ty = (Math.floor(ti / map.W) + 0.5) * LW.cfg.tile;
      var d = LW.util.dist(x, y, tx, ty);
      if (d < bd) { bd = d; best = ti; }
    }
    return best;
  },

  posBlocked: function (x, y, u) {
    var cfg = LW.cfg, map = LW.map;
    if (x < 6 || y < 6 || x >= map.W * cfg.tile - 6 || y >= map.H * cfg.tile - 6) return true;
    var pts = [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]];
    for (var i = 0; i < pts.length; i++) {
      var tx = Math.floor((x + pts[i][0]) / cfg.tile), ty = Math.floor((y + pts[i][1]) / cfg.tile);
      if (!map.inB(tx, ty)) return true;
      var ti = map.ti(tx, ty), t = map.tiles[ti];
      if (t === 1 || t === 3) return true;
      if (t === 2 && u.type !== 'harvester') return true;
      if (this.state.occ[ti] !== 0) return true;
    }
    return false;
  },

  moveToward: function (u, x, y, dt) {
    var cfg = LW.cfg;
    var dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
    if (d < 6) return true;
    var sp = u.speed * cfg.tile * dt;
    var sideS = this.state.sides[u.side];
    if (sideS.faction === 'alien') {
      var ncost = sp * cfg.neutrinoMoveCost;
      if ((sideS.neutrinos || 0) < ncost) return Math.hypot(x - u.x, y - u.y) < 6;
      sideS.neutrinos -= ncost;
    }
    if (u.cls === 'aircraft') {
      u.x += dx / d * sp; u.y += dy / d * sp;
    } else {
      var nx = u.x + dx / d * sp, ny = u.y + dy / d * sp;
      if (!this.posBlocked(nx, ny, u)) { u.x = nx; u.y = ny; }
      else if (!this.posBlocked(nx, u.y, u)) u.x = nx;
      else if (!this.posBlocked(u.x, ny, u)) u.y = ny;
    }
    u.angle = Math.atan2(dy, dx);
    return Math.hypot(x - u.x, y - u.y) < 6;
  },

  acquireUnit: function (u, wpn, rangePx) {
    var st = this.state, os = st.sides[this.otherSide(u.side)];
    var best = null, bd = rangePx, i, d;
    for (i = 0; i < os.units.length; i++) {
      var e = os.units[i];
      if (e.cls === 'aircraft' && !wpn.antiAir) continue;
      d = LW.util.dist(u.x, u.y, e.x, e.y);
      if (d <= bd) { bd = d; best = e; }
    }
    if (!best) {
      var tab = LW.cfg.dmgVs[u.type], m = tab ? tab.building : 0;
      if (m > 0) for (i = 0; i < os.buildings.length; i++) {
        var b = os.buildings[i];
        d = LW.util.dist(u.x, u.y, b.x, b.y);
        if (d <= bd) { bd = d; best = b; }
      }
    }
    return best;
  },

  acquireBuilding: function (b) {
    var st = this.state, os = st.sides[this.otherSide(b.side)], wpn = b.weapon;
    var rangePx = wpn.range * LW.cfg.tile, best = null, bd = rangePx;
    for (var i = 0; i < os.units.length; i++) {
      var e = os.units[i];
      if (e.cls === 'aircraft' && !wpn.antiAir) continue;
      var d = LW.util.dist(b.x, b.y, e.x, e.y);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  },

  fireUnit: function (u, t, wpn) {
    var cfg = LW.cfg, s = this.state.sides[u.side];
    var dmg = wpn.dmg * (s.research.plasma ? 1.35 : 1) * (u.mutated ? cfg.radiation.mutateDmgMult : 1);
    this.state.projectiles.push({ x: u.x, y: u.y, tx: t.x, ty: t.y, tid: t.id, src: u.type, dmg: dmg, speed: wpn.speed * cfg.tile, side: u.side });
  },

  fireBuilding: function (b, t) {
    var cfg = LW.cfg, s = this.state.sides[b.side], wpn = b.weapon;
    var dmg = wpn.dmg * (s.research.plasma ? 1.35 : 1);
    this.state.projectiles.push({ x: b.x, y: b.y, tx: t.x, ty: t.y, tid: t.id, src: b.type, dmg: dmg, speed: 11 * cfg.tile, side: b.side });
  },

  inAnyStorm: function (x, y) {
    var st = this.state;
    for (var i = 0; i < st.storms.length; i++) {
      if (LW.util.dist(x, y, st.storms[i].x, st.storms[i].y) <= st.storms[i].r) return true;
    }
    return false;
  },

  mutate: function (u) {
    u.mutated = true;
    u.maxHp = Math.round(u.maxHp * 1.3);
    u.hp = u.maxHp;
    this.pushEvent('Mutation! Eine Bodeneinheit wurde verstrahlt.', 'warn');
  },

  updateHarvester: function (u, dt) {
    var cfg = LW.cfg, map = LW.map, s = this.state.sides[u.side];
    if (u.state === 'mine') {
      u.harvestT += dt;
      if (u.harvestT >= cfg.harvestTime) {
        var ti = u.oreTi;
        if (ti < 0 || map.ore[ti] <= 0) { u.state = 'idle'; return; }
        var take = Math.min(cfg.harvestAmount, map.ore[ti]);
        map.ore[ti] -= take; u.carrying += take; u.harvestT = 0;
        if (map.ore[ti] <= 0) {
          map.tiles[ti] = 0;
          var idx = map.oreTiles.indexOf(ti);
          if (idx >= 0) map.oreTiles.splice(idx, 1);
          u.oreTi = -1;
        }
        u.state = 'return';
      }
      return;
    }
    if (u.state === 'return') {
      var ref = null, bd = Infinity;
      for (var i = 0; i < s.buildings.length; i++) {
        var b = s.buildings[i];
        if (b.type === 'refinery' && !b.constructing) {
          var d = LW.util.dist(u.x, u.y, b.x, b.y);
          if (d < bd) { bd = d; ref = b; }
        }
      }
      if (!ref) { u.state = 'idle'; return; }
      if (bd < Math.max(ref.w, ref.h) * cfg.tile / 2 + 18) {
        var kind = u.resKind || (u.oreTi >= 0 ? map.resKind[u.oreTi] : null) || 'ore';
        if (kind === 'neutrino') s.neutrinos = (s.neutrinos || 0) + u.carrying;
        else s.credits += u.carrying * (cfg.resources[kind] ? cfg.resources[kind].value : 1);
        u.carrying = 0; u.state = 'goto';
        return;
      }
      this.moveToward(u, ref.x, ref.y, dt);
      return;
    }
    if (u.state === 'goto' || u.state === 'idle') {
      if (u.oreTi < 0 || map.ore[u.oreTi] <= 0) {
        u.oreTi = this.nearestOre(u.x, u.y);
        if (u.oreTi < 0) { u.state = 'idle'; return; }
        u.resKind = map.resKind[u.oreTi];
      }
      var cx = (u.oreTi % map.W + 0.5) * cfg.tile, cy = (Math.floor(u.oreTi / map.W) + 0.5) * cfg.tile;
      if (this.moveToward(u, cx, cy, dt)) { u.state = 'mine'; u.harvestT = 0; }
      return;
    }
    if (u.state === 'move') { if (this.moveToward(u, u.tx, u.ty, dt)) u.state = 'idle'; }
  },

  updateUnit: function (u, dt) {
    var cfg = LW.cfg, st = this.state;
    u.cd -= dt;
    if (u.type === 'harvester') { this.updateHarvester(u, dt); return; }
    var uc = cfg.units[u.type], wpn = uc.weapon;
    var jam = this.inAnyStorm(u.x, u.y);
    if (!wpn) { if (u.state === 'move' || u.state === 'attackMove') { if (this.moveToward(u, u.tx, u.ty, dt)) u.state = 'idle'; } return; }
    var rangePx = wpn.range * cfg.tile * (jam ? 0.5 : 1);
    var t = u.targetId != null ? this.findGlobal(u.targetId) : null;
    if (t && t.cls === 'aircraft' && !wpn.antiAir) t = null;
    if (t && LW.util.dist(u.x, u.y, t.x, t.y) <= rangePx) {
      u.angle = Math.atan2(t.y - u.y, t.x - u.x);
      u.state = 'attack';
      if (u.cd <= 0) {
        u.cd = wpn.rate;
        if (jam && this.rng() < cfg.radiation.jamChance) this.spark(u.x, u.y);
        else this.fireUnit(u, t, wpn);
      }
    } else {
      var goalX = u.tx, goalY = u.ty;
      var moving = (u.state === 'move' || u.state === 'attackMove' || u.state === 'attack');
      if (t && u.state === 'attack') { goalX = t.x; goalY = t.y; }
      if (moving && Math.hypot(goalX - u.x, goalY - u.y) > 6) {
        this.moveToward(u, goalX, goalY, dt);
        if (u.state === 'attackMove') {
          var nt = this.acquireUnit(u, wpn, rangePx);
          if (nt) { u.targetId = nt.id; u.state = 'attack'; }
        }
      } else {
        var nt2 = this.acquireUnit(u, wpn, rangePx);
        if (nt2) { u.targetId = nt2.id; u.state = 'attack'; }
        else { u.state = 'idle'; u.targetId = null; }
      }
    }
  },

  updateBuilding: function (b, dt) {
    var cfg = LW.cfg, s = this.state.sides[b.side];
    if (b.constructing) {
      b.buildLeft -= dt;
      if (b.buildLeft <= 0) {
        b.constructing = false;
        this.pushEvent(cfg.buildings[b.type].name + ' fertig gestellt.', 'good');
        if (LW.audio) LW.audio.play('build');
      }
    }
    if (b.irradiated > 0) {
      b.irradiated -= dt;
      b.hp -= cfg.radiation.buildingDot * dt;
      if (b.hp <= 0) { this.destroy(b); return; }
    }
    if (b.constructing) return;
    var q = b.queue[0];
    if (q && !b.offline) {
      q.left -= dt * (s.research.fastbuild ? 1.5 : 1);
      if (q.left <= 0 && this.finishQueueItem(b, q)) b.queue.shift();
    }
    if (b.weapon && !b.offline) {
      b.cd -= dt;
      var t = this.acquireBuilding(b);
      if (t) {
        b.angle = Math.atan2(t.y - b.y, t.x - b.x);
        if (b.cd <= 0) { this.fireBuilding(b, t); b.cd = b.weapon.rate; }
      }
    }
    var holder = this.holderOf(b.type);
    if (holder === 'storm' && !s.research.weather) holder = null;
    if (holder && !b.offline) {
      var key = b.type === 'silo' ? (s.research.hbomb ? 'hbomb' : 'nuke') : holder;
      var sup = cfg.super[key];
      b.superKey = key;
      b.chargeMax = sup.charge;
      if (!b.superReady) {
        b.charge += dt;
        if (b.charge >= sup.charge) {
          b.charge = sup.charge;
          b.superReady = true;
          this.pushEvent('Superwaffe bereit: ' + sup.name, 'good');
          if (LW.audio) LW.audio.play('ready');
        }
      }
    }
  },

  updatePower: function (sideKey) {
    var cfg = LW.cfg, st = this.state, s = st.sides[sideKey];
    var supply = 0, demand = 0;
    for (var i = 0; i < s.buildings.length; i++) {
      var b = s.buildings[i];
      if (b.constructing) continue;
      var p = cfg.buildings[b.type].power;
      if (p > 0) supply += p; else demand -= p;
    }
    s.powerSupply = supply; s.powerDemand = demand;
    var deficit = demand > supply ? (demand - supply) / demand : 0;
    for (i = 0; i < s.buildings.length; i++) {
      b = s.buildings[i];
      if (b.constructing || cfg.buildings[b.type].power > 0) { if (!b.constructing) b.offline = false; continue; }
      var off = this.rng() < deficit;
      if (!off && this.inAnyStorm(b.x, b.y)) off = true;
      b.offline = off;
    }
  },

  damage: function (target, dmg, srcKey, srcSide) {
    var cfg = LW.cfg;
    var cls = target.cls || 'building';
    var table = cfg.dmgVs[srcKey];
    var mult = table ? (table[cls] != null ? table[cls] : 1) : 1;
    if (mult === 0) return;
    var s = this.state.sides[target.side];
    if (s.research.armor) dmg *= 0.7;
    target.hp -= dmg * mult;
    if (target.hp <= 0) this.destroy(target);
  },

  destroy: function (target) {
    var cfg = LW.cfg, st = this.state, s = st.sides[target.side], i;
    if (target.cls) {
      i = s.units.indexOf(target);
      if (i >= 0) s.units.splice(i, 1);
    } else {
      i = s.buildings.indexOf(target);
      if (i >= 0) s.buildings.splice(i, 1);
      var map = LW.map;
      for (var dy = 0; dy < target.h; dy++) for (var dx = 0; dx < target.w; dx++) st.occ[map.ti(target.tx + dx, target.ty + dy)] = 0;
      st.decals.push({ x: target.x, y: target.y, r: Math.max(target.w, target.h) * cfg.tile * 0.6 });
      this.pushEvent(cfg.buildings[target.type].name + ' zerstört!', 'warn');
    }
    for (i = 0; i < 14; i++) {
      var a = this.rng() * Math.PI * 2, sp = 30 + this.rng() * 90;
      st.particles.push({ x: target.x, y: target.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4 + this.rng() * 0.4, max: 0.8, size: 3 + this.rng() * 3, color: '#ffb347' });
    }
    this.checkEnd();
  },

  checkEnd: function () {
    var st = this.state;
    if (st.over) return;
    var pHQ = st.sides.player.buildings.some(function (b) { return b.type === 'hq'; });
    var eHQ = st.sides.enemy.buildings.some(function (b) { return b.type === 'hq'; });
    if (!eHQ) { st.over = 'win'; this.pushEvent('Sieg! Das Xylith-Kollektiv wurde besiegt.', 'good'); }
    else if (!pHQ) { st.over = 'lose'; this.pushEvent('Niederlage! Die Kommandozentrale wurde zerstört.', 'warn'); }
  },

  explode: function (x, y, rTiles, dmg, side) {
    var cfg = LW.cfg, st = this.state, r = rTiles * cfg.tile;
    for (var sk in st.sides) {
      var s = st.sides[sk], i;
      var us = s.units.slice();
      for (i = 0; i < us.length; i++) {
        var d = LW.util.dist(us[i].x, us[i].y, x, y);
        if (d <= r) this.damage(us[i], dmg * (1 - 0.6 * d / r), 'nuke', side);
      }
      var bs = s.buildings.slice();
      for (i = 0; i < bs.length; i++) {
        var d2 = LW.util.dist(bs[i].x, bs[i].y, x, y);
        if (d2 <= r) this.damage(bs[i], dmg * (1 - 0.6 * d2 / r), 'nuke', side);
      }
    }
    st.decals.push({ x: x, y: y, r: r * 0.85 });
    st.shake = Math.max(st.shake, rTiles > 5 ? 26 : 16);
    for (var k = 0; k < 50; k++) {
      var a = this.rng() * Math.PI * 2, sp = 40 + this.rng() * 160;
      st.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + this.rng() * 0.7, max: 1.2, size: 4 + this.rng() * 6, color: k % 3 === 0 ? '#ffe08a' : (k % 3 === 1 ? '#ff9a3c' : '#ff5c2e') });
    }
    this.pushEvent('Einschlag!', 'warn');
    if (LW.audio) LW.audio.play('explosion');
  },

  launchSuper: function (side, bId, x, y) {
    var cfg = LW.cfg, st = this.state, map = LW.map;
    var b = this.findBuilding(side, bId);
    if (!b || !b.superReady) return { ok: false, reason: 'Superwaffe nicht bereit' };
    x = LW.util.clamp(x, 16, map.W * cfg.tile - 16);
    y = LW.util.clamp(y, 16, map.H * cfg.tile - 16);
    var key = b.superKey, sup = cfg.super[key];
    if (key === 'storm') {
      st.storms.push({ x: x, y: y, r: sup.radius * cfg.tile, side: side, left: sup.duration, acc: 0 });
      this.pushEvent(sup.name + ' entfesselt!', 'warn');
      if (LW.audio) LW.audio.play('storm');
    } else {
      st.missiles.push({ x: b.x, y: b.y - 20, tx: x, ty: y, t: 0, dur: sup.missile, kind: key, side: side, px: b.x, py: b.y - 20 });
      this.pushEvent(sup.name + ' gestartet!', 'warn');
      if (LW.audio) LW.audio.play('launch');
    }
    b.superReady = false;
    b.charge = 0;
    return { ok: true };
  },

  spark: function (x, y) {
    this.state.particles.push({ x: x, y: y, vx: 0, vy: -20, life: 0.15, max: 0.15, size: 2, color: '#9adcff' });
  },

  pushEvent: function (text, kind) {
    var st = this.state;
    st.events.push({ t: st.time, text: text, kind: kind || '' });
    if (st.events.length > 40) st.events.shift();
  },

  tick: function (dt) {
    var cfg = LW.cfg, st = this.state, i, sk;
    st.time += dt; st.tick++;
    for (sk in st.sides) {
      var s = st.sides[sk];
      if (s.research.solar) s.credits += cfg.solarIncome * dt;
      this.updatePower(sk);
    }
    for (sk in st.sides) {
      var bs = st.sides[sk].buildings.slice();
      for (i = 0; i < bs.length; i++) this.updateBuilding(bs[i], dt);
    }
    for (sk in st.sides) {
      var us = st.sides[sk].units.slice();
      for (i = 0; i < us.length; i++) this.updateUnit(us[i], dt);
    }
    var pr = st.projectiles;
    for (i = pr.length - 1; i >= 0; i--) {
      var p = pr[i];
      var t = p.tid != null ? this.findGlobal(p.tid) : null;
      if (t) { p.tx = t.x; p.ty = t.y; }
      var d = LW.util.dist(p.x, p.y, p.tx, p.ty), step = p.speed * dt;
      if (d <= Math.max(step, 6)) {
        if (t) this.damage(t, p.dmg, p.src, p.side);
        pr.splice(i, 1);
      } else { p.x += (p.tx - p.x) / d * step; p.y += (p.ty - p.y) / d * step; }
    }
    for (i = st.missiles.length - 1; i >= 0; i--) {
      var m = st.missiles[i];
      m.t += dt;
      var f = Math.min(1, m.t / m.dur);
      m.px = LW.util.lerp(m.x, m.tx, f);
      m.py = LW.util.lerp(m.y, m.ty, f) - Math.sin(f * Math.PI) * 90;
      st.particles.push({ x: m.px, y: m.py + 8, vx: 0, vy: 30, life: 0.25, max: 0.25, size: 4, color: '#ffb347' });
      if (f >= 1) {
        var sup = cfg.super[m.kind];
        this.explode(m.tx, m.ty, sup.radius, sup.dmg, m.side);
        st.missiles.splice(i, 1);
      }
    }
    var stormSup = cfg.super.storm;
    for (i = st.storms.length - 1; i >= 0; i--) {
      var sm = st.storms[i];
      sm.left -= dt; sm.acc += dt;
      while (sm.acc >= 0.25) {
        sm.acc -= 0.25;
        var other = this.otherSide(sm.side), os = st.sides[other], j;
        var ous = os.units.slice();
        for (j = 0; j < ous.length; j++) {
          var u = ous[j];
          if (LW.util.dist(u.x, u.y, sm.x, sm.y) <= sm.r) {
            if (u.cls !== 'aircraft' && !u.mutated && this.rng() < cfg.radiation.mutateChance) this.mutate(u);
            this.damage(u, stormSup.dmgPerSec * 0.25, 'storm', sm.side);
          }
        }
        var obs = os.buildings.slice();
        for (j = 0; j < obs.length; j++) {
          var b = obs[j];
          if (LW.util.dist(b.x, b.y, sm.x, sm.y) <= sm.r) {
            this.damage(b, stormSup.dmgPerSec * 0.25 * 0.6, 'storm', sm.side);
            b.irradiated = cfg.radiation.irradiatedTime;
          }
        }
        var ang = this.rng() * Math.PI * 2, rr = this.rng() * sm.r;
        var lx = sm.x + Math.cos(ang) * rr, ly = sm.y + Math.sin(ang) * rr;
        st.particles.push({ x: lx, y: ly - 60 - this.rng() * 40, x2: lx, y2: ly, vx: 0, vy: 0, life: 0.16, max: 0.16, size: 2, color: '#c9a2ff', bolt: true });
      }
      if (sm.left <= 0) st.storms.splice(i, 1);
    }
    for (i = st.particles.length - 1; i >= 0; i--) {
      var pt = st.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.life <= 0) st.particles.splice(i, 1);
    }
    st.shake = Math.max(0, st.shake - dt * 30);
    st.aiTimer -= dt;
    if (st.aiTimer <= 0) {
      if (LW.ai && !st.over) LW.ai.think(st);
      st.aiTimer = cfg.ai.thinkInterval;
    }
  },

  moveUnits: function (ids, x, y) {
    for (var i = 0; i < ids.length; i++) {
      var u = this.findGlobal(ids[i]);
      if (u && u.side === 'player' && u.type !== 'harvester') { u.state = 'move'; u.tx = x; u.ty = y; u.targetId = null; }
    }
  },

  attackTarget: function (ids, tid) {
    var t = this.findGlobal(tid);
    if (!t) return;
    for (var i = 0; i < ids.length; i++) {
      var u = this.findGlobal(ids[i]);
      if (u && u.side === 'player') { u.state = 'attack'; u.targetId = tid; u.tx = t.x; u.ty = t.y; }
    }
  },

  harvestAt: function (ids, ti) {
    for (var i = 0; i < ids.length; i++) {
      var u = this.findGlobal(ids[i]);
      if (u && u.side === 'player' && u.type === 'harvester') { u.oreTi = ti; u.resKind = LW.map.resKind[ti]; u.state = 'goto'; }
    }
  },

  selectAt: function (wx, wy) {
    var cfg = LW.cfg, map = LW.map, st = this.state;
    var tx = Math.floor(wx / cfg.tile), ty = Math.floor(wy / cfg.tile);
    if (map.inB(tx, ty)) {
      var id = st.occ[map.ti(tx, ty)];
      if (id) return this.findGlobal(id);
    }
    var best = null, bd = 20 * 20;
    var us = st.sides.player.units;
    for (var i = 0; i < us.length; i++) {
      var d = (us[i].x - wx) * (us[i].x - wx) + (us[i].y - wy) * (us[i].y - wy);
      if (d < bd) { bd = d; best = us[i]; }
    }
    return best;
  },

  enemyAt: function (wx, wy) {
    var cfg = LW.cfg, map = LW.map, st = this.state;
    var best = null, bd = 18 * 18, i;
    var us = st.sides.enemy.units;
    for (i = 0; i < us.length; i++) {
      var d = (us[i].x - wx) * (us[i].x - wx) + (us[i].y - wy) * (us[i].y - wy);
      if (d < bd) { bd = d; best = us[i]; }
    }
    if (!best) {
      var tx = Math.floor(wx / cfg.tile), ty = Math.floor(wy / cfg.tile);
      if (map.inB(tx, ty)) { var id = st.occ[map.ti(tx, ty)]; if (id) { var b = this.findGlobal(id); if (b && b.side === 'enemy') best = b; } }
    }
    return best;
  },

  debug: {
    give: function (side, n) { LW.core.state.sides[side].credits += n; },
    finishAll: function (side) {
      LW.core.state.sides[side].buildings.forEach(function (b) { b.constructing = false; b.buildLeft = 0; });
    },
    killSide: function (side) {
      var s = LW.core.state.sides[side];
      s.buildings.slice().forEach(function (b) { LW.core.damage(b, 1e9, 'koloss', 'player'); });
      s.units.slice().forEach(function (u) { LW.core.damage(u, 1e9, 'koloss', 'player'); });
    },
  },
};
