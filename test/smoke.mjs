import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ console });
for (const f of ['config.js', 'utils.js', 'map.js', 'core.js', 'ai.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f), 'utf8'), ctx, { filename: f });
}
const LW = ctx.LW;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('ok   -', msg);
  else { failures++; console.error('FAIL -', msg); }
}
function step(n, dt = 1 / 60) { for (let i = 0; i < n; i++) LW.core.tick(dt); }

console.log('== 1. Init + Ökonomie (Sammler arbeiten) ==');
LW.core.init(42);
let st = LW.core.state;
assert(st.sides.player.buildings.some(b => b.type === 'hq'), 'Spieler-HQ existiert');
assert(st.sides.enemy.buildings.some(b => b.type === 'hq'), 'Gegner-HQ existiert');
assert(LW.map.oreTiles.length > 20, 'Ressourcen-Vorkommen generiert (' + LW.map.oreTiles.length + ')');
assert(st.sides.enemy.neutrinos === LW.cfg.startNeutrinos, 'Aliens starten mit Neutrinos');
const c0 = st.sides.player.credits;
step(60 * 25);
assert(st.sides.player.credits > c0, 'Credits steigen durch Sammler (' + Math.floor(c0) + ' -> ' + Math.floor(st.sides.player.credits) + ')');

console.log('== 2. Fraktions-Regeln ==');
LW.core.debug.give('player', 99999);
LW.core.debug.give('enemy', 99999);
const hqP = st.sides.player.buildings.find(b => b.type === 'hq');
let spot = LW.core.findSpot(4, 4, hqP.x, hqP.y, 12);
assert(!LW.core.placeBuilding('enemy', 'silo', spot.tx, spot.ty).ok, 'Aliens dürfen kein Nukleararsenal bauen (keine Atomwaffen für jeden)');
assert(!LW.core.placeBuilding('player', 'weather', spot.tx, spot.ty).ok, 'Menschen dürfen keine Wetterstation bauen');
assert(!LW.core.placeBuilding('player', 'lab', spot.tx, spot.ty).ok, 'Menschen dürfen kein Kreuzungslabor bauen');

console.log('== 3. Wasserkraftwerk nur an Schlucht ==');
let waterSpot = null;
for (let ty = 0; ty < LW.map.H && !waterSpot; ty++) for (let tx = 0; tx < LW.map.W && !waterSpot; tx++) {
  if (LW.map.tiles[LW.map.ti(tx, ty)] === 3) {
    for (let dy = -4; dy <= 4 && !waterSpot; dy++) for (let dx = -4; dx <= 4 && !waterSpot; dx++) {
      if (LW.core.canPlaceAt('player', 'hydro', tx + dx, ty + dy).ok) waterSpot = { tx: tx + dx, ty: ty + dy };
    }
  }
}
assert(waterSpot !== null, 'Wasser/Schlucht auf der Karte gefunden, Hydro daneben platzierbar');
const farSpot = LW.core.findSpot(3, 3, hqP.x, hqP.y, 12);
const hydroFar = LW.core.canPlaceAt('player', 'hydro', farSpot.tx, farSpot.ty);
assert(!hydroFar.ok && /Schlucht/.test(hydroFar.reason), 'Hydro ohne Wasser in der Nähe abgelehnt: ' + hydroFar.reason);

console.log('== 4. Strom-Defizit schaltet Gebäude offline ==');
for (let i = 0; i < 9; i++) {
  const s2 = LW.core.findSpot(3, 3, hqP.x, hqP.y, 14);
  if (s2) LW.core.placeBuilding('player', 'barracks', s2.tx, s2.ty);
}
LW.core.debug.finishAll('player');
step(30);
const anyOffline = st.sides.player.buildings.some(b => b.offline);
assert(st.sides.player.powerDemand > st.sides.player.powerSupply, 'Strombedarf > Versorgung (' + st.sides.player.powerDemand + '>' + st.sides.player.powerSupply + ')');
assert(anyOffline, 'Bei Strommangel fallen Gebäude aus (EMP/Brownout)');

