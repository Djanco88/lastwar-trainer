var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.map = {
  W: 0, H: 0, tile: 32,
  tiles: null, ore: null, resKind: null, shade: null, oreTiles: [],
  gen: function (seed) {
    var cfg = LW.cfg, rng = LW.util.mulberry32(seed);
    this.W = cfg.mapW; this.H = cfg.mapH; this.tile = cfg.tile;
    this.tiles = new Uint8Array(this.W * this.H);
    this.ore = new Int32Array(this.W * this.H);
    this.resKind = new Array(this.W * this.H).fill(null);
    this.shade = new Float32Array(this.W * this.H);
    this.oreTiles = [];
    var i;
    for (i = 0; i < this.W * this.H; i++) this.shade[i] = 0.9 + rng() * 0.2;
    var self = this;
    var pHQ = { x: 5, y: this.H - 8 }, eHQ = { x: this.W - 8, y: 4 };
    var c, cx, cy, k, n;
    for (c = 0; c < 16; c++) {
      cx = 2 + Math.floor(rng() * (this.W - 4));
      cy = 2 + Math.floor(rng() * (this.H - 4));
      if (Math.hypot(cx - pHQ.x, cy - pHQ.y) < 8 || Math.hypot(cx - eHQ.x, cy - eHQ.y) < 8) continue;
      n = 2 + Math.floor(rng() * 4);
      for (k = 0; k < n; k++) {
        if (this.inB(cx, cy)) this.tiles[this.ti(cx, cy)] = 1;
        cx += Math.floor(rng() * 3) - 1; cy += Math.floor(rng() * 3) - 1;
      }
    }
    var y, wx;
    for (y = 0; y < this.H; y++) {
      wx = Math.round(this.W / 2 + 3 * Math.sin(y * 0.35) + (rng() - 0.5) * 2);
      for (var dx = -1; dx <= 1; dx++) {
        var tx = wx + dx;
        if (this.inB(tx, y)) this.tiles[this.ti(tx, y)] = 3;
      }
    }
    for (c = 0; c < 2; c++) {
      cx = 6 + Math.floor(rng() * (this.W - 12));
      cy = 6 + Math.floor(rng() * (this.H - 12));
      for (var ly = 0; ly < 2; ly++) for (var lx = 0; lx < 2; lx++) {
        if (this.inB(cx + lx, cy + ly)) this.tiles[this.ti(cx + lx, cy + ly)] = 3;
      }
    }
    var clear = function (ccx, ccy, r) {
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var tx2 = ccx + dx, ty2 = ccy + dy;
        if (self.inB(tx2, ty2)) self.tiles[self.ti(tx2, ty2)] = 0;
      }
    };
    clear(pHQ.x + 1, pHQ.y + 1, 7);
    clear(eHQ.x + 1, eHQ.y + 1, 7);
    var W = this.W, H = this.H, hw = Math.floor(W / 2), hh = Math.floor(H / 2);
    var clusters = [
      ['ore', 11, H - 13, 3, 3], ['ore', W - 17, H - 13, 3, 3], ['ore', hw - 9, hh + 7, 3, 3],
      ['ore', hw + 9, hh - 7, 3, 3], ['ore', hw - 6, hh - 9, 3, 3],
      ['co2', hw + 4, hh + 8, 3, 3], ['co2', hw - 12, hh, 2, 2], ['co2', 16, hh + 10, 2, 2],
      ['h1', hw + 12, hh + 6, 3, 3], ['h1', 20, H - 16, 2, 2],
      ['h2', hw - 4, hh - 10, 2, 2], ['h2', W - 20, hh, 2, 2],
      ['h3', hw - 16, hh + 13, 2, 2],
      ['neutrino', W - 13, 12, 3, 3], ['neutrino', hw + 7, hh - 8, 2, 2],
    ];
    for (c = 0; c < clusters.length; c++) {
      var kind = clusters[c][0], cx0 = clusters[c][1], cy0 = clusters[c][2], cw = clusters[c][3], ch = clusters[c][4];
      for (var ry = 0; ry < ch; ry++) for (var rx = 0; rx < cw; rx++) {
        var rtx = cx0 + rx, rty = cy0 + ry;
        if (!this.inB(rtx, rty)) continue;
        var ti = this.ti(rtx, rty);
        if (this.tiles[ti] === 3) continue;
        this.tiles[ti] = 2;
        this.resKind[ti] = kind;
        this.ore[ti] = 400 + Math.floor(rng() * 300);
        this.oreTiles.push(ti);
      }
    }
  },
  inB: function (tx, ty) { return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H; },
  ti: function (tx, ty) { return ty * this.W + tx; },
};
