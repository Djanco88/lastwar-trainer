var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.render = {
  terrain: null,

  init: function () {
    var cfg = LW.cfg, map = LW.map;
    var cv = document.createElement('canvas');
    cv.width = map.W * cfg.tile; cv.height = map.H * cfg.tile;
    var c = cv.getContext('2d');
    for (var ty = 0; ty < map.H; ty++) for (var tx = 0; tx < map.W; tx++) {
      var ti = map.ti(tx, ty), t = map.tiles[ti], sh = map.shade[ti];
      if (t === 1) c.fillStyle = 'rgb(' + (100 * sh | 0) + ',' + (100 * sh | 0) + ',' + (108 * sh | 0) + ')';
      else if (t === 3) c.fillStyle = 'rgb(' + (22 * sh | 0) + ',' + (54 * sh | 0) + ',' + (96 * sh | 0) + ')';
      else c.fillStyle = 'rgb(' + (52 * sh | 0) + ',' + (104 * sh | 0) + ',' + (48 * sh | 0) + ')';
      c.fillRect(tx * cfg.tile, ty * cfg.tile, cfg.tile, cfg.tile);
      if (t === 3) {
        c.fillStyle = 'rgba(120,190,255,0.25)';
        c.fillRect(tx * cfg.tile, ty * cfg.tile, cfg.tile, 3);
      }
    }
    this.terrain = cv;
  },

  drawResource: function (c, ti) {
    var cfg = LW.cfg, map = LW.map;
    var kind = map.resKind[ti];
    var col = cfg.resources[kind] ? cfg.resources[kind].color : '#e8c832';
    var frac = Math.max(0.15, Math.min(1, map.ore[ti] / 500));
    var tx = ti % map.W, ty = Math.floor(ti / map.W);
    var cx = (tx + 0.5) * cfg.tile, cy = (ty + 0.5) * cfg.tile;
    c.globalAlpha = 0.35 + 0.65 * frac;
    c.fillStyle = col;
    var s = 5 + 4 * frac;
    c.beginPath(); c.moveTo(cx - s, cy + s * 0.7); c.lineTo(cx - s * 0.3, cy - s); c.lineTo(cx + s * 0.2, cy + s * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(cx + s * 0.2, cy + s * 0.7); c.lineTo(cx + s * 0.55, cy - s * 0.6); c.lineTo(cx + s, cy + s * 0.5); c.closePath(); c.fill();
    c.beginPath(); c.arc(cx, cy + 1, s * 0.45, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  },

  drawBuilding: function (c, b, st) {
    var cfg = LW.cfg, tile = cfg.tile;
    var fac = cfg.factions[st.sides[b.side].faction];
    var bc = cfg.buildings[b.type];
    var x = b.tx * tile, y = b.ty * tile, w = b.w * tile, h = b.h * tile;
    c.fillStyle = b.constructing ? '#262c33' : fac.dark;
    c.fillRect(x, y, w, h);
    c.strokeStyle = fac.color; c.lineWidth = 2;
    c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    var cx = x + w / 2, cy = y + h / 2;
    c.fillStyle = fac.color;
    c.strokeStyle = fac.color;
    switch (b.type) {
      case 'hq': c.fillRect(cx - 14, cy - 10, 28, 20); c.fillStyle = '#0d1218'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('HQ', cx, cy + 4); break;
      case 'plant': case 'nemitter': c.fillRect(cx - 10, cy - 14, 7, 28); c.fillRect(cx + 3, cy - 14, 7, 28); break;
      case 'solar': c.strokeRect(cx - 14, cy - 10, 28, 20); c.beginPath(); c.moveTo(cx - 14, cy); c.lineTo(cx + 14, cy); c.moveTo(cx, cy - 10); c.lineTo(cx, cy + 10); c.stroke(); break;
      case 'wind': c.beginPath(); c.moveTo(cx, cy + 12); c.lineTo(cx, cy - 4); c.stroke(); for (var i = 0; i < 3; i++) { var a = st.time * 2 + i * Math.PI * 2 / 3; c.beginPath(); c.moveTo(cx, cy - 4); c.lineTo(cx + Math.cos(a) * 12, cy - 4 + Math.sin(a) * 12); c.stroke(); } break;
      case 'hydro': c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(cx - 14, cy + 12); c.lineTo(cx + 14, cy + 12); c.moveTo(cx - 14, cy + 16); c.lineTo(cx + 14, cy + 16); c.stroke(); break;
      case 'reactor': case 'fusion': c.beginPath(); c.arc(cx, cy, b.type === 'fusion' ? 13 : 10, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fill(); break;
      case 'tachreg': c.beginPath(); c.moveTo(cx, cy - 12); c.lineTo(cx + 10, cy); c.lineTo(cx, cy + 12); c.lineTo(cx - 10, cy); c.closePath(); c.stroke(); break;
      case 'qts': c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill(); break;
      case 'refinery': c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.fill(); break;
      case 'barracks': c.fillRect(cx - 8, cy - 4, 16, 16); break;
      case 'factory': c.beginPath(); c.moveTo(cx - 14, cy + 10); c.lineTo(cx - 7, cy - 4); c.lineTo(cx, cy + 10); c.lineTo(cx + 7, cy - 4); c.lineTo(cx + 14, cy + 10); c.closePath(); c.fill(); break;
      case 'airfield': c.fillStyle = '#3a4149'; c.fillRect(x + 4, y + h / 2 - 5, w - 8, 10); c.fillStyle = '#cfd8e0'; for (var dx = 8; dx < w - 10; dx += 10) c.fillRect(x + dx, y + h / 2 - 1, 6, 2); break;
      case 'tech': c.beginPath(); c.moveTo(cx, cy + 12); c.lineTo(cx, cy - 12); c.stroke(); c.beginPath(); c.arc(cx, cy - 12, 3, 0, Math.PI * 2); c.fill(); break;
      case 'silo': c.beginPath(); c.arc(cx, cy + 4, 12, Math.PI, 0); c.closePath(); c.fill(); c.fillRect(cx - 4, cy + 4, 8, 8); break;
      case 'turret': c.fillRect(cx - 8, cy - 8, 16, 16); c.strokeStyle = '#0d1218'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(b.angle) * 14, cy + Math.sin(b.angle) * 14); c.stroke(); break;
      case 'sam': c.fillRect(cx - 9, cy - 9, 18, 18); c.fillStyle = '#0d1218'; for (var m = 0; m < 4; m++) c.fillRect(cx - 8 + m * 4, cy - 12, 3, 6); break;
      case 'weather': c.beginPath(); c.arc(cx, cy, 12, Math.PI * 0.15 + st.time * 0.3, Math.PI * 0.85 + st.time * 0.3); c.stroke(); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + 12); c.stroke(); break;
      case 'lab': c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx - 4, cy, 2.5, 0, Math.PI * 2); c.arc(cx + 4, cy, 2.5, 0, Math.PI * 2); c.fill(); break;
      case 'diffuser': c.beginPath(); c.arc(cx, cy, 12, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fill(); break;
    }
    if (b.type === 'diffuser' && !b.constructing) {
      c.fillStyle = 'rgba(127,212,255,0.07)';
      c.beginPath(); c.arc(cx, cy, LW.cfg.buildings.diffuser.aura, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(127,212,255,0.25)'; c.setLineDash([4, 6]); c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, LW.cfg.buildings.diffuser.aura, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (b.irradiated > 0) { c.strokeStyle = '#6fe06f'; c.lineWidth = 3; c.strokeRect(x - 2, y - 2, w + 4, h + 4); }
    if (b.constructing) {
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x, y, w, h);
      var pr = bc.time > 0 ? 1 - b.buildLeft / bc.time : 1;
      c.fillStyle = '#e8c832'; c.fillRect(x, y + h - 6, w * pr, 4);
    }
    if (b.offline && !b.constructing) {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x, y, w, h);
      c.fillStyle = '#ffd23c'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.fillText('⚡', cx, cy + 5);
    }
    if (b.hp < b.maxHp) {
      c.fillStyle = '#400'; c.fillRect(x, y - 6, w, 4);
      c.fillStyle = '#58c472'; c.fillRect(x, y - 6, w * Math.max(0, b.hp / b.maxHp), 4);
    }
    var holder = LW.core.holderOf(b.type);
    if (holder && !b.constructing) {
      var r = Math.max(w, h) / 2 + 7;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(255,150,60,0.25)';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      if (b.chargeMax > 0) {
        c.strokeStyle = b.superReady ? '#ff5c3c' : '#ffb347';
        c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (b.charge / b.chargeMax)); c.stroke();
      }
    }
    if (b.rally) {
      c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(b.rally.x, b.rally.y); c.lineTo(b.rally.x, b.rally.y - 12); c.stroke();
      c.fillStyle = '#ff5c5c'; c.beginPath(); c.moveTo(b.rally.x, b.rally.y - 12); c.lineTo(b.rally.x + 8, b.rally.y - 9); c.lineTo(b.rally.x, b.rally.y - 6); c.closePath(); c.fill();
    }
  },

  drawUnit: function (c, u, st, input) {
    var cfg = LW.cfg;
    var fac = cfg.factions[st.sides[u.side].faction];
    c.save();
    c.translate(u.x, u.y);
    c.rotate(u.angle);
    var shape = cfg.units[u.type].shape;
    if (u.cls === 'aircraft') {
      c.fillStyle = fac.color;
      if (shape === 'saucer') {
        c.beginPath(); c.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(0, -3, 4, Math.PI, 0); c.fill();
      } else {
        c.beginPath(); c.moveTo(10, 0); c.lineTo(-8, 6); c.lineTo(-4, 0); c.lineTo(-8, -6); c.closePath(); c.fill();
      }
    } else if (shape === 'blob') {
      c.fillStyle = '#241031';
      c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = fac.color; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(-2.5, -1.5, 1.6, 0, Math.PI * 2); c.arc(2.5, -1.5, 1.6, 0, Math.PI * 2); c.fill();
    } else if (shape === 'orb') {
      c.fillStyle = fac.color;
      c.globalAlpha = 0.55 + 0.3 * Math.sin(st.time * 5 + u.id);
      c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
    } else if (shape === 'hex') {
      c.fillStyle = '#2c1a40';
      c.beginPath();
      for (var hi = 0; hi < 6; hi++) { var ha = hi * Math.PI / 3 + u.angle; var hx = Math.cos(ha) * 10, hy = Math.sin(ha) * 10; if (hi === 0) c.moveTo(hx, hy); else c.lineTo(hx, hy); }
      c.closePath(); c.fill();
      c.strokeStyle = fac.color; c.lineWidth = 2; c.stroke();
    } else if (u.cls === 'vehicle') {
      c.fillStyle = u.type === 'harvester' ? '#c9a44a' : fac.color;
      c.fillRect(-9, -6, 18, 12);
      c.strokeStyle = '#0d1218'; c.lineWidth = 1.5; c.strokeRect(-9, -6, 18, 12);
      if (u.type === 'harvester') { c.fillStyle = '#8a6d2a'; c.fillRect(-6, -3, 12 * Math.min(1, u.carrying / cfg.harvestAmount), 6); }
      else { c.strokeStyle = '#0d1218'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(13, 0); c.stroke(); }
    } else {
      c.fillStyle = u.mutated ? '#6fe06f' : fac.color;
      c.beginPath(); c.arc(0, 0, u.hero ? 8 : 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0d1218'; c.lineWidth = 1.5; c.stroke();
      c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.lineTo(10, 0); c.stroke();
    }
    c.restore();
    if (u.hero) {
      c.strokeStyle = '#ffb347'; c.lineWidth = 2;
      c.beginPath(); c.arc(u.x, u.y, 12, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffb347'; c.font = '10px sans-serif'; c.textAlign = 'center';
      c.fillText(cfg.units[u.type].name, u.x, u.y - 16);
    }
    if (input && input.sel.units.indexOf(u) >= 0) {
      c.strokeStyle = '#fff'; c.setLineDash([3, 3]); c.lineWidth = 1.5;
      c.beginPath(); c.arc(u.x, u.y, 12, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    if (u.hp < u.maxHp) {
      c.fillStyle = '#400'; c.fillRect(u.x - 10, u.y - 16, 20, 3);
      c.fillStyle = u.mutated ? '#6fe06f' : '#58c472'; c.fillRect(u.x - 10, u.y - 16, 20 * Math.max(0, u.hp / u.maxHp), 3);
    }
  },

  draw: function () {
    var st = LW.core.state, input = LW.input, cfg = LW.cfg, map = LW.map;
    var canvas = document.getElementById('game');
    var c = canvas.getContext('2d');
    c.fillStyle = '#0a0d10'; c.fillRect(0, 0, canvas.width, canvas.height);
    var cam = input.cam;
    var shx = (Math.random() - 0.5) * st.shake, shy = (Math.random() - 0.5) * st.shake;
    c.save();
    c.translate(-cam.x + shx, -cam.y + shy);
    c.drawImage(this.terrain, 0, 0);
    var i;
    for (i = 0; i < map.oreTiles.length; i++) {
      var ti = map.oreTiles[i];
      if (map.ore[ti] > 0) this.drawResource(c, ti);
    }
    for (i = 0; i < st.decals.length; i++) {
      var d = st.decals[i];
      c.fillStyle = 'rgba(12,9,6,0.55)';
      c.beginPath(); c.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, Math.PI * 2); c.fill();
    }
    for (i = 0; i < st.singularities.length; i++) {
      var sg = st.singularities[i];
      c.fillStyle = 'rgba(120,60,200,0.10)';
      c.beginPath(); c.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(150,80,255,0.35)'; c.setLineDash([4, 6]); c.lineWidth = 1;
      c.beginPath(); c.arc(sg.x, sg.y, sg.r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      var acc = sg.core * 2 * (1 + 0.15 * Math.sin(st.time * 6));
      c.strokeStyle = '#b46bff'; c.lineWidth = 3;
      c.beginPath(); c.arc(sg.x, sg.y, acc, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#000';
      c.beginPath(); c.arc(sg.x, sg.y, sg.core, 0, Math.PI * 2); c.fill();
    }
    for (i = 0; i < st.beams.length; i++) {
      var bm = st.beams[i];
      var ba = Math.max(0, bm.left / bm.max);
      c.strokeStyle = 'rgba(170,240,255,' + (0.9 * ba) + ')';
      c.lineWidth = 2 + 9 * ba;
      c.beginPath(); c.moveTo(bm.x1, bm.y1); c.lineTo(bm.x2, bm.y2); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,' + (0.8 * ba) + ')';
      c.lineWidth = 2 * ba;
      c.beginPath(); c.moveTo(bm.x1, bm.y1); c.lineTo(bm.x2, bm.y2); c.stroke();
    }
    for (i = 0; i < st.storms.length; i++) {
      var sm = st.storms[i];
      c.fillStyle = 'rgba(180,107,255,0.13)';
      c.beginPath(); c.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(200,140,255,0.6)'; c.setLineDash([6, 6]); c.lineWidth = 2;
      c.beginPath(); c.arc(sm.x, sm.y, sm.r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    var bs = [];
    for (var sk in st.sides) bs = bs.concat(st.sides[sk].buildings);
    bs.sort(function (a, b2) { return a.y - b2.y; });
    for (i = 0; i < bs.length; i++) this.drawBuilding(c, bs[i], st);
    var us = [];
    for (sk in st.sides) us = us.concat(st.sides[sk].units);
    us.sort(function (a, b2) { return a.y - b2.y; });
    for (i = 0; i < us.length; i++) this.drawUnit(c, us[i], st, input);
    for (i = 0; i < st.projectiles.length; i++) {
      var p = st.projectiles[i];
      c.fillStyle = p.side === 'player' ? '#bfefff' : '#e0b3ff';
      c.beginPath(); c.arc(p.x, p.y, 2.5, 0, Math.PI * 2); c.fill();
    }
    for (i = 0; i < st.missiles.length; i++) {
      var m = st.missiles[i];
      c.save();
      c.translate(m.px, m.py);
      c.rotate(Math.atan2(m.ty - m.y, m.tx - m.x));
      c.fillStyle = '#d8dee6'; c.fillRect(-10, -3, 18, 6);
      c.fillStyle = '#ff5c3c'; c.beginPath(); c.moveTo(8, -3); c.lineTo(14, 0); c.lineTo(8, 3); c.closePath(); c.fill();
      c.restore();
    }
    for (i = 0; i < st.particles.length; i++) {
      var pt = st.particles[i];
      c.globalAlpha = Math.max(0, pt.life / pt.max);
      if (pt.bolt) {
        c.strokeStyle = pt.color; c.lineWidth = 2;
        c.beginPath(); c.moveTo(pt.x, pt.y); c.lineTo(pt.x2, pt.y2); c.stroke();
      } else {
        c.fillStyle = pt.color;
        c.beginPath(); c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    }
    if (input.placing) {
      var key = input.placing, b = cfg.buildings[key];
      var tx = Math.floor(input.mouse.wx / cfg.tile), ty = Math.floor(input.mouse.wy / cfg.tile);
      var ok = LW.core.canPlaceAt('player', key, tx, ty).ok && st.sides.player.credits >= b.cost;
      c.fillStyle = ok ? 'rgba(80,220,120,0.35)' : 'rgba(230,60,50,0.35)';
      c.fillRect(tx * cfg.tile, ty * cfg.tile, b.size * cfg.tile, b.size * cfg.tile);
      c.strokeStyle = ok ? '#58c472' : '#e04030'; c.lineWidth = 2;
      c.strokeRect(tx * cfg.tile, ty * cfg.tile, b.size * cfg.tile, b.size * cfg.tile);
      c.fillStyle = ok ? '#baffd0' : '#ffc4bc'; c.font = '12px sans-serif'; c.textAlign = 'left';
      c.fillText(b.name + ' (' + b.cost + ' Cr)', tx * cfg.tile, ty * cfg.tile - 6);
    }
    if (input.targetB) {
      c.strokeStyle = '#ff5c3c'; c.lineWidth = 2;
      c.beginPath(); c.arc(input.mouse.wx, input.mouse.wy, 14, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(input.mouse.wx - 20, input.mouse.wy); c.lineTo(input.mouse.wx + 20, input.mouse.wy);
      c.moveTo(input.mouse.wx, input.mouse.wy - 20); c.lineTo(input.mouse.wx, input.mouse.wy + 20); c.stroke();
    }
    c.restore();
    if (input.drag && input.drag.moved) {
      var d = input.drag;
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
      c.strokeRect(Math.min(d.x1, d.x2), Math.min(d.y1, d.y2), Math.abs(d.x2 - d.x1), Math.abs(d.y2 - d.y1));
    }
  },

  drawMinimap: function (cv) {
    var st = LW.core.state, cfg = LW.cfg, map = LW.map, input = LW.input;
    var c = cv.getContext('2d');
    var s = cv.width / (map.W * cfg.tile);
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(this.terrain, 0, 0, cv.width, cv.height);
    var i, sk;
    for (i = 0; i < map.oreTiles.length; i++) {
      var ti = map.oreTiles[i];
      if (map.ore[ti] <= 0) continue;
      var col = cfg.resources[map.resKind[ti]] ? cfg.resources[map.resKind[ti]].color : '#e8c832';
      c.fillStyle = col;
      c.fillRect((ti % map.W) * cfg.tile * s, Math.floor(ti / map.W) * cfg.tile * s, 2, 2);
    }
    for (sk in st.sides) {
      var fac = cfg.factions[st.sides[sk].faction];
      c.fillStyle = fac.color;
      var bs = st.sides[sk].buildings;
      for (i = 0; i < bs.length; i++) c.fillRect(bs[i].tx * cfg.tile * s, bs[i].ty * cfg.tile * s, Math.max(2, bs[i].w * cfg.tile * s), Math.max(2, bs[i].h * cfg.tile * s));
      var us = st.sides[sk].units;
      for (i = 0; i < us.length; i++) c.fillRect(us[i].x * s - 1, us[i].y * s - 1, 2, 2);
    }
    for (i = 0; i < st.storms.length; i++) {
      c.strokeStyle = '#c9a2ff';
      c.beginPath(); c.arc(st.storms[i].x * s, st.storms[i].y * s, st.storms[i].r * s, 0, Math.PI * 2); c.stroke();
    }
    var canvas = document.getElementById('game');
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
    c.strokeRect(input.cam.x * s, input.cam.y * s, canvas.width * s, canvas.height * s);
  },
};
