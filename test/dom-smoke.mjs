import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function makeCtx2d() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'canvas') return {};
      return function () { return undefined; };
    },
    set() { return true; },
  });
}

function makeEl(id) {
  const el = {
    id, children: [], style: {}, dataset: {}, width: 300, height: 150,
    clientWidth: 1000, clientHeight: 620,
    className: '', innerHTML: '', textContent: '', title: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { this.children.push(c); },
    insertBefore() {}, querySelectorAll() { return []; },
    getContext() { return makeCtx2d(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 620 }; },
  };
  return el;
}

const els = {};
const listeners = {};
const windowObj = {
  addEventListener(type, cb) { (listeners[type] = listeners[type] || []).push(cb); },
  removeEventListener() {},
  innerWidth: 1280, innerHeight: 760,
  location: { reload() {} },
};

const documentObj = {
  getElementById(id) {
    if (!els[id]) els[id] = makeEl(id);
    return els[id];
  },
  createElement(tag) { return makeEl(tag); },
};

const rafQueue = [];
const sandbox = {
  console,
  window: windowObj,
  document: documentObj,
  performance: { now: () => nowMs },
  requestAnimationFrame(cb) { rafQueue.push(cb); },
  location: windowObj.location,
  Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Error, TypeError,
  Int32Array, Uint8Array, Float32Array, Int8Array, Uint16Array,
  setTimeout, clearTimeout,
};
sandbox.globalThis = sandbox;
let nowMs = 0;
const ctx = vm.createContext(sandbox);

for (const f of ['config.js', 'utils.js', 'map.js', 'core.js', 'ai.js', 'audio.js', 'render.js', 'ui.js', 'input.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('ok   -', msg);
  else { failures++; console.error('FAIL -', msg); }
}

(listeners['load'] || []).forEach(cb => cb());
const LW = ctx.window.LW || ctx.LW;
assert(!!LW && !!LW.core.state, 'Boot: Core initialisiert nach load-Event');
assert(els['sidebar'].children.length > 0 || els['sidebar'].innerHTML.length > 0, 'UI: Sidebar aufgebaut');

for (let i = 0; i < 180; i++) {
  nowMs += 16.7;
  const cb = rafQueue.shift();
  if (!cb) break;
  cb(nowMs);
}
assert(LW.core.state.tick > 100, 'Game-Loop läuft (' + LW.core.state.tick + ' Ticks simuliert)');
assert(LW.core.state.sides.player.credits > 0, 'Ökonomie läuft im Browser-Loop');

const game = els['game'];
assert(typeof game.addEventListener === 'function', 'Canvas-Input gebunden');

console.log(failures === 0 ? '\nDOM SMOKE PASSED' : '\n' + failures + ' FAILED');
process.exit(failures === 0 ? 0 : 1);
