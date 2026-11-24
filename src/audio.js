var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.audio = {
  ctx: null, muted: false,
  ensure: function () {
    if (!this.ctx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
  },
  beep: function (f, d, type, g, slide) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + d);
    gn.gain.setValueAtTime(g || 0.05, t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gn); gn.connect(this.ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  noise: function (d, fc) {
    if (!this.ctx || this.muted) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * d);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var ch = buf.getChannelData(0);
    for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = this.ctx.createBufferSource(); src.buffer = buf;
    var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc || 800;
    var g = this.ctx.createGain(); g.gain.value = 0.22;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start(t);
  },
  play: function (name) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'select': this.beep(520, 0.05, 'square', 0.03); break;
      case 'build': this.beep(660, 0.09, 'triangle', 0.06); this.beep(880, 0.1, 'triangle', 0.05); break;
      case 'ready': this.beep(880, 0.12, 'sawtooth', 0.06); this.beep(1174, 0.2, 'sawtooth', 0.06); break;
      case 'launch': this.beep(300, 0.5, 'sawtooth', 0.06, 90); break;
      case 'explosion': this.noise(0.7, 500); break;
      case 'storm': this.noise(0.4, 3000); break;
      case 'error': this.beep(150, 0.15, 'square', 0.05); break;
    }
  },
};