console.log('== 5. Superwaffe Stufe 1: Nuklearrakete (zweistufig: laden -> feuern) ==');
const techSpot = LW.core.findSpot(3, 3, hqP.x, hqP.y, 14);
LW.core.placeBuilding('player', 'tech', techSpot.tx, techSpot.ty);
LW.core.debug.finishAll('player');
const siloSpot = LW.core.findSpot(4, 4, hqP.x, hqP.y, 15);
const siloRes = LW.core.placeBuilding('player', 'silo', siloSpot.tx, siloSpot.ty);
assert(siloRes.ok, 'Nukleararsenal gebaut (Menschen)');
LW.core.debug.finishAll('player');
const silo = siloRes.building;
silo.charge = 9999;
step(2);
assert(silo.superReady && silo.superKey === 'nuke', 'Silo geladen, Stufe 1 = Nuklearrakete');
const ehq = st.sides.enemy.buildings.find(b => b.type === 'hq');
const ehp0 = ehq.hp;
const lr = LW.core.launchSuper('player', silo.id, ehq.x, ehq.y);
assert(lr.ok, 'Nuklearrakete gestartet');
step(60 * 6);
assert(ehq.hp < ehp0 || !st.sides.enemy.buildings.includes(ehq), 'Rakete traf Gegner-HQ (HP ' + Math.floor(ehp0) + ' -> ' + Math.floor(ehq.hp) + ')');
assert(!silo.superReady && silo.charge < 30, 'Nach Abschuss lädt das Silo neu (charge=' + silo.charge.toFixed(1) + ', nicht bereit)');

console.log('== 6. Superwaffe Stufe 2: H-Bombe per Forschung ==');
st.sides.player.research.hbomb = true;
step(2);
assert(silo.chargeMax === LW.cfg.super.hbomb.charge, 'Nach H-Bombe-Forschung lädt das Silo die H-Bombe (chargeMax=' + silo.chargeMax + ')');

console.log('== 7. Alien-Superwaffe: radioaktiver Blitzsturm (Wetterstation) ==');
const eTechSpot = LW.core.findSpot(3, 3, ehq.x, ehq.y, 12);
LW.core.placeBuilding('enemy', 'tech', eTechSpot.tx, eTechSpot.ty);
LW.core.debug.finishAll('enemy');
const wSpot = LW.core.findSpot(3, 3, ehq.x, ehq.y, 13);
const wRes = LW.core.placeBuilding('enemy', 'weather', wSpot.tx, wSpot.ty);
assert(wRes.ok, 'Aliens bauen Wetterkontrollstation');
LW.core.debug.finishAll('enemy');
st.sides.enemy.research.weather = true;
const wStat = wRes.building;
wStat.charge = 9999;
step(2);
assert(wStat.superReady && wStat.superKey === 'storm', 'Wetterstation geladen: Blitzsturm');
const tank = LW.core.spawnUnit('player', 'tank', hqP.x + 20, hqP.y + 20);
const hqHp0 = hqP.hp;
const oldMut = LW.cfg.radiation.mutateChance;
LW.cfg.radiation.mutateChance = 1;
LW.core.launchSuper('enemy', wStat.id, hqP.x, hqP.y);
assert(st.storms.length === 1, 'Blitzsturm aktiv im Zielgebiet');
step(60 * 3);
assert(hqP.hp < hqHp0, 'Strahlung beschädigt Gebäude langfristig (HQ ' + Math.floor(hqHp0) + ' -> ' + Math.floor(hqP.hp) + ')');
assert(st.sides.player.buildings.some(b => b.irradiated > 0), 'Gebäude im Sturm sind verstrahlt (Langzeitschaden)');
assert(tank.mutated || !st.sides.player.units.includes(tank), 'Bodeneinheit im Sturm mutiert (oder vernichtet)');
step(60 * 9);
assert(st.storms.length === 0, 'Sturm ist nach Dauer abgelaufen');
LW.cfg.radiation.mutateChance = oldMut;

console.log('== 8. Solarsatellit: passiver Ertrag ==');
LW.core.init(7);
st = LW.core.state;
st.sides.player.units.filter(u => u.type === 'harvester').forEach(u => LW.core.damage(u, 1e9, 'koloss', 'enemy'));
st.sides.player.research.solar = true;
const sc0 = st.sides.player.credits;
step(60 * 5);
const sdelta = st.sides.player.credits - sc0;
assert(sdelta > 50 && sdelta < 72, 'Solarsatellit bringt ca. 12 Cr/s (' + sdelta.toFixed(1) + ' in 5s)');

