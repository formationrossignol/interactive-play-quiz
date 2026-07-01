import { useState } from "react";
import { Clock, RotateCcw, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SavedQuiz } from "@/lib/quizStorage";

interface TrashViewProps {
  items: SavedQuiz[];
  viewMode: "grid" | "list";
  onRestore: (id: string) => void;
  onPermanentDelete: (item: SavedQuiz) => void;
}

type TrashSort = "newest" | "oldest" | "az";

const daysRemaining = (deletedAt: string) => {
  const elapsed = Date.now() - new Date(deletedAt).getTime();
  return Math.max(0, 30 - Math.floor(elapsed / (1000 * 60 * 60 * 24)));
};

const triggerStyle = {
  fontFamily: "var(--ap-font-body)",
  fontWeight: 700,
  fontSize: "14px",
  border: "2px solid var(--ap-line)",
  borderRadius: "var(--ap-r-sm)",
  background: "var(--ap-card)",
  color: "var(--ap-ink)",
  height: "42px",
};

export const TrashView = ({ items, viewMode, onRestore, onPermanentDelete }: TrashViewProps) => {
  const [sort, setSort] = useState<TrashSort>("newest");

  const sorted = [...items].sort((a, b) => {
    if (sort === "oldest") return (a.deletedAt ?? "").localeCompare(b.deletedAt ?? "");
    if (sort === "az") return a.title.localeCompare(b.title, "fr");
    return (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "");
  });

  if (items.length === 0) {
    return (
      <div
        style={{
          borderRadius: "var(--ap-r-lg)",
          border: "2px dashed var(--ap-line-2)",
          background: "var(--ap-paper-2)",
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <Trash2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--ap-muted)" }} />
        <p className="ap-muted" style={{ fontSize: "14px" }}>La corbeille est vide.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <p
          className="ap-muted"
          style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          Suppression automatique après 30 jours.
        </p>
        <Select value={sort} onValueChange={(v) => setSort(v as TrashSort)}>
          <SelectTrigger className="w-[160px]" style={triggerStyle}>
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent
            style={{
              background: "var(--ap-card)",
              border: "2px solid var(--ap-line)",
              borderRadius: "var(--ap-r-md)",
            }}
          >
            <SelectItem value="newest">Plus récent</SelectItem>
            <SelectItem value="oldest">Plus ancien</SelectItem>
            <SelectItem value="az">A → Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {viewMode === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => {
            const days = daysRemaining(item.deletedAt!);
            return (
              <div
                key={item.id}
                className="ap-card flex flex-col"
                style={{ opacity: 0.8 }}
              >
                <div className="flex-1 mb-3">
                  <h3 className="ap-h3 truncate" style={{ fontSize: "15px" }}>
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="ap-muted mt-1 text-sm line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div
                  className="flex items-center justify-between gap-2 pt-3"
                  style={{ borderTop: "2px solid var(--ap-line)" }}
                >
                  <span
                    className="text-xs font-semibold"
                    style={{ color: days <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)" }}
                  >
                    {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
                  </span>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={() => onRestore(item.id)}
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                    </button>
                    <button
                      onClick={() => onPermanentDelete(item)}
                      className="ap-btn ap-btn--ghost ap-btn--sm"
                      style={{ color: "var(--ap-quiz)", padding: "5px 7px" }}
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ap-card" style={{ padding: 0, overflow: "hidden" }}>
          {sorted.map((item) => {
            const days = daysRemaining(item.deletedAt!);
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: "2px solid var(--ap-line)", opacity: 0.85 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="ap-muted truncate" style={{ fontSize: "12px" }}>
                      {item.description}
                    </p>
                  )}
                </div>
                <span
                  className="text-xs font-semibold flex-shrink-0"
                  style={{ color: days <= 3 ? "var(--ap-quiz)" : "var(--ap-muted)" }}
                >
                  {days === 0 ? "Expire aujourd'hui" : `${days}j restants`}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onRestore(item.id)}
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
                  >
                    <RotateCcw className="h-3 w-3" /> Restaurer
                  </button>
                  <button
                    onClick={() => onPermanentDelete(item)}
                    className="ap-btn ap-btn--ghost ap-btn--sm"
                    style={{ color: "var(--ap-quiz)", padding: "5px" }}
                    title="Supprimer définitivement"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
