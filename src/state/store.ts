import { createContext, useContext } from "react";

import { alleKernSkills, heldenDefs, kernBaum, saisonS6, s7Fahrplan, tierFuerSkill, type HeroTyp } from "../data/seed";

export interface HeldInstanz {
  held_id: string;
  sterne: number;
  level: number | null;
  hp: number | null;
  angriff: number | null;
  verteidigung: number | null;
  gear: (number | null)[];
  erweckt: boolean;
  erweckung_level: number | null;
  faehigkeiten_level: number[];
}

export interface ProfilState {
  server: number;
  hq_level: number;
  ressourcen: { nahrung: number; eisen: number; gold: number; oel: number };
  beschleuniger: { bau_1h: number; forschung_1h: number; heilung_5min: number; universal_5min: number };
  vip: { level: number; punkte: number; punkte_naechster_level: number } | null;
  waehrungen: { diamanten: number; universal_hero_shards: number } | null;
  tech_forschung_prozent: Record<string, number>;
  ueberlebende: number | null;
  helden: HeldInstanz[];
  squad: string[];
  kern: Record<string, number>;
  saisonS6: Record<string, number>;
  profession_level: number;
  store_limits: StoreEintrag[];
}

export function leeresProfil(): ProfilState {
  return {
    server: 977,
    hq_level: 1,
    ressourcen: { nahrung: 0, eisen: 0, gold: 0, oel: 0 },
    beschleuniger: { bau_1h: 0, forschung_1h: 0, heilung_5min: 0, universal_5min: 0 },
    vip: null,
    waehrungen: null,
    tech_forschung_prozent: {},
    ueberlebende: null,
    helden: [],
    squad: [],
    kern: {},
    saisonS6: {},
    profession_level: 100,
    store_limits: [],
  };
}

export interface SquadOption {
  helden: string[];
  score: number;
  formation_faktor: number;
  counter_faktor: number;
  staerke_summe: number;
  begruendung: string;
}

export function formationBonusProzent(typen: HeroTyp[]): number {
  const counts: Record<HeroTyp, number> = { panzer: 0, rakete: 0, flugzeug: 0 };
  for (const t of typen) counts[t] += 1;
  const werte = Object.values(counts).sort((a, b) => b - a);
  const max = werte[0] ?? 0;
  const second = werte[1] ?? 0;
  const r = heldenDefs.formationsbonus;
  if (max >= 5) return r["5x_gleicher_typ"];
  if (max === 4) return r["4x_gleicher_typ"];
  if (max === 3 && second === 2) return r["3plus2"];
  if (max === 3) return r["3x_gleicher_typ"];
  return 0;
}

export function counterFaktor(angreifer: HeroTyp, gegner: HeroTyp): number {
  const c = heldenDefs.counter_regel;
  const genommen =
    (gegner === "flugzeug" && angreifer === "panzer" && c.flugzeug_nimmt_von_panzer) ||
    (gegner === "rakete" && angreifer === "flugzeug" && c.rakete_nimmt_von_flugzeug) ||
    (gegner === "panzer" && angreifer === "rakete" && c.panzer_nimmt_von_rakete) ||
    1.0;
  return genommen < 1.0 ? 1.0 / genommen : 1.0;
}

export interface FehlenderWert {
  held_id: string;
  feld: string;
}

export function fehlendeWerte(helden: HeldInstanz[]): FehlenderWert[] {
  const out: FehlenderWert[] = [];
  for (const h of helden) {
    if (h.level === null) out.push({ held_id: h.held_id, feld: "level" });
    if (h.hp === null) out.push({ held_id: h.held_id, feld: "hp" });
    if (h.angriff === null) out.push({ held_id: h.held_id, feld: "angriff" });
    if (h.verteidigung === null) out.push({ held_id: h.held_id, feld: "verteidigung" });
  }
  return out;
}