console.log('== 9. Neutrinos: Aliens brauchen Treibstoff zum Fahren ==');
const larve = st.sides.enemy.units.find(u => u.type === 'larve');
assert(larve, 'Alien-Basisklasse Larve gespawnt');
larve.state = 'move'; larve.tx = larve.x + 300; larve.ty = larve.y;
st.sides.enemy.neutrinos = 0;
const lx0 = larve.x;
step(60);
assert(Math.abs(larve.x - lx0) < 1, 'Ohne Neutrinos bewegen sich Aliens nicht');
st.sides.enemy.neutrinos = 500;
step(60);
assert(Math.abs(larve.x - lx0) > 5, 'Mit Neutrinos bewegen sich Aliens (' + (larve.x - lx0).toFixed(1) + 'px)');
assert(st.sides.enemy.neutrinos < 500, 'Bewegung verbraucht Neutrinos (' + st.sides.enemy.neutrinos.toFixed(1) + ' übrig)');

console.log('== 10. Wasserstoff H3 ist mehr wert ==');
LW.core.init(11);
st = LW.core.state;
st.sides.player.units.filter(u => u.type === 'harvester').forEach(u => LW.core.damage(u, 1e9, 'koloss', 'enemy'));
const h3 = LW.map.oreTiles.find(ti => LW.map.resKind[ti] === 'h3');
assert(h3 !== undefined, 'H3-Vorkommen existiert');
const h3x = (h3 % LW.map.W + 0.5) * LW.cfg.tile, h3y = (Math.floor(h3 / LW.map.W) + 0.5) * LW.cfg.tile;
const hv = LW.core.spawnUnit('player', 'harvester', h3x, h3y);
hv.oreTi = h3; hv.resKind = 'h3'; hv.state = 'goto';
const hc0 = st.sides.player.credits;
step(60 * 40);
assert(st.sides.player.credits - hc0 >= LW.cfg.harvestAmount * LW.cfg.resources.h3.value, 'H3 bringt ' + LW.cfg.resources.h3.value + ' Cr/Einheit (' + Math.floor(st.sides.player.credits - hc0) + ' Cr verdient)');

console.log('== 11. Kreuzungslabor: Alien-Hybride ==');
LW.core.init(13);
st = LW.core.state;
LW.core.debug.give('enemy', 99999);
const eHq = st.sides.enemy.buildings.find(b => b.type === 'hq');
const tSpot = LW.core.findSpot(3, 3, eHq.x, eHq.y, 12);
LW.core.placeBuilding('enemy', 'tech', tSpot.tx, tSpot.ty);
LW.core.debug.finishAll('enemy');
const lSpot = LW.core.findSpot(3, 3, eHq.x, eHq.y, 13);
const labRes = LW.core.placeBuilding('enemy', 'lab', lSpot.tx, lSpot.ty);
assert(labRes.ok, 'Aliens bauen Kreuzungslabor');
LW.core.debug.finishAll('enemy');
const cr = LW.core.crossUnits('enemy', labRes.building.id, 'larve', 'wespe');
assert(cr.ok, 'Kreuzung Larve × Wespe gestartet');
step(60 * (LW.cfg.cross.time + 2));
assert(st.sides.enemy.units.some(u => u.type.indexOf('hyb_') === 0), 'Hybride wurde geboren: ' + (st.sides.enemy.units.find(u => u.type.indexOf('hyb_') === 0) || {}).type);
assert(!LW.core.crossUnits('player', 1, 'larve', 'wespe').ok, 'Menschen dürfen nicht kreuzen');

console.log('== 12. Hierarchische Einheiten-Freischaltung (Menschen) ==');
LW.core.init(17);
st = LW.core.state;
LW.core.debug.give('player', 99999);
const pHq = st.sides.player.buildings.find(b => b.type === 'hq');
const bSpot = LW.core.findSpot(3, 3, pHq.x, pHq.y, 10);
const rax = LW.core.placeBuilding('player', 'barracks', bSpot.tx, bSpot.ty).building;
LW.core.debug.finishAll('player');
assert(!LW.core.canProduce('player', 'rocket').ok, 'Raketenwerfer ohne Tech-Zentrum gesperrt');
assert(LW.core.canProduce('player', 'infantry').ok, 'Soldat ab Kaserne freigeschaltet');
assert(!LW.core.queueUnit('player', rax.id, 'marina').ok, 'Heldin Marina ohne Tech gesperrt');
const tS = LW.core.findSpot(3, 3, pHq.x, pHq.y, 12);
LW.core.placeBuilding('player', 'tech', tS.tx, tS.ty);
LW.core.debug.finishAll('player');
assert(LW.core.canProduce('player', 'rocket').ok, 'Raketenwerfer nach Tech-Zentrum freigeschaltet');
assert(LW.core.queueUnit('player', rax.id, 'marina').ok, 'Marina nach Tech baubar');
assert(!LW.core.queueUnit('player', rax.id, 'marina').ok, 'zweite Marina wird blockiert (Held nur einmal)');

