var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

window.addEventListener('load', function () {
  try {
  var seed = (Date.now() % 2147483647) | 0;
  LW.core.init(seed);
  LW.render.init();
  LW.ui.build();
  LW.input.init();
  var hq = LW.core.state.sides.player.buildings.find(function (b) { return b.type === 'hq'; });
  if (hq) LW.input.centerOn(hq);
  document.getElementById('btn-restart').addEventListener('click', function () { location.reload(); });
  document.getElementById('btn-mute').addEventListener('click', function () {
    if (!LW.audio) return;
    LW.audio.muted = !LW.audio.muted;
    this.textContent = LW.audio.muted ? '🔇' : '🔊';
  });
  var use3d = false;
  var initP;
  try {
    initP = (LW.render3d && LW.render3d.init) ? LW.render3d.init(document.getElementById('game')) : Promise.resolve(false);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('WebGPU init fehlgeschlagen, 2D-Fallback:', e);
    initP = Promise.resolve(false);
  }
  Promise.resolve(initP).then(function (ok) {
    use3d = !!ok;
    if (LW.render3d) LW.render3d.active = use3d;
    if (!use3d && typeof console !== 'undefined') console.info('WebGPU nicht verfügbar — 2D-Canvas-Fallback aktiv.');
    var badge = document.createElement('span');
    badge.className = 'tb-item';
    badge.id = 'tb-mode';
    badge.textContent = use3d ? '3D (WebGPU/Vulkan)' : '2D-Fallback';
    badge.style.color = use3d ? '#9fe6a0' : '#ffd23c';
    document.getElementById('topbar').appendChild(badge);
    var last = performance.now(), acc = 0;
    function frame(now) {
      var dt = (now - last) / 1000;
      last = now;
      acc += dt;
      var steps = 0;
      while (acc >= 1 / 60 && steps < 5) {
        LW.core.tick(1 / 60);
        LW.input.update(1 / 60);
        acc -= 1 / 60;
        steps++;
      }
      if (acc > 0.25) acc = 0.25;
      if (LW.render3d && LW.render3d.active) LW.render3d.draw();
      else LW.render.draw();
      LW.ui.update();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }).catch(function (err) {
    var d = document.getElementById('errbanner');
    if (!d) { d = document.createElement('div'); d.id = 'errbanner'; document.body.appendChild(d); }
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#a02020;color:#fff;padding:6px 10px;font:13px monospace;z-index:999;';
    d.textContent = 'Boot-Fehler: ' + (err && err.stack ? err.stack : err);
    if (typeof console !== 'undefined') console.error(err);
  });
  } catch (err) {
    if (typeof console !== 'undefined') console.error(err);
    var d = document.getElementById('errbanner');
    if (!d) { d = document.createElement('div'); d.id = 'errbanner'; document.body.appendChild(d); }
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#a02020;color:#fff;padding:6px 10px;font:13px monospace;z-index:999;';
    d.textContent = 'Boot-Fehler: ' + (err && err.stack ? err.stack : err);
  }
});