export function mitOverrides(
  profil: ProfilState,
  overrides: Record<string, Partial<HeldInstanz>>,
): ProfilState {
  return {
    ...profil,
    helden: profil.helden.map((h) =>
      overrides[h.held_id] ? { ...h, ...overrides[h.held_id] } : h,
    ),
  };
}

export function heldenStaerke(h: HeldInstanz): number {
  const basis = (h.hp ?? 0) + (h.angriff ?? 0) + (h.verteidigung ?? 0);
  const levelFaktor = h.level !== null && h.level > 1 ? 1 + 0.02 * (h.level - 1) : 1;
  const sternFaktor = 1 + 0.05 * Math.max(0, h.sterne - 1);
  const gearSumme = h.gear.reduce<number>((a, g) => a + (g ?? 0), 0);
  const gearFaktor = 1 + 0.01 * gearSumme;
  const erwecktFaktor = h.erweckt ? 1.2 : 1;
  return basis * levelFaktor * sternFaktor * gearFaktor * erwecktFaktor;
}

function kombinationen(pool: number[], k: number): number[][] {
  const out: number[][] = [];
  const aktuell: number[] = [];
  const build = (start: number): void => {
    if (aktuell.length === k) {
      out.push([...aktuell]);
      return;
    }
    const noetig = k - aktuell.length;
    for (let i = start; i <= pool.length - noetig; i++) {
      aktuell.push(pool[i]);
      build(i + 1);
      aktuell.pop();
    }
  };
  build(0);
  return out;
}

export function optimiereSquad(
  profil: ProfilState,
  gegner: HeroTyp | null,
  fixierungen: string[],
  topN: number,
): SquadOption[] {
  const bestand = profil.helden.filter((h) => heldenDefs.helden.some((d) => d.id === h.held_id));
  const k = heldenDefs.squad_groesse;
  const fixIdx = bestand.map((h, i) => (fixierungen.includes(h.held_id) ? i : -1)).filter((i) => i >= 0);
  const frei = bestand.map((_, i) => i).filter((i) => !fixIdx.includes(i));
  const freiK = Math.max(0, k - fixIdx.length);
  if (fixIdx.length > k || frei.length < freiK) return [];
  const optionen: SquadOption[] = [];
  for (const komboFrei of kombinationen(frei, freiK)) {
    const kombo = [...fixIdx, ...komboFrei].map((i) => bestand[i]);
    const typen = kombo.map((h) => heldenDefs.helden.find((d) => d.id === h.held_id)?.typ).filter((t): t is HeroTyp => t !== null && t !== undefined);
    const ff = typen.length === kombo.length ? 1 + formationBonusProzent(typen) : 1;
    const staerke = kombo.reduce((a, h) => a + heldenStaerke(h), 0);
    let cf = 1;
    if (gegner !== null && typen.length === kombo.length) {
      const gewichtet = kombo.reduce((a, h, i) => a + heldenStaerke(h) * counterFaktor(typen[i], gegner), 0);
      cf = staerke > 0 ? gewichtet / staerke : 1;
    }
    const score = staerke * ff * cf;
    const namen = kombo.map((h) => heldenDefs.helden.find((d) => d.id === h.held_id)?.name ?? h.held_id);
    const begruendung = `Formation ${(ff - 1) * 100 >= 0 ? "+" : ""}${((ff - 1) * 100).toFixed(0)} %${gegner ? `; Counter gegen ${gegner} x${cf.toFixed(2)}` : ""} — Helden: ${namen.join(", ")}`;
    optionen.push({ helden: kombo.map((h) => h.held_id), score, formation_faktor: ff, counter_faktor: cf, staerke_summe: staerke, begruendung });
  }
  optionen.sort((a, b) => b.score - a.score);
  return optionen.slice(0, Math.max(1, topN));
}

export function budgetFuerLevel(level: number): number {
  const cap = kernBaum.level_cap;
  const l = Math.min(level, cap);
  return Math.min(kernBaum.budget_punkte_lv100, Math.floor((kernBaum.budget_punkte_lv100 * l) / cap));
}

