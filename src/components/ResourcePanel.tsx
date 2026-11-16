import { useApp } from "../state/store";

export function ResourcePanel() {
  const { profil, setProfil } = useApp();

  const setRess = (key: keyof typeof profil.ressourcen, v: string): void => {
    setProfil({ ...profil, ressourcen: { ...profil.ressourcen, [key]: v === "" ? 0 : Number(v) } });
  };
  const setBeschl = (key: keyof typeof profil.beschleuniger, v: string): void => {
    setProfil({ ...profil, beschleuniger: { ...profil.beschleuniger, [key]: v === "" ? 0 : Number(v) } });
  };
  const setTech = (zweig: string, v: string): void => {
    const tech = { ...profil.tech_forschung_prozent };
    if (v === "") delete tech[zweig];
    else tech[zweig] = Number(v);
    setProfil({ ...profil, tech_forschung_prozent: tech });
  };

  return (
    <section className="panel">
      <h2>Spielstand</h2>
      <div className="grid2">
        <label>
          Server
          <input type="number" value={profil.server} onChange={(e) => setProfil({ ...profil, server: Number(e.target.value) })} />
        </label>
        <label>
          HQ-Level
          <input type="number" min={1} value={profil.hq_level} onChange={(e) => setProfil({ ...profil, hq_level: Number(e.target.value) })} />
        </label>
        <label>
          Nahrung
          <input type="number" min={0} value={profil.ressourcen.nahrung} onChange={(e) => setRess("nahrung", e.target.value)} />
        </label>
        <label>
          Eisen
          <input type="number" min={0} value={profil.ressourcen.eisen} onChange={(e) => setRess("eisen", e.target.value)} />
        </label>
        <label>
          Gold
          <input type="number" min={0} value={profil.ressourcen.gold} onChange={(e) => setRess("gold", e.target.value)} />
        </label>
        <label>
          Öl
          <input type="number" min={0} value={profil.ressourcen.oel} onChange={(e) => setRess("oel", e.target.value)} />
        </label>
        <label>
          Bau 1h
          <input type="number" min={0} value={profil.beschleuniger.bau_1h} onChange={(e) => setBeschl("bau_1h", e.target.value)} />
        </label>
        <label>
          Forschung 1h
          <input type="number" min={0} value={profil.beschleuniger.forschung_1h} onChange={(e) => setBeschl("forschung_1h", e.target.value)} />
        </label>
        <label>
          Heilung 5min
          <input type="number" min={0} value={profil.beschleuniger.heilung_5min} onChange={(e) => setBeschl("heilung_5min", e.target.value)} />
        </label>
        <label>
          Universal 5min
          <input type="number" min={0} value={profil.beschleuniger.universal_5min} onChange={(e) => setBeschl("universal_5min", e.target.value)} />
        </label>
        <label>
          VIP-Level
          <input
            type="number"
            min={0}
            value={profil.vip?.level ?? ""}
            onChange={(e) =>
              setProfil({
                ...profil,
                vip: { level: Number(e.target.value), punkte: profil.vip?.punkte ?? 0, punkte_naechster_level: profil.vip?.punkte_naechster_level ?? 0 },
              })
            }
          />
        </label>
        <label>
          VIP-Punkte
          <input
            type="number"
            min={0}
            value={profil.vip?.punkte ?? ""}
            onChange={(e) =>
              setProfil({
                ...profil,
                vip: profil.vip
                  ? { ...profil.vip, punkte: Number(e.target.value) }
                  : { level: 0, punkte: Number(e.target.value), punkte_naechster_level: 0 },
              })
            }
          />
        </label>
        <label>
          Diamanten
          <input
            type="number"
            min={0}
            value={profil.waehrungen?.diamanten ?? ""}
            onChange={(e) =>
              setProfil({
                ...profil,
                waehrungen: {
                  diamanten: Number(e.target.value),
                  universal_hero_shards: profil.waehrungen?.universal_hero_shards ?? 0,
                },
              })
            }
          />
        </label>
        <label>
          Überlebende
          <input
            type="number"
            min={0}
            value={profil.ueberlebende ?? ""}
            onChange={(e) => setProfil({ ...profil, ueberlebende: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </label>
      </div>
      <h3>Tech-Forschung je Zweig (%)</h3>
      <div className="grid2">
        {["entwicklung", "militaer", "wirtschaft"].map((zweig) => (
          <label key={zweig}>
            {zweig}
            <input
              type="number"
              min={0}
              max={100}
              value={profil.tech_forschung_prozent[zweig] ?? ""}
              placeholder="%"
              onChange={(e) => setTech(zweig, e.target.value)}
            />
          </label>
        ))}
      </div>
      <p className="hinweis">Gebäude (inkl. Mehrfachnennungen), Taktikkarten, Dekorationen: über JSON-Import/Export (M5) oder direkt im Profil-Editor.</p>
    </section>
  );
}
