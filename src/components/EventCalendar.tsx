import { useState } from "react";

import { s7Fahrplan, type S7Event } from "../data/seed";

function tageBis(datum: string | null): number | null {
  if (!datum) return null;
  const ziel = new Date(datum + "T00:00:00").getTime();
  if (Number.isNaN(ziel)) return null;
  const diff = ziel - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export function EventCalendar() {
  const [termine, setTermine] = useState<Record<string, string>>({});

  const setTermin = (id: string, wert: string): void => {
    setTermine((t) => ({ ...t, [id]: wert }));
  };

  const events: S7Event[] = s7Fahrplan.events;

  return (
    <section className="panel">
      <h2>Event-Kalender — S{s7Fahrplan.saison} {s7Fahrplan.name_de}</h2>
      <p className="hinweis">
        Präseason erste Server-Batch ({s7Fahrplan.pre_season_erste_server.server_batch ?? "?"}):{" "}
        {s7Fahrplan.pre_season_erste_server.datum ?? "offen"} (Quellen:{" "}
        {s7Fahrplan.pre_season_erste_server.quelle.join(", ")}).
      </p>
      <p className="warn">{s7Fahrplan.server_977.hinweis}</p>
      <table className="events">
        <thead>
          <tr>
            <th>Event</th>
            <th>Start (Server 977, editierbar)</th>
            <th>Countdown</th>
            <th>Wiederkehrend</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const start = termine[e.id] ?? e.start ?? "";
            const tage = tageBis(termine[e.id] ?? e.start);
            return (
              <tr key={e.id} title={e.hinweis ?? undefined}>
                <td>{e.name_de}</td>
                <td>
                  {e.server_977_editierbar ? (
                    <input type="date" value={start} onChange={(ev) => setTermin(e.id, ev.target.value)} />
                  ) : (
                    (e.start ?? "—")
                  )}
                </td>
                <td>{tage === null ? "—" : tage >= 0 ? `${tage} Tage` : `seit ${-tage} Tagen`}</td>
                <td>{e.wiederkehrend ?? (e.dauer_tage ? `${e.dauer_tage} Tage` : "—")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hinweis">Store-Reset: Montag 0:00 Serverzeit (Wochen-/Monatslimits).</p>
    </section>
  );
}