console.log('== 13. Schnellfertigung ==');
st.sides.player.research.fastbuild = true;
const u0 = st.sides.player.units.length;
step(60 * 20);
assert(st.sides.player.units.length > u0 && st.sides.player.units.some(u => u.type === 'marina'), 'Mit Schnellfertigung (1,5x) ist Marina nach 20s fertig (statt 25s)');

console.log('== 14. Kampf ==');
const inf = st.sides.player.units.find(u => u.type === 'infantry');
const eTank = LW.core.spawnUnit('enemy', 'carapax', inf.x + 80, inf.y);
const et0 = eTank.hp;
step(60 * 10);
assert(eTank.hp < et0 || !st.sides.enemy.units.includes(eTank), 'Spieler-Einheiten greifen gegnerischen Carapax an (' + Math.floor(et0) + ' -> ' + Math.floor(eTank.hp) + ')');

console.log('== 15. Siegbedingung ==');
LW.core.debug.killSide('enemy');
step(5);
assert(st.over === 'win', 'Alle gegnerischen Gebäude zerstört -> Sieg (over=' + st.over + ')');

console.log('== 16. KI-Langlauf (150s simuliert) ==');
LW.core.init(99);
st = LW.core.state;
step(60 * 150);
const eB = st.sides.enemy.buildings.length;
assert(eB > 5, 'Alien-KI hat Basis ausgebaut (' + eB + ' Gebäude)');
assert(st.sides.enemy.units.length > 4, 'Alien-KI hat Armee (' + st.sides.enemy.units.length + ' Einheiten)');
console.log('     (KI-Gebäude: ' + st.sides.enemy.buildings.map(b => b.type).join(', ') + ')');

console.log('== 17. Quarkbosonspalten: Nano-Schwarze-Löcher ziehen an und fangen ein ==');
LW.core.init(21);
st = LW.core.state;
LW.core.debug.give('enemy', 99999);
const eHq2 = st.sides.enemy.buildings.find(b => b.type === 'hq');
const tS2 = LW.core.findSpot(3, 3, eHq2.x, eHq2.y, 12);
const tech2 = LW.core.placeBuilding('enemy', 'tech', tS2.tx, tS2.ty).building;
LW.core.debug.finishAll('enemy');
assert(LW.core.queueResearch('enemy', tech2.id, 'quark').ok, 'Forschung Quarkbosonspalten gestartet (Aliens)');
step(60 * (LW.cfg.research.quark.time + 2));
assert(st.singularities.length >= LW.cfg.singularity.count - 1, 'Nano-Schwarze-Löcher auf der Karte: ' + st.singularities.length);
const sg = st.singularities[0];
const prey = LW.core.spawnUnit('player', 'tank', sg.x + sg.r * 0.6, sg.y);
const preyDist0 = LW.util.dist(prey.x, prey.y, sg.x, sg.y);
step(60 * 2);
assert(LW.util.dist(prey.x, prey.y, sg.x, sg.y) < preyDist0, 'Schwarzes Loch zieht Einheit an (' + preyDist0.toFixed(0) + 'px -> ' + LW.util.dist(prey.x, prey.y, sg.x, sg.y).toFixed(0) + 'px)');
prey.x = sg.x + sg.core * 0.5; prey.y = sg.y;
step(5);
assert(!st.sides.player.units.includes(prey), 'Einheit im Kern wird eingefangen/vernichtet');

