import { useMemo, useState } from "react";

import { heldenDefs, kernBaum, saisonS6, s7Fahrplan, skillName, tierFuerSkill, type SkillDef } from "../data/seed";

interface Eintrag {
  id: string;
  titel: string;
  kategorie: string;
  text: string;
  quelle: string[];
}

function skillText(s: SkillDef, tier: number | null): string {
  const teile: string[] = [];
  if (tier !== null) teile.push(`Unlock ab Level ${tier}`);
  teile.push(s.max_level != null ? `Max-Level ${s.max_level}` : "Max-Level offen (DATENLÜCKE)");
  if (s.effekt_pro_level) teile.push(`Pro Stufe: ${s.effekt_pro_level}`);
  else if (s.effekt_max) teile.push(`Effekt: ${s.effekt_max}`);
  else teile.push("Effekt unbekannt");
  if (s.is_unsicher) teile.push("unsicher");
  if (s.konflikt_notiz) teile.push(`Konflikt: ${s.konflikt_notiz}`);
  return teile.join(" · ");
}

function baueEintraege(): Eintrag[] {
  const out: Eintrag[] = [];
  for (const t of kernBaum.tiers) {
    for (const s of t.skills) {
      out.push({
        id: `skill-${s.id}`,
        titel: skillName(s),
        kategorie: "Skill-Baum (Engineer-Kern)",
        text: skillText(s, t.level),
        quelle: s.quelle.length > 0 ? s.quelle : ["nutzerangabe"],
      });
    }
  }
  for (const s of saisonS6.skills) {
    out.push({
      id: `s6-${s.id}`,
      titel: skillName(s),
      kategorie: `Saison-Spalte S6 (${saisonS6.name_de})`,
      text: skillText(s, s.unlock_level ?? tierFuerSkill(kernBaum, s.id)),
      quelle: s.quelle.length > 0 ? s.quelle : ["nutzerangabe"],
    });
  }
  for (const h of heldenDefs.helden) {
    out.push({
      id: `held-${h.id}`,
      titel: h.name ?? `${h.id} (Name offen)`,
      kategorie: "Helden",
      text: [
        `Seltenheit: ${h.seltenheit ?? "offen"} · Typ: ${h.typ ?? "offen"} · Rolle: ${h.rolle ?? "offen"}`,
        h.promotable ? "promotable SSR→UR (ab 5★)" : "",
        h.erweckung ? "Erweckung verfügbar" : "",
        "Basiswerte: null (DATENLÜCKE)",
        h.konflikt_notiz ?? "",
      ]
        .filter((x) => x !== "")
        .join(" · "),
      quelle: h.quelle.length > 0 ? h.quelle : ["nutzerangabe"],
    });
  }
  const f = heldenDefs.formationsbonus;
  out.push({
    id: "regel-formation",
    titel: "Formationsbonus",
    kategorie: "Regeln",
    text: `5x +${(f["5x_gleicher_typ"] * 100).toFixed(0)} % · 4x +${(f["4x_gleicher_typ"] * 100).toFixed(0)} % · 3+2 +${(f["3plus2"] * 100).toFixed(0)} % · 3x +${(f["3x_gleicher_typ"] * 100).toFixed(0)} % auf HP/Angriff/Verteidigung; Squad = ${heldenDefs.squad_groesse} Helden`,
    quelle: f.quelle,
  });
  const c = heldenDefs.counter_regel;
  out.push({
    id: "regel-counter",
    titel: "Typ-Counter",
    kategorie: "Regeln",
    text: `Flugzeug nimmt ${(c.flugzeug_nimmt_von_panzer * 100).toFixed(0)} % von Panzern · Rakete ${(c.rakete_nimmt_von_flugzeug * 100).toFixed(0)} % von Flugzeug · Panzer ${(c.panzer_nimmt_von_rakete * 100).toFixed(0)} % von Rakete`,
    quelle: c.quelle,
  });
  out.push({
    id: "datenluecken",
    titel: "DATENLÜCKEN (nie still glätten)",
    kategorie: "Regeln",
    text: heldenDefs.datenluecken.join(" · "),
    quelle: ["nutzerangabe"],
  });
  out.push({
    id: "s7-fahrplan",
    titel: `S${s7Fahrplan.saison} ${s7Fahrplan.name_de} — Fahrplan`,
    kategorie: "Saisons",
    text: `Präseason erste Batch (${s7Fahrplan.pre_season_erste_server.server_batch ?? "?"}): ${s7Fahrplan.pre_season_erste_server.datum ?? "offen"} · Zyklus ${s7Fahrplan.zyklus.pre_season_wochen}/${s7Fahrplan.zyklus.haupt_saison_wochen}/${s7Fahrplan.zyklus.celebration_week} Wo. · Server 977: ${s7Fahrplan.server_977.pre_season_start === null ? "Termine null (editierbar)" : "gesetzt"}`,
    quelle: s7Fahrplan.pre_season_erste_server.quelle,
  });
  return out;
}

export function Enzyklopaedie() {
  const [filter, setFilter] = useState("");
  const eintraege = useMemo(baueEintraege, []);
  const gefiltert = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (f === "") return eintraege;
    return eintraege.filter(
      (e) =>
        e.titel.toLowerCase().includes(f) ||
        e.kategorie.toLowerCase().includes(f) ||
        e.text.toLowerCase().includes(f),
    );
  }, [eintraege, filter]);

  const gruppen = useMemo(() => {
    const map = new Map<string, Eintrag[]>();
    for (const e of gefiltert) {
      const list = map.get(e.kategorie) ?? [];
      list.push(e);
      map.set(e.kategorie, list);
    }
    return [...map.entries()];
  }, [gefiltert]);

  return (
    <section className="panel">
      <h2>Enzyklopädie ({eintraege.length} Einträge)</h2>
      <input
        className="suchfeld"
        placeholder="Suchen…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {gruppen.map(([kat, list]) => (
        <div key={kat}>
          <h3>{kat}</h3>
          <ul className="enzyk-list">
            {list.map((e) => (
              <li key={e.id} title={e.quelle.join(", ")}>
                <strong>{e.titel}</strong> — {e.text}
                <span className="quelle"> [{e.quelle.join(", ")}]</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
