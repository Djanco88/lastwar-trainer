import { heldenDefs, type HeldDef } from "../data/seed";
import { useApp, type HeldInstanz } from "../state/store";

function defAnzeige(d: HeldDef): string {
  return d.name ?? `${d.id} (Name offen)`;
}

export function HeroCard({ instanz }: { instanz: HeldInstanz }) {
  const { profil, setProfil } = useApp();
  const def = heldenDefs.helden.find((d) => d.id === instanz.held_id);

  const update = (patch: Partial<HeldInstanz>): void => {
    const helden = profil.helden.map((h) => (h.held_id === instanz.held_id ? { ...h, ...patch } : h));
    setProfil({ ...profil, helden });
  };

  const setGear = (slot: number, wert: string): void => {
    const gear = [...instanz.gear];
    while (gear.length < 4) gear.push(null);
    gear[slot] = wert === "" ? null : Number(wert);
    update({ gear });
  };

  const setNum = (key: "level" | "hp" | "angriff" | "verteidigung", wert: string): void => {
    update({ [key]: wert === "" ? null : Number(wert) } as Partial<HeldInstanz>);
  };

  if (!def) return null;
  return (
    <div className={`hero-card${def.is_unsicher ? " unsicher" : ""}`} title={def.konflikt_notiz ?? undefined}>
      <div className="hero-head">
        <strong>{defAnzeige(def)}</strong>
        <span className="badge">{def.seltenheit ?? "?"}</span>
        <span className="badge">{def.typ ?? "Typ offen"}</span>
        <span className="badge">{def.rolle ?? "Rolle offen"}</span>
        {def.is_unsicher && <span className="badge unsicher">unsicher</span>}
      </div>
      <div className="hero-grid">
        <label>
          Sterne
          <input
            type="number"
            min={0}
            max={5}
            value={instanz.sterne}
            onChange={(e) => update({ sterne: Number(e.target.value) })}
          />
        </label>
        <label>
          Level (null = offen)
          <input type="number" min={1} value={instanz.level ?? ""} placeholder="offen" onChange={(e) => setNum("level", e.target.value)} />
        </label>
        <label>
          HP
          <input type="number" min={0} value={instanz.hp ?? ""} placeholder="offen" onChange={(e) => setNum("hp", e.target.value)} />
        </label>
        <label>
          Angriff
          <input type="number" min={0} value={instanz.angriff ?? ""} placeholder="offen" onChange={(e) => setNum("angriff", e.target.value)} />
        </label>
        <label>
          Verteidigung
          <input
            type="number"
            min={0}
            value={instanz.verteidigung ?? ""}
            placeholder="offen"
            onChange={(e) => setNum("verteidigung", e.target.value)}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={instanz.erweckt} onChange={(e) => update({ erweckt: e.target.checked })} />
          Erweckt
        </label>
      </div>
      <div className="gear-row">
        <span>Gear (4 Slots):</span>
        {[0, 1, 2, 3].map((slot) => (
          <input
            key={slot}
            type="number"
            min={0}
            className="gear-slot"
            value={instanz.gear[slot] ?? ""}
            placeholder={`S${slot + 1}`}
            onChange={(e) => setGear(slot, e.target.value)}
          />
        ))}
      </div>
      <button className="danger" onClick={() => setProfil({ ...profil, helden: profil.helden.filter((h) => h.held_id !== instanz.held_id) })}>
        Entfernen
      </button>
    </div>
  );
}

export function HeldenManager() {
  const { profil, setProfil } = useApp();
  const vorhandene = new Set(profil.helden.map((h) => h.held_id));
  const verfuegbar = heldenDefs.helden.filter((d) => !vorhandene.has(d.id));

  const hinzufuegen = (id: string): void => {
    if (id === "") return;
    const neu: HeldInstanz = {
      held_id: id,
      sterne: 1,
      level: null,
      hp: null,
      angriff: null,
      verteidigung: null,
      gear: [null, null, null, null],
      erweckt: false,
      erweckung_level: null,
      faehigkeiten_level: [],
    };
    setProfil({ ...profil, helden: [...profil.helden, neu] });
  };

  return (
    <section className="panel">
      <h2>Helden-Manager ({profil.helden.length} / {heldenDefs.anzahl_helden})</h2>
      <div className="add-row">
        <select value="" onChange={(e) => hinzufuegen(e.target.value)}>
          <option value="">Held hinzufügen…</option>
          {verfuegbar.map((d) => (
            <option key={d.id} value={d.id}>
              {defAnzeige(d)} {d.typ ? `(${d.typ})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="hero-list">
        {profil.helden.map((h) => (
          <HeroCard key={h.held_id} instanz={h} />
        ))}
      </div>
      {heldenDefs.datenluecken.length > 0 && (
        <div className="datenluecken">
          <h3>Datenlücken</h3>
          <ul>
            {heldenDefs.datenluecken.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
