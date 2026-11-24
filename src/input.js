var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.input = {
  canvas: null,
  cam: { x: 0, y: 0 },
  zoom: 0.75,
  mouse: { sx: -1, sy: -1, wx: 0, wy: 0 },
  keys: {},
  sel: { units: [], building: null },
  placing: null,
  targetB: null,
  drag: null,
  shiftDown: false,

  init: function () {
    this.bindWindow();
    this.bindCanvas(document.getElementById('game'));
  },

  bindWindow: function () {
    var self = this;
    window.addEventListener('mousemove', function (e) {
      var canvas = self.canvas;
      if (!canvas) return;
      var r = canvas.getBoundingClientRect();
      var ps = self.pxScale || 1;
      self.mouse.sx = (e.clientX - r.left) * ps;
      self.mouse.sy = (e.clientY - r.top) * ps;
      if (self.drag) {
        self.drag.x2 = self.mouse.sx; self.drag.y2 = self.mouse.sy;
        if (Math.hypot(self.drag.x2 - self.drag.x1, self.drag.y2 - self.drag.y1) > 6) self.drag.moved = true;
      }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0 && self.drag) {
        var d = self.drag; self.drag = null;
        if (!d.moved) self.click(self.mouse.sx, self.mouse.sy, self.shiftDown);
        else self.boxSelect(d);
      }
    });
    window.addEventListener('keydown', function (e) { self.onKey(e); });
    window.addEventListener('resize', function () { self.resize(); });
  },

  bindCanvas: function (canvas) {
    var self = this;
    this.canvas = canvas;
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) {
        var ps = self.pxScale || 1;
        self.shiftDown = e.shiftKey;
        self.drag = { x1: e.offsetX * ps, y1: e.offsetY * ps, x2: e.offsetX * ps, y2: e.offsetY * ps, moved: false };
      }
    });
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      self.command(self.mouse.sx, self.mouse.sy);
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      self.zoom = LW.util.clamp(self.zoom * (e.deltaY > 0 ? 0.88 : 1.14), 0.35, 1.6);
    }, { passive: false });
    this.resize();
  },

  resize: function () {
    var c = this.canvas;
    c.width = 1280;
    c.height = 720;
    var parent = c.parentElement;
    if (parent) {
      var aw = (parent.clientWidth || 1280) - 8, ah = (parent.clientHeight || 720) - 8;
      var scale = Math.min(aw / 1280, ah / 720, 1);
      if (!(scale > 0) || !isFinite(scale)) scale = 1;
      c.style.width = Math.floor(1280 * scale) + 'px';
      c.style.height = Math.floor(720 * scale) + 'px';
    }
    this.pxScale = c.clientWidth > 0 ? c.width / c.clientWidth : 1;
  },

  centerOn: function (b) {
    var cfg = LW.cfg, map = LW.map;
    var vw = this.canvas.width, vh = this.canvas.height;
    var worldW = map.W * cfg.tile, worldH = map.H * cfg.tile;
    this.cam.x = LW.util.clamp(b.x, Math.min(vw / 2, worldW / 2), Math.max(worldW - vw / 2, worldW / 2));
    this.cam.y = LW.util.clamp(b.y, Math.min(vh / 2, worldH / 2), Math.max(worldH - vh / 2, worldH / 2));
  },

  update: function (dt) {
    var cfg = LW.cfg, map = LW.map;
    var sp = 540 * dt / (this.zoom || 0.75);
    var k = this.keys;
    var vw = this.canvas.width, vh = this.canvas.height;
    var worldW = map.W * cfg.tile, worldH = map.H * cfg.tile;
    var m = this.mouse;
    var edge = 26 * (this.pxScale || 1);
    if (k['a'] && !k['d'] || k['arrowleft']) this.cam.x -= sp;
    if (k['d'] && !k['a'] || k['arrowright']) this.cam.x += sp;
    if (k['w'] && !k['s'] || k['arrowup']) this.cam.y -= sp;
    if (k['s'] && !k['w'] || k['arrowdown']) this.cam.y += sp;
    if (m.sx >= 0 && m.sx < edge) this.cam.x -= sp;
    if (m.sx >= 0 && m.sx > vw - edge) this.cam.x += sp;
    if (m.sy >= 0 && m.sy < edge) this.cam.y -= sp;
    if (m.sy >= 0 && m.sy > vh - edge) this.cam.y += sp;
    this.cam.x = LW.util.clamp(this.cam.x, Math.min(vw / 2, worldW / 2), Math.max(worldW - vw / 2, worldW / 2));
    this.cam.y = LW.util.clamp(this.cam.y, Math.min(vh / 2, worldH / 2), Math.max(worldH - vh / 2, worldH / 2));
    if (LW.render3d && LW.render3d.active && LW.render3d.ready) {
      var w = LW.render3d.screenToWorld(m.sx < 0 ? vw / 2 : m.sx, m.sy < 0 ? vh / 2 : m.sy);
      this.mouse.wx = w.x; this.mouse.wy = w.y;
    } else {
      this.mouse.wx = this.cam.x - vw / 2 + m.sx;
      this.mouse.wy = this.cam.y - vh / 2 + m.sy;
    }
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
    } else if (kind === 'hq') {
      var hq = p.buildings.find(function (x) { return x.type === 'hq'; });
      if (hq) this.centerOn(hq);
    } else if (kind === 'mute') {
      if (LW.audio) { LW.audio.muted = !LW.audio.muted; document.getElementById('btn-mute').textContent = LW.audio.muted ? '🔇' : '🔊'; }
    }
  },

  startPlacing: function (key) { this.placing = key; this.targetB = null; },
  startTarget: function (bId, which) { this.targetB = { id: bId, which: which || '1' }; this.placing = null; },
};
