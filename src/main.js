var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

window.addEventListener('load', function () {
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
    LW.render.draw();
    LW.ui.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
