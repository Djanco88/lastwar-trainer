var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.ui = {
  btns: { build: {}, unit: {}, research: {} },
  throttle: 0,
  overlayShown: false,

  keyLabel: function (kind, key) {
    for (var k in LW.cfg.keys) {
      var v = LW.cfg.keys[k];
      if (v[0] === kind && v[1] === key) return k.toUpperCase();
    }
    return '';
  },

  mkBtn: function (kind, key, label, cost, desc) {
    var b = document.createElement('button');
    b.className = 'gbtn';
    b.dataset.kind = kind; b.dataset.key = key;
    var kl = this.keyLabel(kind, key);
    b.innerHTML = '<span class="key">' + kl + '</span>' + label +
      (cost != null ? '<br><span class="cost">' + cost + ' Cr</span>' : '') +
      (desc ? '<span class="req">' + desc + '</span>' : '');
    b.title = label;
    var self = this;
    b.addEventListener('click', function () { LW.input.onAction(kind, key); });
    return b;
  },

  build: function () {
    var cfg = LW.cfg, sb = document.getElementById('sidebar');
    var html = '';
    html += '<h3>Bauen</h3><div class="btn-grid" id="sec-build"></div>';
    html += '<h3>Einheiten</h3><div class="btn-grid" id="sec-units"></div>';
    html += '<h3>Forschung</h3><div class="btn-grid" id="sec-res"></div>';
    html += '<h3>Superwaffen</h3><div id="superlist"></div>';
    html += '<h3>Auswahl</h3><div id="selinfo"></div>';
    html += '<canvas id="minimap" width="232" height="174"></canvas>';
    html += '<div id="hint">Linksklick: auswählen / bauen<br>Rechtsklick: bewegen / angreifen / Rohstoff abbauen (Sammler)<br>Ziehen: Box-Auswahl<br>Kamera: WASD / Pfeile / Bildschirmrand (nur bei Maus am Rand)<br>Mausrad: Zoom<br>H: Sprung zum HQ<br>Esc: Abbrechen<br>Hotkeys siehe Buttons. Superwaffe: N, dann Ziel klicken.</div>';
    sb.innerHTML = html;
    var secB = document.getElementById('sec-build'), secU = document.getElementById('sec-units'), secR = document.getElementById('sec-res');
    var k;
    for (k in cfg.buildings) {
      if (k === 'hq') continue;
      var b = cfg.buildings[k];
      var req = b.req ? 'ab ' + cfg.buildings[b.req].name : '';
      if (b.faction === 'human') req = (req ? req + ' · ' : '') + 'Menschen';
      if (b.faction === 'alien') req = (req ? req + ' · ' : '') + 'Aliens';
      var btn = this.mkBtn('build', k, b.name, b.cost, req);
      btn.title = b.name + ' — ' + b.desc + (req ? ' [' + req + ']' : '');
      secB.appendChild(btn);
      this.btns.build[k] = btn;
    }
    for (k in cfg.units) {
      var u = cfg.units[k];
      var ureq = [];
      if (u.req) ureq.push(cfg.buildings[u.req].name);
      ureq.push(cfg.buildings[u.prod].name);
      if (u.faction === 'human') ureq.push('Menschen');
      if (u.faction === 'alien') ureq.push('Aliens');
      var ubtn = this.mkBtn('unit', k, (u.hero ? '★ ' : '') + u.name, u.cost, ureq.join(' + '));
      ubtn.title = u.name + ' — ' + (u.desc || ('Produktion: ' + cfg.buildings[u.prod].name)) + ' [' + ureq.join(', ') + ']';
      secU.appendChild(ubtn);
      this.btns.unit[k] = ubtn;
    }
    for (k in cfg.research) {
      var r = cfg.research[k];
      var rreq = r.req ? 'ab ' + cfg.buildings[r.req].name : 'Tech-Zentrum';
      if (r.faction === 'human') rreq += ' · Menschen';
      if (r.faction === 'alien') rreq += ' · Aliens';
      var rbtn = this.mkBtn('research', k, r.name, r.cost, rreq);
      rbtn.title = r.name + ' — ' + r.desc;
      secR.appendChild(rbtn);
      this.btns.research[k] = rbtn;
    }
  },

  update: function () {
    var st = LW.core.state, cfg = LW.cfg, input = LW.input, p = st.sides.player;
    document.getElementById('tb-credits').textContent = 'Credits: ' + Math.floor(p.credits);
    document.getElementById('tb-income').textContent = p.research.solar ? '+' + cfg.solarIncome + '/s (Solarsatellit)' : '';
    document.getElementById('tb-units').textContent = 'Einheiten: ' + p.units.length + ' · Gebäude: ' + p.buildings.length;
    var pw = document.getElementById('tb-power');
    if (!pw) {
      pw = document.createElement('span');
      pw.className = 'tb-item'; pw.id = 'tb-power';
      document.getElementById('topbar').insertBefore(pw, document.getElementById('tb-units'));
    }
    pw.textContent = 'Strom: ' + p.powerSupply + '/' + p.powerDemand;
    pw.style.color = p.powerSupply < p.powerDemand ? '#ff8a7a' : '#9fe6a0';
    if (p.faction === 'alien') pw.textContent += ' · Neutrinos: ' + Math.floor(p.neutrinos || 0);
    var t = Math.floor(st.time);
    document.getElementById('tb-time').textContent = Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);

    this.throttle -= 1 / 60;
    if (this.throttle <= 0) {
      this.throttle = 0.12;
      var k;
      for (k in this.btns.build) {
        var b = cfg.buildings[k];
        var cb = LW.core.canBuild('player', k);
        var btn = this.btns.build[k];
        btn.disabled = !cb.ok || p.credits < b.cost;
        btn.classList.toggle('active', input.placing === k);
        btn.title = b.name + ' — ' + b.desc + (cb.ok ? '' : ' [' + cb.reason + ']');
      }
      for (k in this.btns.unit) {
        var u = cfg.units[k];
        var cp = LW.core.canProduce('player', k);
        var ubtn = this.btns.unit[k];
        ubtn.disabled = !cp.ok || p.credits < u.cost;
        ubtn.classList.toggle('done', !!u.hero && p.units.some(function (x) { return x.type === k; }));
        ubtn.title = u.name + ' — ' + (u.desc || '') + (cp.ok ? '' : ' [' + cp.reason + ']');
      }
      for (k in this.btns.research) {
        var r = cfg.research[k];
        var cr = LW.core.canResearch('player', k);
        var rbtn = this.btns.research[k];
        rbtn.disabled = !cr.ok || p.credits < r.cost;
        rbtn.classList.toggle('done', !!p.research[k]);
        rbtn.title = r.name + ' — ' + r.desc + (cr.ok ? '' : ' [' + cr.reason + ']');
      }
      this.updateSuper(st);
      this.updateSel(st, input);
    }

    var msg = document.getElementById('messages');
    var html = '';
    var evs = st.events.slice(-5);
    for (var i = 0; i < evs.length; i++) {
      var age = st.time - evs[i].t;
      var op = age > 9 ? 0.25 : 1;
      html += '<div class="' + (evs[i].kind || '') + '" style="opacity:' + op + '">' + evs[i].text + '</div>';
    }
    msg.innerHTML = html;

    var mm = document.getElementById('minimap');
    if (mm) LW.render.drawMinimap(mm);

    if (st.over && !this.overlayShown) {
      this.overlayShown = true;
      var ov = document.getElementById('overlay');
      document.getElementById('overlay-title').textContent = st.over === 'win' ? 'SIEG!' : 'NIEDERLAGE';
      document.getElementById('overlay-title').style.color = st.over === 'win' ? '#58c472' : '#ff5c5c';
      document.getElementById('overlay-text').textContent = st.over === 'win'
        ? 'Das Xylith-Kollektiv wurde besiegt. Dauer: ' + Math.floor(st.time) + 's.'
        : 'Ihre Kommandozentrale wurde zerstört. Dauer: ' + Math.floor(st.time) + 's.';
      ov.classList.remove('hidden');
    }
  },

  updateSuper: function (st) {
    var cfg = LW.cfg, p = st.sides.player;
    var el = document.getElementById('superlist');
    var html = '';
    var any = false;
    for (var i = 0; i < p.buildings.length; i++) {
      var b = p.buildings[i];
      var holder = LW.core.holderOf(b.type);
      if (!holder || b.constructing) continue;
      any = true;
      var supName = b.superKey ? cfg.super[b.superKey].name : '—';
      var frac = b.chargeMax > 0 ? b.charge / b.chargeMax : 0;
      html += '<div class="super-row"><b>' + cfg.buildings[b.type].name + '</b><br>' +
        '<span style="font-size:10px;color:#9fb4c6">' + supName + (b.offline ? ' · offline (Strom!)' : '') + '</span>' +
        '<div class="bar"><div style="width:' + (frac * 100).toFixed(1) + '%"></div></div>' +
        '<button data-bid="' + b.id + '" data-which="1"' + (b.superReady ? ' class="armed"' : ' disabled') + '>ZIEL WÄHLEN</button></div>';
      if (b.super2) {
        var s2 = b.super2;
        var f2 = s2.chargeMax > 0 ? s2.charge / s2.chargeMax : 0;
        html += '<div class="super-row" style="margin-top:4px"><span style="font-size:10px;color:#c9a2ff">' + cfg.super[s2.key].name + '</span>' +
          '<div class="bar"><div style="width:' + (f2 * 100).toFixed(1) + '%"></div></div>' +
          '<button data-bid="' + b.id + '" data-which="2"' + (s2.ready ? ' class="armed"' : ' disabled') + '>STRAHL-ZIEL WÄHLEN</button></div>';
      }
    }
    if (!any) html = '<div style="color:#7f96ab;font-size:11px">Noch kein Superwaffen-Gebäude gebaut.</div>';
    el.innerHTML = html;
    var btns = el.querySelectorAll('button[data-bid]');
    for (i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () { LW.input.startTarget(parseInt(this.dataset.bid, 10), this.dataset.which || '1'); });
    }
  },

  updateSel: function (st, input) {
    var cfg = LW.cfg, el = document.getElementById('selinfo');
    var b = input.sel.building, us = input.sel.units;
    if (b) {
      var bc = cfg.buildings[b.type];
      var html = '<b>' + bc.name + '</b> ' + (b.constructing ? '(baut… ' + Math.ceil(b.buildLeft) + 's)' : (b.offline ? '<span style="color:#ffd23c">⚡ offline</span>' : '')) +
        '<div class="bar"><div style="width:' + Math.max(0, (b.hp / b.maxHp) * 100) + '%"></div></div>' +
        '<span style="font-size:10px">' + Math.ceil(b.hp) + '/' + b.maxHp + ' HP</span>';
      if (b.queue.length) {
        html += '<div style="margin-top:3px">';
        for (var i = 0; i < b.queue.length; i++) {
          var q = b.queue[i];
          var nm = q.kind === 'unit' ? cfg.units[q.key].name : q.kind === 'research' ? cfg.research[q.key].name : 'Kreuzung ' + cfg.units[q.a].name + '×' + cfg.units[q.b].name;
          var pr = q.max > 0 ? Math.min(1, 1 - q.left / q.max) : 0;
          html += '<div class="qitem">' + nm + ' ' + Math.round(pr * 100) + '%</div>';
        }
        html += '</div>';
      }
      var holder = LW.core.holderOf(b.type);
      if (holder && !b.constructing) {
        var frac = b.chargeMax > 0 ? b.charge / b.chargeMax : 0;
        html += '<div style="margin-top:4px;font-size:10px">Superwaffe: ' + (b.superKey ? cfg.super[b.superKey].name : '—') + (b.superReady ? ' <b style="color:#ff5c3c">BEREIT</b>' : '') +
          '<div class="bar"><div style="width:' + (frac * 100) + '%"></div></div></div>';
      }
      el.innerHTML = html;
    } else if (us.length) {
      var hp = 0, mx = 0;
      for (var j = 0; j < us.length; j++) { hp += us[j].hp; mx += us[j].maxHp; }
      el.innerHTML = '<b>' + us.length + ' Einheit(en)</b><div class="bar"><div style="width:' + (mx > 0 ? (hp / mx * 100) : 0) + '%"></div></div>' +
        '<span style="font-size:10px;color:#9fb4c6">' + us.map(function (u) { return cfg.units[u.type].name + (u.mutated ? ' (mutiert)' : ''); }).join(', ').slice(0, 120) + '</span>';
    } else {
      el.innerHTML = '<span style="color:#7f96ab">Nichts ausgewählt.</span>';
    }
  },
};
