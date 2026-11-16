import { useEffect, useMemo, useRef, useState } from "react";

import { Enzyklopaedie } from "./components/Enzyklopaedie";
import { EventCalendar } from "./components/EventCalendar";
import { HeldenManager } from "./components/HeroCard";
import { ResourcePanel } from "./components/ResourcePanel";
import { SaisonPanel } from "./components/SaisonPanel";
import { SkillTree } from "./components/SkillTree";
import { SquadPlanner } from "./components/SquadPlanner";
import { StoreBauPanel } from "./components/StoreBauPanel";
import { AppContext, leeresProfil, type ProfilState } from "./state/store";

type Tab = "skills" | "spielstand" | "helden" | "squad" | "saison" | "store" | "events" | "enzyklopaedie";

const TABS: { id: Tab; label: string }[] = [
  { id: "skills", label: "Skill-Baum" },
  { id: "spielstand", label: "Spielstand" },
  { id: "helden", label: "Helden" },
  { id: "squad", label: "Squad-Planer" },
  { id: "saison", label: "Saison & Respec" },
  { id: "store", label: "Store & Bau" },
  { id: "events", label: "Events S7" },
  { id: "enzyklopaedie", label: "Enzyklopädie" },
];

const STORAGE_KEY = "lastwar-trainer-profil";

function ladeProfil(): ProfilState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return leeresProfil();
    const geparst = JSON.parse(raw) as Partial<ProfilState> & { version?: number };
    if (geparst.version !== 1) return leeresProfil();
    return { ...leeresProfil(), ...geparst };
  } catch {
    return leeresProfil();
  }
}

export default function App() {
  const [profil, setProfil] = useState<ProfilState>(ladeProfil);
  const [tab, setTab] = useState<Tab>("skills");
  const [importFehler, setImportFehler] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const ctx = useMemo(() => ({ profil, setProfil }), [profil]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profil));
    } catch {
      // Speicher voll/nicht verfügbar — ignorieren
    }
  }, [profil]);

  const exportJson = (): void => {
    const json = JSON.stringify({ version: 1, ...profil }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lastwar-profil.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (datei: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const geparst = JSON.parse(String(reader.result)) as Partial<ProfilState> & { version?: number };
        if (geparst.version !== 1) {
          setImportFehler("Versionskonflikt: Datei ist nicht Profil v1.");
          return;
        }
        setProfil({ ...leeresProfil(), ...geparst });
        setImportFehler(null);
      } catch {
        setImportFehler("Ungültiges JSON — Import abgelehnt.");
      }
    };
    reader.readAsText(datei);
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <header>
          <h1>Last-War-Trainer</h1>
          <nav>
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? "aktiv" : ""} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
            <button onClick={exportJson} title="Profil als JSON exportieren (verlustfrei, Roundtrip-getestet)">
              Export JSON
            </button>
            <button onClick={() => fileRef.current?.click()} title="Profil aus JSON importieren">
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
          </nav>
          {importFehler !== null && <p className="warn">{importFehler}</p>}
        </header>
        <main>
          {tab === "skills" && <SkillTree />}
          {tab === "spielstand" && <ResourcePanel />}
          {tab === "helden" && <HeldenManager />}
          {tab === "squad" && <SquadPlanner />}
          {tab === "saison" && <SaisonPanel />}
          {tab === "store" && <StoreBauPanel />}
          {tab === "events" && <EventCalendar />}
          {tab === "enzyklopaedie" && <Enzyklopaedie />}
        </main>
        <footer>
          <span>
            Lokaler Trainer — keine Account-Anbindung, keine Automatisierung gegen das Spiel. Spiel-Assets © deren
            Hersteller (First Fun / Century Games). Unsichere Werte sind gelb markiert, Datenlücken werden als „offen“
            geführt. Export/Import verlustfrei (Roundtrip-Test in Rust).
          </span>
        </footer>
      </div>
    </AppContext.Provider>
  );
}