console.log('== 18. Diffusormatrix: annihiliert Schwarze Löcher und feuert selbst ==');
LW.core.debug.give('player', 99999);
const pHq2 = st.sides.player.buildings.find(b => b.type === 'hq');
const tS3 = LW.core.findSpot(3, 3, pHq2.x, pHq2.y, 12);
LW.core.placeBuilding('player', 'tech', tS3.tx, tS3.ty);
LW.core.debug.finishAll('player');
const dSpot = LW.core.findSpot(2, 2, sg.x, sg.y, 8);
const dRes = LW.core.placeBuilding('player', 'diffuser', dSpot.tx, dSpot.ty);
assert(dRes.ok, 'Diffusormatrix gebaut (Menschen, Gegenmaßnahme zu den Spalten)');
LW.core.debug.finishAll('player');
const sgCount0 = st.singularities.length;
step(60 * (LW.cfg.singularity.diffuserKillTime + 2));
assert(st.singularities.length < sgCount0, 'Diffusormatrix annihiliert Schwarzes Loch (' + sgCount0 + ' -> ' + st.singularities.length + ')');
const dfTarget = LW.core.spawnUnit('enemy', 'larve', dRes.building.x + 100, dRes.building.y);
const dfhp0 = dfTarget.hp;
step(60 * 5);
assert(dfTarget.hp < dfhp0 || !st.sides.enemy.units.includes(dfTarget), 'Diffusormatrix feuert selbst (Annihilationsbolzen): ' + Math.floor(dfhp0) + ' -> ' + Math.floor(dfTarget.hp));

console.log('== 19. Neutronen-Pulsstrahl (zweiter Superwaffen-Slot der Wetterstation) ==');
const wSpot2 = LW.core.findSpot(3, 3, eHq2.x, eHq2.y, 13);
const wRes2 = LW.core.placeBuilding('enemy', 'weather', wSpot2.tx, wSpot2.ty);
LW.core.debug.finishAll('enemy');
st.sides.enemy.research.weather = true;
st.sides.enemy.research.npulse = true;
const w2 = wRes2.building;
step(1);
w2.charge = 9999;
if (w2.super2) w2.super2.charge = 9999;
step(2);
assert(w2.superReady && w2.super2 && w2.super2.ready, 'Wetterstation lädt beide Superwaffen (Blitzsturm + Pulsstrahl)');
const victim = LW.core.spawnUnit('player', 'tank', pHq2.x, pHq2.y);
const vhp0 = victim.hp;
LW.core.launchSuper('enemy', w2.id, pHq2.x + 10, pHq2.y, '2');
assert(st.beams.length === 1, 'Pulsstrahl abgefeuert (Beam sichtbar)');
assert(victim.hp < vhp0 || !st.sides.player.units.includes(victim), 'Pulsstrahl beschädigt Einheiten auf der Linie (' + Math.floor(vhp0) + ' -> ' + Math.floor(victim.hp) + ')');
assert(!w2.super2.ready && w2.super2.charge === 0, 'Zweiter Slot lädt nach dem Schuss neu');

console.log('== 20. Antimaterie-Sprengkopf auf der H-Bombe ==');
st.sides.player.research.hbomb = true;
st.sides.player.research.antimatter = true;
const siloSpot2 = LW.core.findSpot(4, 4, pHq2.x, pHq2.y, 14);
const silo2 = LW.core.placeBuilding('player', 'silo', siloSpot2.tx, siloSpot2.ty).building;
LW.core.debug.finishAll('player');
silo2.charge = 9999;
step(2);
assert(silo2.superReady && silo2.superKey === 'hbomb', 'Silo lädt H-Bombe (Stufe 2)');
st.singularities.push({ x: eHq2.x + 30, y: eHq2.y, r: 6 * 32, core: 0.9 * 32, side: 'enemy', exposure: 0 });
const sgBefore = st.singularities.length;
const ehp2 = eHq2.hp;
LW.core.launchSuper('player', silo2.id, eHq2.x, eHq2.y);
step(60 * 6);
assert(st.singularities.length < sgBefore, 'Antimaterie-Sprengkopf annihiliert Schwarze Löcher im Radius');
assert(eHq2.hp < ehp2 || !st.sides.enemy.buildings.includes(eHq2), 'H-Bombe (Antimaterie, Radius 8) trifft: ' + Math.floor(ehp2) + ' -> ' + Math.floor(eHq2.hp));

console.log(failures === 0 ? '\nALL TESTS PASSED' : '\n' + failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