export function validateSaisonAllocation(
  alloc: Record<string, number>,
  professionLevel: number,
): string[] {
  const fehler: string[] = [];
  const summe = Object.values(alloc).reduce((a, b) => a + b, 0);
  if (summe > saisonS6.punkte_budget) {
    fehler.push(`S6-Budget überschritten: ${summe} von ${saisonS6.punkte_budget} Punkten`);
  }
  let luecke = false;
  for (const s of saisonS6.skills) {
    const lvl = alloc[s.id] ?? 0;
    if (lvl > 0) {
      if (luecke) fehler.push(`lineare Kette: '${s.id}' hat Punkte, obwohl ein früherer Skill 0 hat`);
      if (s.max_level != null && lvl > s.max_level) fehler.push(`${s.id} über Max-Level ${s.max_level}`);
      if (s.unlock_level != null && s.unlock_level > professionLevel) {
        fehler.push(`${s.id} erst ab Level ${s.unlock_level} freigeschaltet`);
      }
    } else {
      luecke = true;
    }
  }
  for (const id of Object.keys(alloc)) {
    if (!saisonS6.skills.some((s) => s.id === id)) fehler.push(`Unbekannter S6-Skill: ${id}`);
  }
  return fehler;
}

export interface RespecPlan {
  kernZiel: Record<string, number>;
  saisonZiel: Record<string, number>;
  erstattung: number;
  budgetGesamt: number;
  erklaerung: string[];
}

export function respecPlanNachSaisonende(
  saisonAlloc: Record<string, number>,
  kernIst: Record<string, number>,
  professionLevel: number,
): RespecPlan {
  const erstattung = Object.values(saisonAlloc).reduce((a, b) => a + b, 0);
  const kernBudget = budgetFuerLevel(professionLevel);
  const budgetGesamt = kernBudget + erstattung;
  const kernZiel: Record<string, number> = {};
  let freie = budgetGesamt;
  const erklaerung = [
    `Saisonende: ${erstattung} Saisonpunkte werden voll erstattet -> ${budgetGesamt} Punkte gesamt (Kern-Budget ${kernBudget}).`,
  ];
  for (const id of kernBaum.prioritaet_reihenfolge.prio) {
    const skill = alleKernSkills(kernBaum).find((s) => s.id === id);
    if (!skill) continue;
    const tier = tierFuerSkill(kernBaum, id);
    if (tier !== null && tier > professionLevel) continue;
    const max = skill.max_level ?? 0;
    const alt = kernIst[id] ?? 0;
    const nehm = Math.min(max, alt + freie);
    if (nehm > 0) {
      kernZiel[id] = nehm;
      freie = Math.max(0, freie - Math.max(0, nehm - alt));
    }
  }
  erklaerung.push(
    `Kern-Ziel nach Prio-Reihenfolge: ${Object.values(kernZiel).reduce((a, b) => a + b, 0)} von ${budgetGesamt} vergeben, ${freie} unverteilt.`,
  );
  erklaerung.push("Saison-Ziel leer: Saisonpunkte wurden erstattet.");
  return { kernZiel, saisonZiel: {}, erstattung, budgetGesamt, erklaerung };
}

export interface Phase {
  id: string;
  name: string;
  start: string | null;
  dauerTage: number;
}

export function s7Phasen(preSeasonStart: string | null): Phase[] {
  const z = s7Fahrplan.zyklus;
  const preTage = z.pre_season_wochen * 7;
  const hauptTage = z.haupt_saison_wochen * 7;
  const celTage = z.celebration_week * 7;
  if (preSeasonStart === null || preSeasonStart === "") {
    return [
      { id: "pre", name: "Präseason", start: null, dauerTage: preTage },
      { id: "haupt", name: "Hauptsaison", start: null, dauerTage: hauptTage },
      { id: "celebration", name: "Celebration Week", start: null, dauerTage: celTage },
      { id: "off", name: "Off-Season", start: null, dauerTage: 0 },
    ];
  }
  const start = new Date(preSeasonStart + "T00:00:00");
  const add = (d: Date, tage: number): Date => new Date(d.getTime() + tage * 86_400_000);
  const haupt = add(start, preTage);
  const cel = add(haupt, hauptTage);
  const off = add(cel, celTage);
  const fmt = (d: Date): string => d.toISOString().slice(0, 10);
  return [
    { id: "pre", name: "Präseason", start: fmt(start), dauerTage: preTage },
    { id: "haupt", name: "Hauptsaison", start: fmt(haupt), dauerTage: hauptTage },
    { id: "celebration", name: "Celebration Week", start: fmt(cel), dauerTage: celTage },
    { id: "off", name: "Off-Season", start: fmt(off), dauerTage: 0 },
  ];
}

