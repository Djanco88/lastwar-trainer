import { useMemo } from "react";

import { alleKernSkills, kernBaum, saisonS6, skillName, tierFuerSkill, type SkillDef } from "../data/seed";
import { useApp } from "../state/store";

function prioBadge(s: SkillDef): string | null {
  if (s.prioritaet === "prio") return "PRIO";
  if (s.prioritaet === "skip") return "SKIP";
  return null;
}

function sollAllocation(): Record<string, number> {
  const budget = kernBaum.budget_punkte_lv100;
  const soll: Record<string, number> = {};
  let frei = budget;
  for (const id of kernBaum.prioritaet_reihenfolge.prio) {
    const skill = alleKernSkills(kernBaum).find((s) => s.id === id);
    if (!skill) continue;
    const tier = tierFuerSkill(kernBaum, id);
    if (tier !== null && tier > 100) continue;
    const max = skill.max_level ?? 0;
    const n = Math.min(max, frei);
    if (n > 0) {
      soll[id] = n;
      frei -= n;
    }
  }
  return soll;
}

function effektBei(s: SkillDef, level: number): string {
  if (level === 0) return "—";
  if (s.max_level === level && s.effekt_max) return s.effekt_max;
  if (s.effekt_pro_level) return `${s.effekt_pro_level} (Stufe ${level})`;
  if (s.effekt) return s.effekt;
  return "Effekt unbekannt";
}

export function SkillTree() {
  const { profil, setProfil } = useApp();
  const soll = useMemo(sollAllocation, []);
  const istGesamt = Object.values(profil.kern).reduce((a, b) => a + b, 0);
  const budget = kernBaum.budget_punkte_lv100;
  const rest = budget - istGesamt;

  const setLevel = (id: string, level: number): void => {
    const kern = { ...profil.kern };
    if (level <= 0) delete kern[id];
    else kern[id] = level;
    setProfil({ ...profil, kern });
  };

  return (
    <section className="panel">
      <h2>Skill-Baum-Trainer — Engineer-Kern (Lv.1–100)</h2>
      <div className="budget-bar">
        <div className="budget-fill" style={{ width: `${Math.min(100, (istGesamt / budget) * 100)}%` }} />
        <span className="budget-text">
          {istGesamt} / {budget} Punkte · {rest} frei
        </span>
      </div>
      {rest < 0 && <p className="warn">Budget überschritten!</p>}
      {kernBaum.budget_hinweis && <p className="hinweis">{kernBaum.budget_hinweis}</p>}
      {kernBaum.tiers.map((tier) => (
        <div className="tier" key={tier.level}>
          <h3>Tier Lv.{tier.level}</h3>
          <div className="skills">
            {tier.skills.map((s) => {
              const ist = profil.kern[s.id] ?? 0;
              const sollLvl = soll[s.id] ?? 0;
              const max = s.max_level ?? 0;
              const badge = prioBadge(s);
              return (
                <div
                  key={s.id}
                  className={`skill-card${badge === "PRIO" ? " prio" : ""}${badge === "SKIP" ? " skip" : ""}${s.is_unsicher ? " unsicher" : ""}`}
                  title={s.konflikt_notiz ?? undefined}
                >
                  <div className="skill-head">
                    <strong>{skillName(s)}</strong>
                    {badge && <span className={`badge ${badge.toLowerCase()}`}>{badge}</span>}
                    {s.is_unsicher && <span className="badge unsicher">unsicher</span>}
                  </div>
                  <div className="skill-meta">
                    <span>
                      Ist {ist} / Soll {sollLvl} / Max {max > 0 ? max : "?"}
                    </span>
                    {ist !== sollLvl && (
                      <span className={sollLvl > ist ? "diff-up" : "diff-down"}>
                        {sollLvl > ist ? `+${sollLvl - ist}` : `${sollLvl - ist}`}
                      </span>
                    )}
                  </div>
                  <div className="skill-controls">
                    <button onClick={() => setLevel(s.id, Math.max(0, ist - 1))} disabled={ist === 0}>
                      −
                    </button>
                    <button onClick={() => setLevel(s.id, Math.min(max > 0 ? max : ist + 1, ist + 1))} disabled={max > 0 && ist >= max}>
                      +
                    </button>
                  </div>
                  <div className="effekt">Effekt: {effektBei(s, ist)}</div>
                  {s.quelle.length > 0 && <div className="quelle">Quellen: {s.quelle.join(", ")}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <h3>Benannte, tier-offene Skills (DATENLÜCKE)</h3>
      <div className="skills">
        {kernBaum.unplatzierte_benannte_skills.map((s) => (
          <div key={s.id} className={`skill-card${s.is_unsicher ? " unsicher" : ""}`} title={s.konflikt_notiz ?? undefined}>
            <div className="skill-head">
              <strong>{skillName(s)}</strong>
              {prioBadge(s) && <span className={`badge ${prioBadge(s)?.toLowerCase()}`}>{prioBadge(s)}</span>}
            </div>
            <div className="skill-meta">Tier unbekannt · Max unbekannt</div>
            <div className="effekt">Effekt: unbekannt</div>
          </div>
        ))}
      </div>
      <h3>Saison-Spalte S6 — {saisonS6.name_de}</h3>
      <p className="hinweis">
        {saisonS6.anzahl_skills} Skills, Budget {saisonS6.punkte_budget} Punkte, Erstattung bei Saisonende:{" "}
        {saisonS6.erstattung_bei_saisonende ? "ja" : "nein"}. Im Profil:{" "}
        {Object.values(profil.saisonS6).reduce((a, b) => a + b, 0)} / {saisonS6.punkte_budget} Punkte.
      </p>
      <div className="skills">
        {saisonS6.skills.map((s) => (
          <div key={s.id} className={`skill-card${s.is_unsicher ? " unsicher" : ""}`} title={s.konflikt_notiz ?? undefined}>
            <div className="skill-head">
              <strong>{skillName(s)}</strong>
              {s.prioritaet === "prio" && <span className="badge prio">PRIO</span>}
            </div>
            <div className="skill-meta">
              Unlock {s.unlock_level ?? "?"} · Max {s.max_level ?? "?"} · Ist {profil.saisonS6[s.id] ?? 0}
            </div>
            <div className="effekt">{s.effekt_max ?? s.effekt_pro_level ?? s.effekt ?? "Effekt unbekannt"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
