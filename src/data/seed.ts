import skillsEngineer from "../../seed/skills-engineer.json";
import skillsSaisonS6 from "../../seed/skills-saison-s6.json";
import heldenDefinitionen from "../../seed/helden-definitionen.json";
import saisonS7Fahrplan from "../../seed/saison-s7-fahrplan.json";

export type Prioritaet = "prio" | "skip";

export interface SkillDef {
  id: string;
  name_de: string | null;
  name_en: string | null;
  unlock_level?: number | null;
  max_level?: number | null;
  effekt_pro_level?: string | null;
  effekt_max?: string | null;
  effekt?: string | null;
  kategorie?: string | null;
  prioritaet?: string | null;
  profession_exklusiv?: string | null;
  quelle: string[];
  is_unsicher: boolean;
  konflikt_notiz: string | null;
}

export interface Tier {
  level: number;
  skills: SkillDef[];
}

export interface KernBaum {
  profession: string;
  baum: string;
  level_cap: number;
  budget_punkte_lv100: number;
  budget_hinweis: string | null;
  tiers_pro_5_level: number;
  skills_pro_tier: number;
  kern_skills_gesamt: number;
  tiers: Tier[];
  unplatzierte_benannte_skills: SkillDef[];
  prioritaet_reihenfolge: {
    quelle: string[];
    prio: string[];
    skip: string[];
  };
}

export interface SaisonSkills {
  saison: number;
  name_de: string;
  start_erste_server: string | null;
  punkte_budget: number;
  punkte_budget_quelle: string[];
  erstattung_bei_saisonende: boolean;
  anzahl_skills: number;
  kette: string | null;
  skills: SkillDef[];
}

export type HeroTyp = "panzer" | "rakete" | "flugzeug";
export type Rolle = "angriff" | "verteidigung" | "support";
export type Seltenheit = "SR" | "SSR" | "UR";

export interface HeldDef {
  id: string;
  name: string | null;
  seltenheit: Seltenheit | null;
  typ: HeroTyp | null;
  rolle: Rolle | null;
  promotable: boolean;
  erweckung: boolean;
  basiswerte: { hp: number | null; angriff: number | null; verteidigung: number | null };
  quelle: string[];
  is_unsicher: boolean;
  konflikt_notiz: string | null;
}

export interface HeldenDefinitionen {
  stand: string;
  anzahl_helden: number;
  squad_groesse: number;
  gear_slots_pro_held: number;
  typen: HeroTyp[];
  rollen: Rolle[];
  seltenheiten: Seltenheit[];
  counter_regel: {
    schaden_genommen_von_counter: number;
    flugzeug_nimmt_von_panzer: number;
    rakete_nimmt_von_flugzeug: number;
    panzer_nimmt_von_rakete: number;
    quelle: string[];
  };
  formationsbonus: {
    "5x_gleicher_typ": number;
    "4x_gleicher_typ": number;
    "3plus2": number;
    "3x_gleicher_typ": number;
    gilt_auf: string[];
    quelle: string[];
  };
  helden: HeldDef[];
  datenluecken: string[];
}

export interface S7Event {
  id: string;
  name_de: string;
  start: string | null;
  dauer_tage?: number | null;
  wiederkehrend?: string | null;
  server_977_editierbar: boolean;
  quelle: string[];
  hinweis?: string | null;
}

export interface S7Fahrplan {
  saison: number;
  name_de: string;
  name_en: string;
  pre_season_erste_server: {
    datum: string | null;
    server_batch: string | null;
    quelle: string[];
    is_unsicher: boolean;
    konflikt_notiz: string | null;
  };
  server_977: {
    hinweis: string;
    pre_season_start: string | null;
    haupt_start: string | null;
    celebration_week: string | null;
    off_season: string | null;
    editierbar: boolean;
  };
  zyklus: {
    pre_season_wochen: number;
    haupt_saison_wochen: number;
    celebration_week: number;
    off_season: boolean;
    quelle: string[];
  };
  features_s7: { name: string; quelle: string[]; is_unsicher: boolean; konflikt_notiz: string | null }[];
  events: S7Event[];
}

export const kernBaum = skillsEngineer as KernBaum;
export const saisonS6 = skillsSaisonS6 as SaisonSkills;
export const heldenDefs = heldenDefinitionen as HeldenDefinitionen;
export const s7Fahrplan = saisonS7Fahrplan as S7Fahrplan;

export function skillName(s: SkillDef): string {
  return s.name_de ?? s.name_en ?? `${s.id} (Name offen)`;
}

export function alleKernSkills(baum: KernBaum): SkillDef[] {
  return [...baum.tiers.flatMap((t) => t.skills), ...baum.unplatzierte_benannte_skills];
}

export function tierFuerSkill(baum: KernBaum, id: string): number | null {
  const tier = baum.tiers.find((t) => t.skills.some((s) => s.id === id));
  return tier ? tier.level : null;
}
