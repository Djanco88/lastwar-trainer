import { useMemo, useState } from "react";

import { saisonS6, s7Fahrplan, skillName } from "../data/seed";
import {
  countdownTage,
  respecPlanNachSaisonende,
  s7Phasen,
  useApp,
  validateSaisonAllocation,
} from "../state/store";

export function SaisonPanel() {
  const { profil, setProfil } = useApp();
  const [plan, setPlan] = useState<ReturnType<typeof respecPlanNachSaisonende> | null>(null);
  const [s7Start, setS7Start] = useState<string>(s7Fahrplan.pre_season_erste_server.datum ?? "");

  const summe = Object.values(profil.saisonS6).reduce((a, b) => a + b, 0);
  const fehler = useMemo(
    () => validateSaisonAllocation(profil.saisonS6, profil.profession_level),
    [profil.saisonS6, profil.profession_level],
  );

  const setS6 = (id: string, level: number): void => {
    const neu = { ...profil.saisonS6 };
    if (level <= 0) delete neu[id];
    else neu[id] = level;
    setProfil({ ...profil, saisonS6: neu });
  };

  const kannPlus = (idx: number): boolean => {
    const alleVorher = saisonS6.skills.slice(0, idx).every((s) => (profil.saisonS6[s.id] ?? 0) > 0);
    return alleVorher;
  };
  const kannMinus = (idx: number): boolean => {
    const keineNachher = saisonS6.skills.slice(idx + 1).every((s) => (profil.saisonS6[s.id] ?? 0) === 0);
    return keineNachher;
  };

  const planAnzeigen = (): void => {
    setPlan(respecPlanNachSaisonende(profil.saisonS6, profil.kern, profil.profession_level));
  };
  const planUebernehmen = (): void => {
    if (!plan) return;
    setProfil({ ...profil, kern: plan.kernZiel, saisonS6: plan.saisonZiel });
    setPlan(null);
  };

  const phasen = useMemo(() => s7Phasen(s7Start === "" ? null : s7Start), [s7Start]);

  return (
    <section className="panel">
      <h2>Saison-Spalte S6 — {saisonS6.name_de}</h2>
      <div className="budget-bar">
        <div
          className="budget-fill"
          style={{ width: `${Math.min(100, (summe / saisonS6.punkte_budget) * 100)}%` }}
        />
        <span className="budget-text">
          {summe} / {saisonS6.punkte_budget} Punkte · Erstattung bei Saisonende:{" "}
          {saisonS6.erstattung_bei_saisonende ? "ja" : "nein"}
        </span>
      </div>
      {fehler.map((f) => (
        <p key={f} className="warn">
          {f}
        </p>
      ))}
      <p className="hinweis">
        Lineare Kette: ein Skill wird erst freigeschaltet, wenn alle vorherigen mindestens 1 Punkt haben (kein
        Überspringen). Unlock-Level und Max-Level laut Seed; „?“ = DATENLÜCKE.
      </p>
      <div className="skills">
        {saisonS6.skills.map((s, idx) => {
          const ist = profil.saisonS6[s.id] ?? 0;
          const max = s.max_level ?? 0;
          return (
            <div key={s.id} className={`skill-card${s.is_unsicher ? " unsicher" : ""}`} title={s.konflikt_notiz ?? undefined}>
              <div className="skill-head">
                <strong>{skillName(s)}</strong>
                {s.prioritaet === "prio" && <span className="badge prio">PRIO</span>}
                {s.profession_exklusiv && <span className="badge">{s.profession_exklusiv}</span>}
              </div>
              <div className="skill-meta">
                <span>
                  Unlock {s.unlock_level ?? "?"} · Max {max > 0 ? max : "?"} · Ist {ist}
                </span>
              </div>
              <div className="skill-controls">
                <button onClick={() => setS6(s.id, ist - 1)} disabled={ist === 0 || !kannMinus(idx)}>
                  −
                </button>
                <button
                  onClick={() => setS6(s.id, ist + 1)}
                  disabled={(max > 0 && ist >= max) || !kannPlus(idx) || summe >= saisonS6.punkte_budget}
                >
                  +
                </button>
              </div>
              <div className="effekt">{s.effekt_max ?? s.effekt_pro_level ?? s.effekt ?? "Effekt unbekannt"}</div>
            </div>
          );
        })}
      </div>

      <h3>Respec-Planer (Saisonende)</h3>
      <div className="config-row">
        <button onClick={planAnzeigen}>Respec-Plan berechnen (Erstattung einrechnen)</button>
        {plan && (
          <button onClick={planUebernehmen} disabled={fehler.length > 0}>
            Plan übernehmen (Kern neu setzen, S6 leeren)
          </button>
        )}
      </div>
      {plan && (
        <div className="prompt-werte">
          {plan.erklaerung.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          <ul className="enzyk-list">
            {Object.entries(plan.kernZiel).map(([id, lvl]) => (
              <li key={id}>
                {id}: Ist {profil.kern[id] ?? 0} → Soll {lvl}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>S7-Startplan (Server 977 — editierbar)</h3>
      <p className="warn">{s7Fahrplan.server_977.hinweis}</p>
      <label>
        Präseason-Start Server 977 (Datum):
        <input type="date" value={s7Start} onChange={(e) => setS7Start(e.target.value)} />
      </label>
      <table className="events">
        <thead>
          <tr>
            <th>Phase</th>
            <th>Start</th>
            <th>Dauer</th>
            <th>Countdown</th>
          </tr>
        </thead>
        <tbody>
          {phasen.map((p) => {
            const tage = countdownTage(p.start);
            return (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.start ?? "null (offen)"}</td>
                <td>{p.dauerTage > 0 ? `${p.dauerTage} Tage` : "—"}</td>
                <td>{tage === null ? "—" : tage >= 0 ? `${tage} Tage` : `seit ${-tage} Tagen`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
