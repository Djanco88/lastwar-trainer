var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.ai = {
  think: function (st) {
    var cfg = LW.cfg, core = LW.core, s = st.sides.enemy, p = st.sides.player;
    var has = function (t, doneOnly) {
      return s.buildings.some(function (b) { return b.type === t && (!doneOnly || !b.constructing); });
    };
    var done = function (t) { return has(t, true); };
    var hq = null, i;
    for (i = 0; i < s.buildings.length; i++) if (s.buildings[i].type === 'hq') hq = s.buildings[i];
    if (!hq) return;

    if (s.powerDemand > s.powerSupply && s.credits >= cfg.buildings.plant.cost) {
      var sp0 = core.findSpot(2, 2, hq.x, hq.y, 12);
      if (sp0) core.placeBuilding('enemy', 'plant', sp0.tx, sp0.ty);
    }

    if (!has('refinery') && s.credits >= cfg.buildings.refinery.cost) {
      var ore = core.nearestOre(hq.x, hq.y), spot = null;
      if (ore >= 0) {
        var otx = (ore % LW.map.W + 0.5) * cfg.tile, oty = (Math.floor(ore / LW.map.W) + 0.5) * cfg.tile;
        spot = core.findSpot(3, 3, otx, oty, 7);
      }
      if (!spot) spot = core.findSpot(3, 3, hq.x, hq.y, 10);
      if (spot) core.placeBuilding('enemy', 'refinery', spot.tx, spot.ty);
    }

    for (i = 0; i < cfg.ai.buildOrder.length; i++) {
      var key = cfg.ai.buildOrder[i];
      if (!has(key)) {
        var b = cfg.buildings[key];
        if (s.credits >= b.cost && (!b.req || has(b.req))) {
          var sp = core.findSpot(b.size, b.size, hq.x, hq.y, 13);
          if (sp) core.placeBuilding('enemy', key, sp.tx, sp.ty);
        }
        break;
      }
    }

    var harvesters = s.units.filter(function (u) { return u.type === 'harvester'; }).length;
    var factory = s.buildings.find(function (b) { return b.type === 'factory' && !b.constructing; });
    if (factory && harvesters < cfg.ai.harvesters && s.credits >= cfg.units.harvester.cost) core.queueUnit('enemy', factory.id, 'harvester');

    var rax = s.buildings.find(function (b) { return b.type === 'barracks' && !b.constructing; });
    if (rax && rax.queue.length < 2) {
      var larves = s.units.filter(function (u) { return u.type === 'larve'; }).length;
      var spitters = s.units.filter(function (u) { return u.type === 'spitter'; }).length;
      if (done('tech') && s.credits >= cfg.units.spitter.cost && spitters <= larves) core.queueUnit('enemy', rax.id, 'spitter');
      else if (s.credits >= cfg.units.larve.cost) core.queueUnit('enemy', rax.id, 'larve');
    }
    if (factory && factory.queue.length < 2 && s.credits >= cfg.units.carapax.cost + 600) core.queueUnit('enemy', factory.id, 'carapax');

    var af = s.buildings.find(function (b) { return b.type === 'airfield' && !b.constructing; });
    if (af && af.queue.length < 1 && s.credits >= cfg.units.wespe.cost + 500) core.queueUnit('enemy', af.id, 'wespe');

    var lab = s.buildings.find(function (b) { return b.type === 'lab' && !b.constructing; });
    if (lab && lab.queue.length === 0 && s.credits >= cfg.cross.cost + 800) {
      if (!st.aiCrossed) st.aiCrossed = {};
      var bases = ['larve', 'spitter', 'carapax', 'wespe'], pairs = [], a, bb;
      for (a = 0; a < bases.length; a++) for (bb = a + 1; bb < bases.length; bb++) {
        if (!st.aiCrossed[bases[a] + '_' + bases[bb]]) pairs.push([bases[a], bases[bb]]);
      }
      if (pairs.length && core.rng() < 0.5) {
        var pr = LW.util.pick(core.rng, pairs);
        st.aiCrossed[pr[0] + '_' + pr[1]] = true;
        core.crossUnits('enemy', lab.id, pr[0], pr[1]);
      }
    }

    var tech = s.buildings.find(function (b) { return b.type === 'tech' && !b.constructing; });
    if (tech && tech.queue.length === 0) {
      for (i = 0; i < cfg.ai.researchOrder.length; i++) {
        var rk = cfg.ai.researchOrder[i], r = cfg.research[rk];
        if (!s.research[rk] && s.credits >= r.cost && (!r.req || has(r.req))) { core.queueResearch('enemy', tech.id, rk); break; }
      }
    }

    var army = s.units.filter(function (u) { return u.type !== 'harvester'; });
    if (st.time >= st.aiNextWave && army.length >= cfg.ai.waveMin && p.buildings.length) {
      var t = p.buildings.find(function (b) { return b.type === 'hq'; }) || p.buildings[0];
      for (i = 0; i < army.length; i++) { army[i].state = 'attack'; army[i].targetId = t.id; army[i].tx = t.x; army[i].ty = t.y; }
      core.pushEvent('Das Xylith-Kollektiv greift an!', 'warn');
      if (LW.audio) LW.audio.play('ready');
      st.aiNextWave = st.time + cfg.ai.waveInterval;
    }

    var intr = null;
    for (i = 0; i < p.units.length; i++) {
      if (LW.util.dist(p.units[i].x, p.units[i].y, hq.x, hq.y) < 14 * cfg.tile) { intr = p.units[i]; break; }
    }
    if (intr) for (i = 0; i < army.length; i++) if (army[i].state === 'idle') { army[i].state = 'attack'; army[i].targetId = intr.id; }

    for (i = 0; i < s.buildings.length; i++) {
      var b2 = s.buildings[i];
      if (b2.superReady && p.buildings.length) {
        var t2 = p.buildings.find(function (x) { return x.type === 'hq'; }) || p.buildings[0];
        core.launchSuper('enemy', b2.id, t2.x + (core.rng() * 60 - 30), t2.y + (core.rng() * 60 - 30));
      }
    }
  },
};