export function countdownTage(ziel: string | null, heute: Date = new Date()): number | null {
  if (ziel === null || ziel === "") return null;
  const z = new Date(ziel + "T00:00:00").getTime();
  if (Number.isNaN(z)) return null;
  return Math.ceil((z - heute.getTime()) / 86_400_000);
}

export interface SpeedupErgebnis {
  dauerSek: number;
  gedecktSek: number;
  restSek: number;
  ueberhangSek: number;
  deckungProzent: number;
  vollstaendig: boolean;
}

export function speedupRechner(dauerSek: number, b: ProfilState["beschleuniger"]): SpeedupErgebnis {
  const posten = [
    { anzahl: b.bau_1h, sek: 3600 },
    { anzahl: b.forschung_1h, sek: 3600 },
    { anzahl: b.heilung_5min, sek: 300 },
    { anzahl: b.universal_5min, sek: 300 },
  ];
  const gesamt = posten.reduce((a, p) => a + p.anzahl * p.sek, 0);
  const gedeckt = Math.min(gesamt, dauerSek);
  return {
    dauerSek,
    gedecktSek: gedeckt,
    restSek: dauerSek - gedeckt,
    ueberhangSek: gesamt - gedeckt,
    deckungProzent: dauerSek === 0 ? 100 : (gedeckt / dauerSek) * 100,
    vollstaendig: gedeckt >= dauerSek,
  };
}

export function bauzeitFormat(sek: number): string {
  const tage = Math.floor(sek / 86_400);
  const h = Math.floor((sek % 86_400) / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  const teile: string[] = [];
  if (tage > 0) teile.push(`${tage}d`);
  if (h > 0) teile.push(`${h}h`);
  if (m > 0) teile.push(`${m}m`);
  if (s > 0 || teile.length === 0) teile.push(`${s}s`);
  return teile.join(" ");
}

export interface StoreEintrag {
  name: string;
  pro_woche: number | null;
  pro_monat: number | null;
  gekauft_woche: number;
  gekauft_monat: number;
}

export function letzterMontag0000(jetzt: Date): Date {
  const d = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

export function naechsterMontag0000(jetzt: Date): Date {
  const d = letzterMontag0000(jetzt);
  d.setDate(d.getDate() + 7);
  return d;
}

export function naechsterMonatserster(jetzt: Date): Date {
  return new Date(jetzt.getFullYear(), jetzt.getMonth() + 1, 1);
}

export function resetFaellig(letzterReset: Date, jetzt: Date): boolean {
  return letzterMontag0000(jetzt).getTime() > letzterReset.getTime();
}

export function storeKauf(
  e: StoreEintrag,
  betrag: number,
  letzterReset: Date,
  jetzt: Date,
): StoreEintrag {
  const neu = { ...e };
  if (resetFaellig(letzterReset, jetzt)) {
    neu.gekauft_woche = 0;
    neu.gekauft_monat = 0;
  }
  neu.gekauft_woche += betrag;
  neu.gekauft_monat += betrag;
  return neu;
}

export const seedDaten = { kernBaum, saisonS6, heldenDefs, s7Fahrplan };

export interface AppContextValue {
  profil: ProfilState;
  setProfil: (p: ProfilState) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (ctx === null) throw new Error("AppContext fehlt");
  return ctx;
}
