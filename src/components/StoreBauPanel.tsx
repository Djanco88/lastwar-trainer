import { useMemo, useState } from "react";

import {
  bauzeitFormat,
  letzterMontag0000,
  naechsterMontag0000,
  naechsterMonatserster,
  speedupRechner,
  storeKauf,
  useApp,
  type StoreEintrag,
} from "../state/store";

export function StoreBauPanel() {
  const { profil, setProfil } = useApp();
  const [letzterReset, setLetzterReset] = useState<string>(
    letzterMontag0000(new Date()).toISOString().slice(0, 10),
  );
  const [dauerStunden, setDauerStunden] = useState(24);
  const [kaufBetrag, setKaufBetrag] = useState<Record<string, string>>({});

  const jetzt = new Date();
  const naechsterReset = naechsterMontag0000(jetzt);
  const naechsterMonat = naechsterMonatserster(jetzt);

  const setEintrag = (idx: number, patch: Partial<StoreEintrag>): void => {
    const store_limits = profil.store_limits.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    setProfil({ ...profil, store_limits });
  };

  const kaufErfassen = (idx: number): void => {
    const betrag = Number(kaufBetrag[idx] ?? 0);
    if (!Number.isFinite(betrag) || betrag <= 0) return;
    const resetDate = new Date(letzterReset + "T00:00:00");
    const store_limits = profil.store_limits.map((e, i) =>
      i === idx ? storeKauf(e, betrag, resetDate, jetzt) : e,
    );
    setProfil({ ...profil, store_limits });
  };

  const ergebnis = useMemo(
    () => speedupRechner(dauerStunden * 3600, profil.beschleuniger),
    [dauerStunden, profil.beschleuniger],
  );

  return (
    <section className="panel">
      <h2>Store-Tracker (Reset: Montag 0:00 Serverzeit)</h2>
      <p className="hinweis">
       Letzter Reset: {letzterMontag0000(jetzt).toISOString().slice(0, 10)} · nächster Wochen-Reset:{" "}
        {naechsterReset.toISOString().slice(0, 10)} 00:00 · nächster Monats-Reset:{" "}
        {naechsterMonat.toISOString().slice(0, 10)} 00:00
      </p>
      <label>
        Letzter Reset (editierbar, Serverzeit):
        <input type="date" value={letzterReset} onChange={(e) => setLetzterReset(e.target.value)} />
      </label>
      <table className="events">
        <thead>
          <tr>
            <th>Artikel</th>
            <th>Limit/Woche</th>
            <th>Limit/Monat</th>
            <th>gekauft/Woche</th>
            <th>gekauft/Monat</th>
            <th>verbleibend</th>
            <th>Kauf erfassen</th>
          </tr>
        </thead>
        <tbody>
          {profil.store_limits.map((e, idx) => (
            <tr key={idx}>
              <td>
                <input value={e.name} onChange={(ev) => setEintrag(idx, { name: ev.target.value })} />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={e.pro_woche ?? ""}
                  placeholder="—"
                  onChange={(ev) => setEintrag(idx, { pro_woche: ev.target.value === "" ? null : Number(ev.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={e.pro_monat ?? ""}
                  placeholder="—"
                  onChange={(ev) => setEintrag(idx, { pro_monat: ev.target.value === "" ? null : Number(ev.target.value) })}
                />
              </td>
              <td>{e.gekauft_woche}</td>
              <td>{e.gekauft_monat}</td>
              <td>
                {e.pro_woche !== null ? `Woche: ${Math.max(0, e.pro_woche - e.gekauft_woche)}` : ""}
                {e.pro_woche !== null && e.pro_monat !== null ? " · " : ""}
                {e.pro_monat !== null ? `Monat: ${Math.max(0, e.pro_monat - e.gekauft_monat)}` : ""}
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  style={{ width: 70 }}
                  value={kaufBetrag[idx] ?? ""}
                  onChange={(ev) => setKaufBetrag((k) => ({ ...k, [idx]: ev.target.value }))}
                />
                <button onClick={() => kaufErfassen(idx)}>+</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() =>
          setProfil({
            ...profil,
            store_limits: [
              ...profil.store_limits,
              { name: "Neuer Artikel", pro_woche: null, pro_monat: null, gekauft_woche: 0, gekauft_monat: 0 },
            ],
          })
        }
      >
        Artikel hinzufügen
      </button>

      <h2>Bau-/Speedup-Rechner</h2>
      <label>
        Projekt-Dauer (Stunden):
        <input
          type="number"
          min={0}
          step={0.5}
          value={dauerStunden}
          onChange={(e) => setDauerStunden(Number(e.target.value))}
        />
      </label>
      <p>
        Speedups im Profil: Bau 1h × {profil.beschleuniger.bau_1h} · Forschung 1h × {profil.beschleuniger.forschung_1h} ·
        Heilung 5min × {profil.beschleuniger.heilung_5min} · Universal 5min × {profil.beschleuniger.universal_5min}
      </p>
      <p>
        Deckung: <strong>{ergebnis.deckungProzent.toFixed(1)} %</strong> ({bauzeitFormat(ergebnis.gedecktSek)} gedeckt) ·
        Rest: <strong>{bauzeitFormat(ergebnis.restSek)}</strong> · Überhang: {bauzeitFormat(ergebnis.ueberhangSek)} ·{" "}
        {ergebnis.vollstaendig ? "vollständig gedeckt" : "nicht vollständig gedeckt"}
      </p>
    </section>
  );
}
