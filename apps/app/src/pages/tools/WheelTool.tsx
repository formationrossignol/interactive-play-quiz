import { useEffect, useState } from "react";
import { RotateCw, Trash2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SpinWheel } from "@/components/tools/SpinWheel";
import { useSEO } from "@/hooks/useSEO";

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const panelStyle: React.CSSProperties = {
  width: "min(380px, 90vw)",
  background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)",
  borderRadius: "var(--ap-r-lg)", boxShadow: "var(--ap-shadow-card)", padding: 28,
  textAlign: "center", position: "relative",
};

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
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!winner) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWinner(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [winner]);

  const applyDraft = () => {
    const next = draft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    setItems(next);
    setWinner(null);
    setWinnerIndex(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const removeWinnerFromList = () => {
    if (winnerIndex === null) return;
    // Filter by the drawn index, not the text value — items can contain
    // intentional duplicates (weighting the wheel), and removing by value
    // would delete every occurrence instead of just the one drawn.
    const next = items.filter((_, idx) => idx !== winnerIndex);
    setItems(next);
    setDraft(next.join("\n"));
    setWinner(null);
    setWinnerIndex(null);
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
            <SpinWheel items={items} onResult={(item, index) => { setWinner(item); setWinnerIndex(index); }} />
          </div>
        </div>
      </div>

      {winner && (
        <div style={overlayStyle} onClick={() => { setWinner(null); setWinnerIndex(null); }}>
          <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { setWinner(null); setWinnerIndex(null); }}
              className="ap-btn ap-btn--ghost ap-btn--sm ap-icon-btn"
              aria-label="Fermer"
              style={{ position: "absolute", top: 12, right: 12 }}
            >
              <X className="h-4 w-4" />
            </button>

            <p className="ap-muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Le résultat est...</p>
            <p
              className="ap-h2"
              style={{ fontSize: 28, margin: "0 0 24px", color: "var(--ap-brand)", overflowWrap: "break-word" }}
            >
              {winner}
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="ap-btn ap-btn--sm" onClick={() => { setWinner(null); setWinnerIndex(null); }}>
                <RotateCw className="h-3.5 w-3.5" />
                Rejouer
              </button>
              <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={removeWinnerFromList}>
                <Trash2 className="h-3.5 w-3.5" />
                Retirer de la liste
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default WheelTool;
