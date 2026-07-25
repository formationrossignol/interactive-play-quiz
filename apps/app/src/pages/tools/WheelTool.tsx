import { useState } from "react";
import { Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SpinWheel } from "@/components/tools/SpinWheel";
import { useSEO } from "@/hooks/useSEO";

const DEFAULT_ITEMS = ["Alex", "Camille", "Dominique", "Jordan", "Léa", "Sacha"];
const STORAGE_KEY = "tools-wheel-items";

const loadItems = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ITEMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((i) => typeof i === "string") && parsed.length > 0
      ? parsed
      : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
};

const WheelTool = () => {
  useSEO({
    title: "Roue de tirage au sort",
    description: "Tirez un nom ou une option au hasard parmi une liste, en un clic.",
    path: "/tools/wheel",
  });

  const [items, setItems] = useState<string[]>(loadItems);
  const [draft, setDraft] = useState(items.join("\n"));
  const [winner, setWinner] = useState<string | null>(null);

  const applyDraft = () => {
    const next = draft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    setItems(next);
    setWinner(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const removeWinnerFromList = () => {
    if (!winner) return;
    const next = items.filter((item) => item !== winner);
    setItems(next);
    setDraft(next.join("\n"));
    setWinner(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <AppLayout subtitle="Roue de tirage au sort">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div style={{ marginBottom: "32px" }}>
          <h1 className="ap-h2" style={{ fontSize: "26px", marginBottom: "4px" }}>Roue de tirage au sort</h1>
          <p className="ap-muted" style={{ fontSize: "14px" }}>
            Un nom ou une option par ligne, puis lancez la roue.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) 1fr", gap: "32px", alignItems: "start" }}>
          <div className="ap-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <label htmlFor="wheel-items" className="ap-h3" style={{ fontSize: "14px" }}>Éléments</label>
            <textarea
              id="wheel-items"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={applyDraft}
              rows={10}
              style={{
                width: "100%",
                resize: "vertical",
                padding: "10px 12px",
                borderRadius: "var(--ap-r-sm)",
                border: "var(--ap-border-w) solid var(--ap-line)",
                background: "var(--ap-paper-2)",
                color: "var(--ap-ink)",
                fontFamily: "var(--ap-font-body)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button type="button" className="ap-btn ap-btn--sm" onClick={applyDraft}>
              Mettre à jour la roue
            </button>
            <p className="ap-muted" style={{ fontSize: 12, margin: 0 }}>
              {items.length} élément{items.length > 1 ? "s" : ""} — minimum 2 pour lancer.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            <SpinWheel items={items} onResult={(item) => setWinner(item)} />

            {winner && (
              <div className="ap-card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div>
                  <p className="ap-muted" style={{ fontSize: 12, margin: 0 }}>Résultat</p>
                  <p className="ap-h3" style={{ fontSize: 20, margin: 0 }}>{winner}</p>
                </div>
                <button
                  type="button"
                  className="ap-btn ap-btn--ghost ap-btn--sm"
                  onClick={removeWinnerFromList}
                  title="Retirer de la liste"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Retirer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default WheelTool;
