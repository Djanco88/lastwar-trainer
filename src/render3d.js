var LW = (typeof window !== 'undefined' ? (window.LW = window.LW || {}) : (globalThis.LW = globalThis.LW || {}));

LW.render3d = {
  active: false,
  ready: false,
  canvas: null, device: null, ctx: null, format: null, depthTex: null,
  pipeOpaque: null, pipeTrans: null, pipeParts: null,
  uBuf: null, bindGroup: null,
  geoBox: null, geoOcta: null, geoQuad: null, geoTerrain: null, geoWater: null,
  staticInst: null, waterInst: null, rockBuf: null, rockCount: 0,
  dynBO: null, dynBOcap: 0, dynOO: null, dynOOcap: 0, dynBT: null, dynBTcap: 0, dynOT: null, dynOTcap: 0, partBuf: null, partCap: 0,
  eye: [0, 1000, -800], fwd: [0, -0.78, -0.62], right: [1, 0, 0], upv: [0, 0.62, -0.78],
  halfW: 500, halfH: 300, vw: 800, vh: 600,

  init: function (canvas) {
    var self = this;
    if (typeof navigator === 'undefined' || !navigator.gpu || typeof document === 'undefined') return Promise.resolve(false);
    if (typeof location !== 'undefined' && location.protocol === 'file:') return Promise.resolve(false);
    this.canvas = canvas;
    return navigator.gpu.requestAdapter().then(function (adapter) {
      if (!adapter) return false;
      return adapter.requestDevice().then(function (device) {
        self.device = device;
        device.onuncapturederror = function (ev) {
          if (typeof console !== 'undefined') console.warn('WebGPU uncaptured error:', ev.error && ev.error.message);
        };
        self.ctx = canvas.getContext('webgpu');
        if (!self.ctx) return false;
        self.format = navigator.gpu.getPreferredCanvasFormat();
        self.ctx.configure({ device: device, format: self.format, alphaMode: 'opaque' });
        self.buildPipelines();
        self.buildGeometry();
        self.ready = true;
        return true;
      });
    }).catch(function () { return false; });
  },

  buildPipelines: function () {
    var dev = this.device;
    var uLayout = dev.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUBufferUsage ? 0x30 : 0x30, buffer: { type: 'uniform' } }],
    });
    var uBuf = dev.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.uBuf = uBuf;
    this.bindGroup = dev.createBindGroup({ layout: uLayout, entries: [{ binding: 0, resource: { buffer: uBuf } }] });
    this.pipeLayout = dev.createPipelineLayout({ bindGroupLayouts: [uLayout] });

    var modMesh = dev.createShaderModule({
      code: [
        'struct U { viewProj: mat4x4f, lightDir: vec4f, camRight: vec4f, camUp: vec4f };',
        '@group(0) @binding(0) var<uniform> U: U;',
        'struct VOut { @builtin(position) cp: vec4f, @location(0) col: vec4f, @location(1) nrm: vec3f };',
        '@vertex fn vs(@location(0) pos: vec3f, @location(1) nrm: vec3f, @location(2) vcol: vec3f,',
        '  @location(3) m0: vec4f, @location(4) m1: vec4f, @location(5) m2: vec4f, @location(6) m3: vec4f, @location(7) icol: vec4f) -> VOut {',
        '  let m = mat4x4f(m0, m1, m2, m3);',
        '  let wp = m * vec4f(pos, 1.0);',
        '  var o: VOut;',
        '  o.cp = U.viewProj * wp;',
        '  o.col = vec4f(vcol, 1.0) * icol;',
        '  o.nrm = (m * vec4f(nrm, 0.0)).xyz;',
        '  return o;',
        '}',
        '@fragment fn fs(o: VOut) -> @location(0) vec4f {',
        '  let l = max(dot(normalize(o.nrm), normalize(U.lightDir.xyz)), 0.0);',
        '  let sh = 0.55 + 0.45 * l;',
        '  return vec4f(o.col.rgb * sh, o.col.a);',
        '}',
      ].join('\n'),
    });
    var modPart = dev.createShaderModule({
      code: [
        'struct U { viewProj: mat4x4f, lightDir: vec4f, camRight: vec4f, camUp: vec4f };',
        '@group(0) @binding(0) var<uniform> U: U;',
        'struct VOut { @builtin(position) cp: vec4f, @location(0) col: vec4f };',
        '@vertex fn vs(@location(0) corner: vec2f, @location(1) ppos: vec3f, @location(2) psize: f32, @location(3) pcol: vec4f) -> VOut {',
        '  let w = ppos + (U.camRight.xyz * corner.x + U.camUp.xyz * corner.y) * psize;',
        '  var o: VOut; o.cp = U.viewProj * vec4f(w, 1.0); o.col = pcol; return o;',
        '}',
        '@fragment fn fs(o: VOut) -> @location(0) vec4f { return o.col; }',
      ].join('\n'),
    });

    var geoLayout = {
      arrayStride: 36,
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32x3' },
      ],
    };
    var instLayout = {
      arrayStride: 80,
      stepMode: 'instance',
      attributes: [
        { shaderLocation: 3, offset: 0, format: 'float32x4' },
        { shaderLocation: 4, offset: 16, format: 'float32x4' },
        { shaderLocation: 5, offset: 32, format: 'float32x4' },
        { shaderLocation: 6, offset: 48, format: 'float32x4' },
        { shaderLocation: 7, offset: 64, format: 'float32x4' },
      ],
    };
    var depthStencil = { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' };
    var blend = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    this.pipeOpaque = dev.createRenderPipeline({
      layout: this.pipeLayout,
      vertex: { module: modMesh, entryPoint: 'vs', buffers: [geoLayout, instLayout] },
      fragment: { module: modMesh, entryPoint: 'fs', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: depthStencil,
    });
    this.pipeTrans = dev.createRenderPipeline({
      layout: this.pipeLayout,
      vertex: { module: modMesh, entryPoint: 'vs', buffers: [geoLayout, instLayout] },
      fragment: { module: modMesh, entryPoint: 'fs', targets: [{ format: this.format, blend: blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' },
    });
    var quadLayout = { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] };
    var partInstLayout = {
      arrayStride: 32, stepMode: 'instance',
      attributes: [
        { shaderLocation: 1, offset: 0, format: 'float32x3' },
        { shaderLocation: 2, offset: 12, format: 'float32' },
        { shaderLocation: 3, offset: 16, format: 'float32x4' },
      ],
    };
    this.pipeParts = dev.createRenderPipeline({
      layout: this.pipeLayout,
      vertex: { module: modPart, entryPoint: 'vs', buffers: [quadLayout, partInstLayout] },
      fragment: { module: modPart, entryPoint: 'fs', targets: [{ format: this.format, blend: blend }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less-equal' },
    });
    this.staticInst = dev.createBuffer({ size: 80, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    var id = new Float32Array(20);
    id[0] = 1; id[5] = 1; id[10] = 1; id[15] = 1; id[16] = 1; id[17] = 1; id[18] = 1; id[19] = 1;
    dev.queue.writeBuffer(this.staticInst, 0, id);
    this.waterInst = dev.createBuffer({ size: 80, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    var wi = new Float32Array(20);
    wi[0] = 1; wi[5] = 1; wi[10] = 1; wi[15] = 1; wi[16] = 1; wi[17] = 1; wi[18] = 1; wi[19] = 0.8;
    dev.queue.writeBuffer(this.waterInst, 0, wi);
  },

  pushBoxVerts: function (arr, cx, cy, cz, hx, hy, hz, n) {
    var faces = [
      [[1, 0, 0], [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]]],
      [[-1, 0, 0], [[-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-hx, -hy, -hz]]],
      [[0, 1, 0], [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]]],
      [[0, -1, 0], [[-hx, -hy, hz], [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz]]],
      [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
      [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
    ];
    for (var f = 0; f < 6; f++) {
      var nrm = faces[f][0], cs = faces[f][1];
      var idx = [0, 1, 2, 0, 2, 3];
      for (var k = 0; k < 6; k++) {
        var c = cs[idx[k]];
        arr.push(cx + c[0], cy + c[1], cz + c[2], nrm[0], nrm[1], nrm[2], 1, 1, 1);
      }
    }
  },

  buildGeometry: function () {
    var dev = this.device, cfg = LW.cfg, map = LW.map;
    var box = [];
    this.pushBoxVerts(box, 0, 0, 0, 0.5, 0.5, 0.5, null);
    this.geoBox = dev.createBuffer({ size: box.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.geoBox, 0, new Float32Array(box));
    this.boxVerts = box.length / 9;

    var oct = [], ov = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var of = [[2, 0, 4], [0, 3, 4], [1, 3, 4], [1, 2, 4], [2, 5, 0], [0, 5, 3], [1, 5, 3], [1, 2, 5]];
    for (var f = 0; f < 8; f++) {
      var a = ov[of[f][0]], b = ov[of[f][1]], c = ov[of[f][2]];
      var u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      var n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      var l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      var tri = [a, b, c];
      for (var k = 0; k < 3; k++) oct.push(tri[k][0], tri[k][1], tri[k][2], n[0], n[1], n[2], 1, 1, 1);
    }
    this.geoOcta = dev.createBuffer({ size: oct.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.geoOcta, 0, new Float32Array(oct));
    this.octaVerts = oct.length / 9;

    var quad = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    this.geoQuad = dev.createBuffer({ size: quad.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.geoQuad, 0, new Float32Array(quad));
    this.quadVerts = 6;

    var terr = [], wat = [], rocks = [];
    for (var ty = 0; ty < map.H; ty++) for (var tx = 0; tx < map.W; tx++) {
      var ti = map.ti(tx, ty), t = map.tiles[ti], sh = map.shade[ti];
      var x0 = tx * cfg.tile, z0 = ty * cfg.tile, x1 = x0 + cfg.tile, z1 = z0 + cfg.tile;
      var col;
      if (t === 1) col = [0.39 * sh, 0.39 * sh, 0.42 * sh];
      else if (t === 3) { col = [0.16, 0.35, 0.62]; }
      else col = [0.20 * sh, 0.41 * sh, 0.19 * sh];
      var quad6 = [x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1];
      if (t === 3) {
        for (var k = 0; k < 6; k++) wat.push(quad6[k * 3], 3, quad6[k * 3 + 2], 0, 1, 0, col[0], col[1], col[2]);
      } else {
        for (var k2 = 0; k2 < 6; k2++) terr.push(quad6[k2 * 3], 0, quad6[k2 * 3 + 2], 0, 1, 0, col[0], col[1], col[2]);
        if (t === 1) rocks.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, s: cfg.tile * (0.5 + sh * 0.4) });
      }
    }
    this.geoTerrain = dev.createBuffer({ size: Math.max(4, terr.length * 4), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.geoTerrain, 0, new Float32Array(terr));
    this.terrainVerts = terr.length / 9;
    this.geoWater = dev.createBuffer({ size: Math.max(4, wat.length * 4), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.geoWater, 0, new Float32Array(wat));
    this.waterVerts = wat.length / 9;

    var rarr = [];
    for (var r = 0; r < rocks.length; r++) {
      var rk = rocks[r];
      this.pushInst(rarr, rk.x, rk.s * 0.5, rk.z, (r * 0.7) % 6.28, rk.s, rk.s, rk.s, 0.42, 0.42, 0.45, 1);
    }
    this.rockBuf = dev.createBuffer({ size: Math.max(80, rarr.length * 4), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.rockBuf, 0, new Float32Array(rarr));
    this.rockCount = rocks.length;
  },

  pushInst: function (arr, px, py, pz, rotY, sx, sy, sz, r, g, b, a) {
    var c = Math.cos(rotY), s = Math.sin(rotY);
    arr.push(c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, px, py, pz, 1, r, g, b, a);
  },

  ensureBuf: function (which, floats, perInst) {
    perInst = perInst || 20;
    var cap = this[which + 'cap'];
    if (floats > cap) {
      var ncap = Math.max(1024, cap * 2);
      while (ncap < floats) ncap *= 2;
      this[which] = this.device.createBuffer({ size: ncap * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      this[which + 'cap'] = ncap;
    }
    this.device.queue.writeBuffer(this[which], 0, new Float32Array(floats));
    return Math.floor(floats / perInst);
  },

  hex: function (h) {
    return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  },

  m4mul: function (a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  },

  computeCamera: function (camX, camY, vw, vh, zoom) {
    var halfW = vw / (2 * zoom), halfH = vh / (2 * zoom);
    var eye = [camX, 1000, camY - 800];
    var tgt = [camX, 0, camY];
    var zx = eye[0] - tgt[0], zy = eye[1] - tgt[1], zz = eye[2] - tgt[2];
    var zl = Math.hypot(zx, zy, zz) || 1;
    var z = [zx / zl, zy / zl, zz / zl];
    var x = [z[2], 0, -z[0]];
    var xl = Math.hypot(x[0], x[1], x[2]) || 1;
    x = [x[0] / xl, x[1] / xl, x[2] / xl];
    var y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    var view = new Float32Array(16);
    view[0] = x[0]; view[1] = y[0]; view[2] = z[0];
    view[4] = x[1]; view[5] = y[1]; view[6] = z[1];
    view[8] = x[2]; view[9] = y[2]; view[10] = z[2];
    view[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    view[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    view[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    view[15] = 1;
    var proj = new Float32Array(16);
    proj[0] = 1 / halfW; proj[5] = 1 / halfH;
    proj[10] = -2 / (3000 - 100); proj[14] = -(3000 + 100) / (3000 - 100);
    proj[15] = 1;
    return {
      view: view, proj: proj, vp: this.m4mul(proj, view),
      eye: eye, right: x, upv: y, fwd: [-z[0], -z[1], -z[2]],
      halfW: halfW, halfH: halfH,
    };
  },

  draw: function () {
    if (!this.ready || !this.active) return;
    try {
    var cfg = LW.cfg, map = LW.map, st = LW.core.state, input = LW.input;
    var canvas = this.canvas, dev = this.device;
    var vw = canvas.width || 1280, vh = canvas.height || 720;
    if (!this.depthTex || this.depthW !== vw || this.depthH !== vh) {
      canvas.width = vw; canvas.height = vh;
      if (this.depthTex) this.depthTex.destroy();
      this.depthTex = dev.createTexture({ size: [vw, vh], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
      this.depthW = vw; this.depthH = vh;
    }
    var zoom = input.zoom || 0.75;
    var cam = input.cam;
    var cc = this.computeCamera(cam.x, cam.y, vw, vh, zoom);
    this.eye = cc.eye; this.fwd = cc.fwd; this.right = cc.right; this.upv = cc.upv;
    this.halfW = cc.halfW; this.halfH = cc.halfH; this.vw = vw; this.vh = vh;
    var vp = cc.vp;
    var ub = new Float32Array(32);
    ub.set(vp, 0);
    var ld = [-0.35, 1, -0.25], ll = Math.hypot(ld[0], ld[1], ld[2]);
    ub[16] = ld[0] / ll; ub[17] = ld[1] / ll; ub[18] = ld[2] / ll; ub[19] = 0;
    ub.set([cc.right[0], cc.right[1], cc.right[2], 0], 20);
    ub.set([cc.upv[0], cc.upv[1], cc.upv[2], 0], 24);
    dev.queue.writeBuffer(this.uBuf, 0, ub);

    var BO = [], OO = [], BT = [], OT = [], PT = [];
    var i, sk;

    for (i = 0; i < map.oreTiles.length; i++) {
      var ti = map.oreTiles[i];
      if (map.ore[ti] <= 0) continue;
      var kind = map.resKind[ti];
      var col = cfg.resources[kind] ? this.hex(cfg.resources[kind].color) : [0.9, 0.8, 0.2];
      var frac = Math.max(0.2, Math.min(1, map.ore[ti] / 500));
      var cx = (ti % map.W + 0.5) * cfg.tile, cz = (Math.floor(ti / map.W) + 0.5) * cfg.tile;
      this.pushInst(OO, cx, 6 + 6 * frac, cz, 0, 9 * frac, 12 * frac, 9 * frac, col[0], col[1], col[2], 1);
    }

    for (i = 0; i < st.decals.length; i++) {
      var d = st.decals[i];
      this.pushInst(BT, d.x, 1, d.y, 0, d.r * 2, 2, d.r * 1.6, 0.05, 0.04, 0.03, 0.55);
    }
    for (i = 0; i < st.singularities.length; i++) {
      var sg = st.singularities[i];
      this.pushInst(OT, sg.x, sg.core, sg.y, st.time * 2, sg.core * 2.2, sg.core * 2.2, sg.core * 2.2, 0, 0, 0, 1);
      this.pushInst(OT, sg.x, sg.core * 2, sg.y, 0, sg.r, sg.r * 0.4, sg.r, 0.45, 0.2, 0.9, 0.08);
      this.pushInst(BT, sg.x, sg.core * 2, sg.y, st.time * 3, sg.core * 4, 3, sg.core * 4, 0.7, 0.4, 1, 0.5);
    }
    for (i = 0; i < st.storms.length; i++) {
      var sm = st.storms[i];
      this.pushInst(BT, sm.x, 140, sm.y, 0, sm.r * 2, 280, sm.r * 2, 0.55, 0.3, 0.95, 0.13 + 0.05 * Math.sin(st.time * 8));
    }
    for (i = 0; i < st.beams.length; i++) {
      var bm = st.beams[i];
      var bl = Math.hypot(bm.x2 - bm.x1, bm.y2 - bm.y1);
      var yaw = Math.atan2(bm.y2 - bm.y1, bm.x2 - bm.x1);
      var ba = Math.max(0, bm.left / bm.max);
      this.pushInst(BT, (bm.x1 + bm.x2) / 2, 70, (bm.y1 + bm.y2) / 2, yaw, cfg.super.npulse.width * cfg.tile, 12, bl, 0.65, 0.95, 1, 0.75 * ba);
    }

    for (sk in st.sides) {
      var s = st.sides[sk];
      var fac = cfg.factions[s.faction];
      var fc = this.hex(fac.color), fd = this.hex(fac.dark);
      for (i = 0; i < s.buildings.length; i++) {
        var b = s.buildings[i];
        var bc = cfg.buildings[b.type];
        var alpha = b.constructing ? 0.55 : 1;
        var mult = b.offline && !b.constructing ? 0.45 : 1;
        var br = fd[0] * mult, bg = fd[1] * mult, bb = fd[2] * mult;
        if (b.irradiated > 0) { br = br * 0.5 + 0.2; bg = Math.min(1, bg * 0.5 + 0.6); bb = bb * 0.5 + 0.1; }
        var bw = b.w * cfg.tile * 0.92, bh = b.h * cfg.tile * 0.92;
        this.pushInst(BO, b.x, 12, b.y, 0, bw, 24, bh, br, bg, bb, alpha);
        this.pushInst(BO, b.x, 27, b.y, 0, bw * 0.55, 7, bh * 0.55, fc[0] * mult, fc[1] * mult, fc[2] * mult, alpha);
        if ((b.type === 'turret' || b.type === 'sam' || b.type === 'diffuser') && !b.constructing) {
          this.pushInst(BO, b.x + Math.cos(b.angle) * 12, 28, b.y + Math.sin(b.angle) * 12, -b.angle, 5, 5, 22, 0.1, 0.1, 0.12, 1);
        }
        if (b.type === 'silo') this.pushInst(OO, b.x, 34, b.y, st.time, 20, 14, 20, fc[0], fc[1], fc[2], alpha);
        if (b.type === 'weather') this.pushInst(OO, b.x, 36, b.y, st.time * 0.5, 16, 8, 16, fc[0], fc[1], fc[2], alpha);
        if (b.type === 'lab') this.pushInst(OO, b.x, 34, b.y, 0, 12, 12, 12, 0.9, 0.5, 1, alpha);
        if (b.type === 'airfield') this.pushInst(BO, b.x, 2, b.y, 0, bw * 0.85, 3, 12, 0.23, 0.25, 0.28, alpha);
        if (b.type === 'diffuser' && !b.constructing) this.pushInst(BT, b.x, 4, b.y, 0, bc.aura * 2, 8, bc.aura * 2, 0.5, 0.85, 1, 0.07);
        if (b.hp < b.maxHp) {
          this.pushInst(BO, b.x, 34 + (b.w * cfg.tile) / 2, b.y, 0, bw, 4, 3, 0.25, 0.05, 0.05, 1);
          this.pushInst(BO, b.x, 34 + (b.w * cfg.tile) / 2, b.y + 2, 0, bw * Math.max(0, b.hp / b.maxHp), 4, 3, 0.35, 0.85, 0.35, 1);
        }
      }
      for (i = 0; i < s.units.length; i++) {
        var un = s.units[i];
        var uc = cfg.units[un.type];
        var ucCol = un.mutated ? [0.44, 0.88, 0.44] : fc;
        var sel = input.sel.units.indexOf(un) >= 0;
        if (un.cls === 'aircraft') {
          this.pushInst(OO, un.x, 26, un.y, -un.angle, 18, 9, 18, ucCol[0], ucCol[1], ucCol[2], 1);
        } else if (un.type === 'harvester') {
          this.pushInst(BO, un.x, 8, un.y, -un.angle, 20, 13, 14, 0.79, 0.64, 0.29, 1);
          this.pushInst(BO, un.x, 8, un.y + 8, -un.angle, 12 * Math.min(1, un.carrying / cfg.harvestAmount), 6, 8, 0.54, 0.43, 0.17, 1);
        } else {
          var us = un.hero ? 1.35 : 1;
          this.pushInst(BO, un.x, 8, un.y, -un.angle, 15 * us, 13 * us, 12 * us, ucCol[0], ucCol[1], ucCol[2], 1);
        }
        if (un.hero) this.pushInst(BT, un.x, 8, un.y, 0, 26, 22, 22, 1, 0.7, 0.28, 0.35);
        if (sel) this.pushInst(BT, un.x, 8, un.y, 0, 24, 20, 20, 1, 1, 1, 0.4);
        if (un.hp < un.maxHp) {
          this.pushInst(BO, un.x, 22, un.y, 0, 22, 3, 3, 0.25, 0.05, 0.05, 1);
          this.pushInst(BO, un.x, 22, un.y + 2, 0, 22 * Math.max(0, un.hp / un.maxHp), 3, 3, 0.35, 0.85, 0.35, 1);
        }
      }
    }

    for (i = 0; i < st.projectiles.length; i++) {
      var p = st.projectiles[i];
      var pc = p.side === 'player' ? [0.75, 0.94, 1] : [0.88, 0.7, 1];
      this.pushInst(OO, p.x, 24, p.y, 0, 5, 5, 5, pc[0], pc[1], pc[2], 1);
    }
    for (i = 0; i < st.missiles.length; i++) {
      var m = st.missiles[i];
      var f = Math.min(1, m.t / m.dur);
      var mx = m.x + (m.tx - m.x) * f;
      var mz = m.y + (m.ty - m.y) * f;
      var alt = 30 + Math.sin(f * Math.PI) * 160;
      this.pushInst(BO, mx, alt, mz, -Math.atan2(m.ty - m.y, m.tx - m.x), 9, 9, 30, 0.85, 0.87, 0.9, 1);
      this.pushInst(BO, mx, alt, mz, -Math.atan2(m.ty - m.y, m.tx - m.x), 5, 5, 8, 1, 0.36, 0.24, 1);
    }

    for (i = 0; i < st.particles.length; i++) {
      var pt = st.particles[i];
      var pa = Math.max(0, pt.life / pt.max);
      if (pt.bolt) {
        var bl2 = Math.hypot(pt.x2 - pt.x, pt.y2 - pt.y);
        this.pushInst(BT, (pt.x + pt.x2) / 2, 80, (pt.y + pt.y2) / 2, -Math.atan2(pt.y2 - pt.y, pt.x2 - pt.x), 4, 160, bl2, 0.79, 0.64, 1, 0.8 * pa);
      } else {
        var pc2 = this.hex(pt.color);
        PT.push(pt.x, 40, pt.y, pt.size * (0.6 + pa), pc2[0], pc2[1], pc2[2], pa);
      }
    }

    if (input.placing) {
      var key = input.placing, bb2 = cfg.buildings[key];
      var tx = Math.floor(input.mouse.wx / cfg.tile), ty = Math.floor(input.mouse.wy / cfg.tile);
      var ok = LW.core.canPlaceAt('player', key, tx, ty).ok && st.sides.player.credits >= bb2.cost;
      var gc = ok ? [0.35, 0.9, 0.45] : [0.9, 0.25, 0.2];
      this.pushInst(BT, (tx + bb2.size / 2) * cfg.tile, 3, (ty + bb2.size / 2) * cfg.tile, 0, bb2.size * cfg.tile, 6, bb2.size * cfg.tile, gc[0], gc[1], gc[2], 0.45);
    }
    if (input.targetB && input.mouse.wx != null) {
      this.pushInst(BT, input.mouse.wx, 3, input.mouse.wy, 0, 70, 6, 70, 1, 0.36, 0.24, 0.4);
    }

    var nBO = this.ensureBuf('dynBO', BO);
    var nOO = this.ensureBuf('dynOO', OO);
    var nBT = this.ensureBuf('dynBT', BT);
    var nOT = this.ensureBuf('dynOT', OT);
    var nPT = this.ensureBuf('partBuf', PT, 8);

    var enc = dev.createCommandEncoder();
    var pass = enc.beginRenderPass({
      colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: { r: 0.04, g: 0.05, b: 0.07, a: 1 }, storeOp: 'store' }],
      depthStencilAttachment: { view: this.depthTex.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' },
    });
    pass.setBindGroup(0, this.bindGroup);
    pass.setPipeline(this.pipeOpaque);
    pass.setVertexBuffer(0, this.geoTerrain); pass.setVertexBuffer(1, this.staticInst);
    pass.draw(this.terrainVerts, 1);
    pass.setVertexBuffer(0, this.geoBox); pass.setVertexBuffer(1, this.rockBuf);
    pass.draw(this.boxVerts, this.rockCount);
    pass.setVertexBuffer(1, this.dynBO);
    pass.draw(this.boxVerts, nBO);
    pass.setVertexBuffer(0, this.geoOcta); pass.setVertexBuffer(1, this.dynOO);
    pass.draw(this.octaVerts, nOO);
    pass.setPipeline(this.pipeTrans);
    pass.setVertexBuffer(0, this.geoWater); pass.setVertexBuffer(1, this.waterInst);
    pass.draw(this.waterVerts, 1);
    pass.setVertexBuffer(0, this.geoBox); pass.setVertexBuffer(1, this.dynBT);
    pass.draw(this.boxVerts, nBT);
    pass.setVertexBuffer(0, this.geoOcta); pass.setVertexBuffer(1, this.dynOT);
    pass.draw(this.octaVerts, nOT);
    pass.setPipeline(this.pipeParts);
    pass.setVertexBuffer(0, this.geoQuad); pass.setVertexBuffer(1, this.partBuf);
    pass.draw(this.quadVerts, nPT);
    pass.end();
    dev.queue.submit([enc.finish()]);
    } catch (err) {
      this.active = false;
      this.ready = false;
      if (typeof console !== 'undefined') console.error('3D-Renderer deaktiviert, Fallback auf 2D:', err);
      var d = typeof document !== 'undefined' && document.getElementById('errbanner');
      if (d) d.textContent = 'WebGPU-Fehler (Fallback 2D aktiv): ' + (err && err.message ? err.message : err);
    }
  },

  screenToWorld: function (sx, sy) {
    if (!this.ready) return { x: (LW.input ? LW.input.cam.x : 0) + sx, y: (LW.input ? LW.input.cam.y : 0) + sy };
    var ndcX = (sx / this.vw) * 2 - 1, ndcY = 1 - (sy / this.vh) * 2;
    var bx = this.eye[0] + this.right[0] * ndcX * this.halfW + this.upv[0] * ndcY * this.halfH;
    var by = this.eye[1] + this.right[1] * ndcX * this.halfW + this.upv[1] * ndcY * this.halfH;
    var bz = this.eye[2] + this.right[2] * ndcX * this.halfW + this.upv[2] * ndcY * this.halfH;
    var t = -by / this.fwd[1];
    return { x: bx + this.fwd[0] * t, y: bz + this.fwd[2] * t };
  },
};
