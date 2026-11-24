var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.input = {
  canvas: null,
  cam: { x: 0, y: 0 },
  mouse: { sx: 0, sy: 0, wx: 0, wy: 0 },
  keys: {},
  sel: { units: [], building: null },
  placing: null,
  targetB: null,
  drag: null,
  shiftDown: false,

  init: function () {
    var canvas = document.getElementById('game');
    this.canvas = canvas;
    var self = this;
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        self.shiftDown = e.shiftKey;
        self.drag = { x1: e.offsetX, y1: e.offsetY, x2: e.offsetX, y2: e.offsetY, moved: false };
      }
    });
    window.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.sx = e.clientX - r.left;
      self.mouse.sy = e.clientY - r.top;
      if (self.drag) {
        self.drag.x2 = self.mouse.sx; self.drag.y2 = self.mouse.sy;
        if (Math.hypot(self.drag.x2 - self.drag.x1, self.drag.y2 - self.drag.y1) > 6) self.drag.moved = true;
      }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0 && self.drag) {
        var d = self.drag; self.drag = null;
        if (!d.moved) self.click(self.mouse.sx, self.mouse.sy, d ? self.shiftDown : false);
        else self.boxSelect(d);
      }
    });
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      self.command(self.mouse.sx, self.mouse.sy);
    });
    window.addEventListener('keydown', function (e) { self.onKey(e); });
    window.addEventListener('resize', function () { self.resize(); });
    this.resize();
  },

  resize: function () {
    var c = this.canvas;
    c.width = Math.max(320, c.clientWidth || 800);
    c.height = Math.max(240, c.clientHeight || 600);
  },

  centerOn: function (b) {
    var cfg = LW.cfg, map = LW.map;
    this.cam.x = LW.util.clamp(b.x - this.canvas.width / 2, 0, Math.max(0, map.W * cfg.tile - this.canvas.width));
    this.cam.y = LW.util.clamp(b.y - this.canvas.height / 2, 0, Math.max(0, map.H * cfg.tile - this.canvas.height));
  },

  update: function (dt) {
    var cfg = LW.cfg, map = LW.map;
    var sp = 540 * dt;
    var k = this.keys;
    if (k['a'] && !k['d'] || k['arrowleft']) this.cam.x -= sp;
    if (k['d'] && !k['a'] || k['arrowright']) this.cam.x += sp;
    if (k['w'] && !k['s'] || k['arrowup']) this.cam.y -= sp;
    if (k['s'] && !k['w'] || k['arrowdown']) this.cam.y += sp;
    if (this.mouse.sx >= 0 && this.mouse.sx < 22) this.cam.x -= sp;
    if (this.mouse.sx > this.canvas.width - 22) this.cam.x += sp;
    if (this.mouse.sy >= 0 && this.mouse.sy < 22) this.cam.y -= sp;
    if (this.mouse.sy > this.canvas.height - 22) this.cam.y += sp;
    this.cam.x = LW.util.clamp(this.cam.x, 0, Math.max(0, map.W * cfg.tile - this.canvas.width));
    this.cam.y = LW.util.clamp(this.cam.y, 0, Math.max(0, map.H * cfg.tile - this.canvas.height));
    this.mouse.wx = this.cam.x + this.mouse.sx;
    this.mouse.wy = this.cam.y + this.mouse.sy;
  },

  click: function (sx, sy, shift) {
    var cfg = LW.cfg, core = LW.core;
    var wx = this.cam.x + sx, wy = this.cam.y + sy;
    if (this.placing) {
      var key = this.placing;
      var tx = Math.floor(wx / cfg.tile), ty = Math.floor(wy / cfg.tile);
      var r = core.placeBuilding('player', key, tx, ty);
      if (r.ok) { this.placing = null; if (LW.audio) LW.audio.play('build'); }
      else { core.pushEvent(r.reason, 'warn'); if (LW.audio) LW.audio.play('error'); }
      return;
    }
    if (this.targetB) {
      core.launchSuper('player', this.targetB.id, wx, wy, this.targetB.which);
      this.targetB = null;
      return;
    }
    var t = core.selectAt(wx, wy);
    if (t) {
      if (!t.cls) this.sel = { units: [], building: t };
      else if (shift) { if (this.sel.units.indexOf(t) < 0) this.sel.units.push(t); this.sel.building = null; }
      else this.sel = { units: [t], building: null };
      if (LW.audio) LW.audio.play('select');
    } else if (!shift) this.sel = { units: [], building: null };
  },

  boxSelect: function (d) {
    var x1 = Math.min(d.x1, d.x2) + this.cam.x, y1 = Math.min(d.y1, d.y2) + this.cam.y;
    var x2 = Math.max(d.x1, d.x2) + this.cam.x, y2 = Math.max(d.y1, d.y2) + this.cam.y;
    var us = LW.core.state.sides.player.units;
    this.sel.units = us.filter(function (u) { return u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2; });
    this.sel.building = null;
  },

  command: function (sx, sy) {
    var cfg = LW.cfg, map = LW.map, core = LW.core;
    var wx = this.cam.x + sx, wy = this.cam.y + sy;
    var b = this.sel.building;
    var ids = this.sel.units.map(function (u) { return u.id; });
    if (b) { b.rally = { x: wx, y: wy }; return; }
    if (!ids.length) return;
    var tx = Math.floor(wx / cfg.tile), ty = Math.floor(wy / cfg.tile);
    if (map.inB(tx, ty) && map.tiles[map.ti(tx, ty)] === 2 && this.sel.units.some(function (u) { return u.type === 'harvester'; })) {
      core.harvestAt(ids, map.ti(tx, ty));
      return;
    }
    var t = core.enemyAt(wx, wy);
    if (t) core.attackTarget(ids, t.id);
    else core.moveUnits(ids, wx, wy);
  },

  onKey: function (e) {
    var k = e.key.toLowerCase();
    if (k === 'escape') { this.placing = null; this.targetB = null; this.sel = { units: [], building: null }; return; }
    if (k === ' ') { e.preventDefault(); return; }
    this.keys[k] = true;
    var self = this;
    window.addEventListener('keyup', function once() {
      self.keys[k] = false;
      window.removeEventListener('keyup', once);
    });
    var act = LW.cfg.keys[k];
    if (!act) return;
    e.preventDefault();
    this.onAction(act[0], act[1]);
  },

  onAction: function (kind, key) {
    var cfg = LW.cfg, core = LW.core, st = core.state, p = st.sides.player;
    if (kind === 'build') {
      var cb = core.canBuild('player', key);
      if (!cb.ok) { core.pushEvent(cb.reason, 'warn'); if (LW.audio) LW.audio.play('error'); return; }
      this.startPlacing(key);
    } else if (kind === 'unit') {
      var u = cfg.units[key];
      var b = null;
      if (this.sel.building && this.sel.building.type === u.prod && !this.sel.building.constructing) b = this.sel.building;
      else b = p.buildings.find(function (x) { return x.type === u.prod && !x.constructing; });
      if (!b) { core.pushEvent('Benötigt ' + cfg.buildings[u.prod].name, 'warn'); if (LW.audio) LW.audio.play('error'); return; }
      var r = core.queueUnit('player', b.id, key);
      if (!r.ok) { core.pushEvent(r.reason, 'warn'); if (LW.audio) LW.audio.play('error'); }
    } else if (kind === 'research') {
      var tech = p.buildings.find(function (x) { return x.type === 'tech' && !x.constructing; });
      if (!tech) { core.pushEvent('Benötigt Tech-Zentrum', 'warn'); if (LW.audio) LW.audio.play('error'); return; }
      var rr = core.queueResearch('player', tech.id, key);
      if (!rr.ok) { core.pushEvent(rr.reason, 'warn'); if (LW.audio) LW.audio.play('error'); }
    } else if (kind === 'super') {
      var ready = p.buildings.find(function (x) { return x.superReady; });
      if (ready) this.startTarget(ready.id, '1');
      else {
        var ready2 = p.buildings.find(function (x) { return x.super2 && x.super2.ready; });
        if (ready2) this.startTarget(ready2.id, '2');
        else { core.pushEvent('Keine Superwaffe bereit.', 'warn'); if (LW.audio) LW.audio.play('error'); }
      }
    } else if (kind === 'mute') {
      if (LW.audio) { LW.audio.muted = !LW.audio.muted; document.getElementById('btn-mute').textContent = LW.audio.muted ? '🔇' : '🔊'; }
    }
  },

  startPlacing: function (key) { this.placing = key; this.targetB = null; },
  startTarget: function (bId, which) { this.targetB = { id: bId, which: which || '1' }; this.placing = null; },
};
