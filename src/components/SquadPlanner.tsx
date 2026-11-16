import { useMemo, useState } from "react";

import { heldenDefs, type HeroTyp } from "../data/seed";
import {
  fehlendeWerte,
  formationBonusProzent,
  heldenStaerke,
  mitOverrides,
  optimiereSquad,
  useApp,
  type HeldInstanz,
  type SquadOption,
} from "../state/store";

const TYPEN: HeroTyp[] = ["panzer", "rakete", "flugzeug"];

function heldName(id: string): string {
  return heldenDefs.helden.find((d) => d.id === id)?.name ?? id;
}

function SquadConfigurator() {
  const { profil, setProfil } = useApp();
  const [gegner, setGegner] = useState<HeroTyp | "">(("") as HeroTyp | "");
  const [topN, setTopN] = useState(5);
  const [sandbox, setSandbox] = useState(true);
  const [fixierungen, setFixierungen] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<HeldInstanz>>>({});

  const effective = useMemo(() => mitOverrides(profil, overrides), [profil, overrides]);
  const optionen: SquadOption[] = useMemo(
    () => optimiereSquad(effective, gegner === "" ? null : gegner, fixierungen, topN),
    [effective, gegner, fixierungen, topN],
  );
  const fehlende = useMemo(() => fehlendeWerte(effective.helden), [effective]);

  const setFeld = (heldId: string, feld: string, wert: string): void => {
    const num = wert === "" ? null : Number(wert);
    const patch = { [feld]: num } as Partial<HeldInstanz>;
    if (sandbox) {
      setOverrides((o) => ({ ...o, [heldId]: { ...o[heldId], ...patch } }));
    } else {
      const helden = profil.helden.map((h) => (h.held_id === heldId ? { ...h, ...patch } : h));
      setProfil({ ...profil, helden });
    }
  };

  const toggleFix = (id: string): void => {
    setFixierungen((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  };

  const uebernehmen = (opt: SquadOption): void => {
    if (sandbox) return;
    setProfil({ ...profil, squad: opt.helden });
  };

  return (
    <div className="configurator">
      <div className="config-row">
        <label>
          Gegner-Typ (Counter):
          <select value={gegner} onChange={(e) => setGegner(e.target.value as HeroTyp | "")}>
            <option value="">keiner</option>
            {TYPEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Top-N:
          <input type="number" min={1} max={20} value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
          Sandbox (Profil nicht ändern)
        </label>
      </div>
      <div className="fix-row">
        <span>Fixierungen:</span>
        {profil.helden.map((h) => (
          <button
            key={h.held_id}
            className={`fix-btn${fixierungen.includes(h.held_id) ? " aktiv" : ""}`}
            onClick={() => toggleFix(h.held_id)}
          >
            {heldenDefs.helden.find((d) => d.id === h.held_id)?.name ?? h.held_id}
          </button>
        ))}
      </div>
      {fehlende.length > 0 && (
        <div className="prompt-werte">
          <strong>Fehlende Werte — Prompt bei Abfrage (werden als nutzerangabe erfasst):</strong>
          <div className="prompt-grid">
            {fehlende.map((f) => {
              const inst = effective.helden.find((h) => h.held_id === f.held_id);
              const wert = inst ? (inst as unknown as Record<string, number | null>)[f.feld] : null;
              return (
                <label key={f.held_id + f.feld}>
                  {heldName(f.held_id)} · {f.feld}
                  <input
                    type="number"
                    min={0}
                    value={wert ?? ""}
                    placeholder="offen"
                    onChange={(e) => setFeld(f.held_id, f.feld, e.target.value)}
                  />
                </label>
              );
            })}
          </div>
          {sandbox && (
            <span className="hinweis">
              Sandbox-Modus: Eingaben gelten nur für diese Rechnung — das Profil bleibt unverändert.
            </span>
          )}
        </div>
      )}
      <ol className="optionen">
        {optionen.map((o, i) => (
          <li key={i} className="option">
            <div className="option-head">
              <strong>#{i + 1}</strong> Score {o.score.toFixed(0)} · Formation x{o.formation_faktor.toFixed(2)} · Counter
              x{o.counter_faktor.toFixed(2)}
            </div>
            <div className="begruendung">{o.begruendung}</div>
            <button onClick={() => uebernehmen(o)} disabled={sandbox}>
              {sandbox ? "Sandbox — keine Übernahme" : "In Squad übernehmen"}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SquadPlanner() {
  const { profil } = useApp();
  const squadHelden = profil.squad
    .map((id) => profil.helden.find((h) => h.held_id === id))
    .filter((h) => h !== undefined)
    .map((h) => h.held_id);
  const typen = squadHelden
    .map((id) => heldenDefs.helden.find((d) => d.id === id)?.typ)
    .filter((t): t is HeroTyp => t !== null && t !== undefined);
  const bonus = formationBonusProzent(typen);
  const staerke = profil.squad.reduce((a, id) => {
    const h = profil.helden.find((x) => x.held_id === id);
    return h ? a + heldenStaerke(h) : a;
  }, 0);

  return (
    <section className="panel">
      <h2>Squad-Planer (Squad = {heldenDefs.squad_groesse} Helden)</h2>
      <div className="squad-aktuell">
        <h3>Aktueller Squad</h3>
        {profil.squad.length === 0 ? (
          <p className="hinweis">Noch kein Squad erfasst — im Konfigurator unten zusammenstellen.</p>
        ) : (
          <>
            <div className="squad-chips">
              {profil.squad.map((id) => (
                <span key={id} className="chip">
                  {heldenDefs.helden.find((d) => d.id === id)?.name ?? id}
                </span>
              ))}
            </div>
            <p>
              Formationsbonus: <strong>+{(bonus * 100).toFixed(0)} %</strong> (Faktor {(1 + bonus).toFixed(2)}) auf
              HP/Angriff/Verteidigung · Heldenstärke-Summe {staerke.toFixed(0)}
            </p>
          </>
        )}
        <p className="hinweis">
          Counter: Flugzeug nimmt 80 % von Panzer · Rakete 80 % von Flugzeug · Panzer 80 % von Rakete (Quellen:{" "}
          {heldenDefs.counter_regel.quelle.join(", ")})
        </p>
      </div>
      <h3>Squad-Konfigurator</h3>
      <SquadConfigurator />
    </section>
  );
}
