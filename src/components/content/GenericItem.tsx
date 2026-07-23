/**
 * GenericItem — shared card / row renderers for the content types that share the
 * ContentDisplay shape (quiz, poll, flashcard). Courses supply their own renderers.
 *
 * The ContentExplorer shell owns data + DnD and passes an `ItemCtx` (folders +
 * move/favorite/trash callbacks). Per-type differences (routes, counts, play, the
 * optional "Examen" action) come from a static `GenericItemConfig`.
 */
import type { ReactNode } from "react";
import type { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import {
  BarChart2,
  ClipboardCheck,
  FolderInput,
  FolderOpen,
  GripVertical,
  Layers,
  ListChecks,
  MoreHorizontal,
  Play,
  Presentation,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContentDisplay } from "@/lib/content/contentView";
import type { FolderRow } from "@/lib/content/types";
import { readSessionHistory } from "@/lib/sessionState";

type NavigateFn = ReturnType<typeof useNavigate>;

/** Passed from the shell to every rendered item. */
export interface ItemCtx {
  folders: FolderRow[];
  onMove: (folderId: string | null) => void;
  onFavorite: () => void;
  onTrash: () => void;
}

/** Static per-type behaviour for the generic renderers. */
export interface GenericItemConfig {
  accentBtn: string; // e.g. "ap-btn--quiz"
  editRoute: (id: string) => string;
  countOf: (d: ContentDisplay) => number;
  countLabel: (n: number) => string; // full label, e.g. "12 questions"
  play?: { run: (d: ContentDisplay, navigate: NavigateFn) => void; label: string };
  results?: (id: string) => string; // when set + history exists, show "Résultats"
  showExam?: boolean; // quiz only: "Créer un examen" in the ⋯ menu
  /** No play → this label is the primary pill (e.g. flashcards "Modifier"). */
  primaryEdit?: string;
}

const gripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--ap-muted)",
  cursor: "grab",
  touchAction: "none",
  padding: "2px",
  borderRadius: "4px",
  flexShrink: 0,
};

const menuStyle = {
  minWidth: 200,
  border: "var(--ap-border-w) solid var(--ap-line)",
  background: "var(--ap-card)",
  borderRadius: "var(--ap-r-md)",
} as const;

const itemId = (d: ContentDisplay) => String((d.data.id as string | undefined) ?? "");
const headerImage = (d: ContentDisplay) => d.data.headerImage as string | undefined;

/** ⋯ menu: Examen (quiz), Move-to-folder submenu, Favorite toggle, Trash. */
function ItemMenu({
  d,
  ctx,
  config,
  navigate,
}: {
  d: ContentDisplay;
  ctx: ItemCtx;
  config: GenericItemConfig;
  navigate: NavigateFn;
}) {
  const id = itemId(d);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="ap-btn ap-btn--ghost ap-btn--sm" style={{ padding: "5px 7px" }} title="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" style={menuStyle} onClick={(e) => e.stopPropagation()}>
        {config.showExam && id && (
          <DropdownMenuItem
            onSelect={() => navigate(`/exam-builder?quizId=${id}`)}
            className="flex items-center gap-2 cursor-pointer text-sm"
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Créer un examen
          </DropdownMenuItem>
        )}
        {ctx.folders.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-sm">
              <FolderInput className="h-3.5 w-3.5" /> Déplacer vers
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent style={menuStyle}>
              {d.folderId && (
                <DropdownMenuItem
                  onSelect={() => ctx.onMove(null)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Racine
                </DropdownMenuItem>
              )}
              {ctx.folders.map((f) => (
                <DropdownMenuItem
                  key={f.id}
                  onSelect={() => ctx.onMove(f.id)}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  disabled={d.folderId === f.id}
                >
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={ctx.onFavorite} className="flex items-center gap-2 cursor-pointer text-sm">
          <Star className="h-3.5 w-3.5" style={d.isFavorite ? { fill: "#fbbf24", color: "#fbbf24" } : {}} />
          {d.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={ctx.onTrash}
          className="flex items-center gap-2 cursor-pointer text-sm"
          style={{ color: "var(--ap-quiz)" }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Mettre à la corbeille
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface GenericItemProps {
  d: ContentDisplay;
  ctx: ItemCtx;
  config: GenericItemConfig;
  navigate: NavigateFn;
}

/** Primary action button (Play or Edit) shared by card + row. */
function primaryButton(
  { d, config, navigate }: GenericItemProps,
  size: { text: string; pad: string },
): ReactNode {
  const id = itemId(d);
  if (config.play) {
    return (
      <Button
        size="sm"
        onClick={() => config.play!.run(d, navigate)}
        className={`ap-btn ap-btn--sm ap-btn--pill ${config.accentBtn} gap-1.5`}
        style={{ fontSize: size.text, padding: size.pad }}
      >
        <Play className="h-3.5 w-3.5" /> {config.play.label}
      </Button>
    );
  }
  return (
    <button
      className={`ap-btn ap-btn--sm ap-btn--pill ${config.accentBtn}`}
      style={{ fontSize: size.text, padding: size.pad }}
      onClick={(e) => { e.stopPropagation(); navigate(config.editRoute(id)); }}
    >
      {config.primaryEdit}
    </button>
  );
}

/** Accent CSS var derived from the config accentBtn suffix (ap-btn--quiz → --ap-quiz). */
const accentVarOf = (accentBtn: string) => `--ap-${accentBtn.replace("ap-btn--", "")}`;

/** Default header icon per content type, keyed by the config accentBtn suffix. */
const defaultHeaderIcon: Record<string, typeof ListChecks> = {
  "ap-btn--quiz": ListChecks,
  "ap-btn--poll": BarChart2,
  "ap-btn--flash": Layers,
  "ap-btn--pres": Presentation,
};

export function GenericCard(props: GenericItemProps) {
  const { d, ctx, config, navigate } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  const img = headerImage(d);
  const n = config.countOf(d);
  const id = itemId(d);
  const hasHistory = !!config.results && id ? readSessionHistory(id).length > 0 : false;
  const accentVar = accentVarOf(config.accentBtn);
  const DefaultHeaderIcon = defaultHeaderIcon[config.accentBtn] ?? ListChecks;

  return (
    <div
      ref={setNodeRef}
      className="ap-card ap-card--hover flex h-full cursor-pointer flex-col overflow-hidden"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(config.editRoute(id))}
    >
      {img ? (
        <div className="relative h-40 w-full overflow-hidden flex-shrink-0">
          <img src={img} alt={d.title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className="relative h-40 w-full overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ background: `color-mix(in srgb, var(${accentVar}) 14%, var(--ap-paper-2))` }}
        >
          <DefaultHeaderIcon style={{ width: 40, height: 40, color: `var(${accentVar})`, opacity: 0.8 }} />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2.5" style={{ padding: "14px 16px 12px" }}>
        <div className="flex items-start gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={gripStyle}
            className="ap-grip"
            title="Déplacer"
            aria-label={`Déplacer ${d.title}`}
          >
            <GripVertical style={{ width: 14, height: 14 }} />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="ap-h3 line-clamp-2" style={{ fontSize: "15.5px", lineHeight: 1.25 }}>{d.title}</h3>
            <p className="ap-muted mt-1 text-sm line-clamp-2">{d.description}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); ctx.onFavorite(); }}
            className="text-amber-400 hover:text-amber-500 transition-colors cursor-pointer p-1 -mr-1 flex-shrink-0"
          >
            <Star className={`h-4 w-4 ${d.isFavorite ? "fill-amber-400" : ""}`} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {d.category && (
            <Badge variant="outline" className="rounded-full text-xs border-border text-muted-foreground">
              {d.category}
            </Badge>
          )}
          <span className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>{config.countLabel(n)}</span>
          {d.tags?.map((tag) => (
            <span key={tag} className="ap-pill" style={{ fontSize: "11px", padding: "3px 9px" }}>#{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-1.5 pt-3" style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)" }}>
          <ItemMenu d={d} ctx={ctx} config={config} navigate={navigate} />
          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
            {hasHistory && config.results && (
              <button
                onClick={() => navigate(config.results!(id))}
                className="ap-btn ap-btn--ghost ap-btn--sm"
                style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}
              >
                <BarChart2 style={{ width: 13, height: 13 }} /> Résultats
              </button>
            )}
            {primaryButton(props, { text: "13px", pad: "8px 15px" })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GenericRow(props: GenericItemProps) {
  const { d, ctx, config, navigate } = props;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: d.id });
  const img = headerImage(d);
  const n = config.countOf(d);
  const id = itemId(d);
  const hasHistory = !!config.results && id ? readSessionHistory(id).length > 0 : false;

  return (
    <div
      ref={setNodeRef}
      className="ap-row flex items-center gap-4 cursor-pointer px-4 py-3 transition-colors"
      style={{ borderBottom: "var(--ap-border-w) solid var(--ap-line)", opacity: isDragging ? 0.4 : 1 }}
      onClick={() => navigate(config.editRoute(id))}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ap-paper-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={gripStyle}
        className="ap-grip"
        title="Déplacer"
        aria-label={`Déplacer ${d.title}`}
      >
        <GripVertical style={{ width: 14, height: 14 }} />
      </button>
      {img && <img src={img} alt={d.title} className="w-12 h-12 rounded object-cover flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="ap-h3 truncate" style={{ fontSize: "14px", marginBottom: "2px" }}>{d.title}</p>
        {d.description && <p className="ap-muted truncate" style={{ fontSize: "12px" }}>{d.description}</p>}
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        {d.category && (
          <Badge variant="outline" className="rounded-full text-xs border-border text-muted-foreground">
            {d.category}
          </Badge>
        )}
        <span className="ap-pill" style={{ fontSize: "11px", padding: "2px 8px" }}>{config.countLabel(n)}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <ItemMenu d={d} ctx={ctx} config={config} navigate={navigate} />
        {hasHistory && config.results && (
          <button
            onClick={() => navigate(config.results!(id))}
            className="ap-btn ap-btn--ghost ap-btn--sm"
            style={{ padding: "5px 8px", display: "flex", alignItems: "center", gap: "3px", fontSize: "12px" }}
          >
            <BarChart2 style={{ width: 13, height: 13 }} />
            <span className="hidden sm:inline">Résultats</span>
          </button>
        )}
        {primaryButton(props, { text: "12px", pad: "6px 12px" })}
      </div>
    </div>
  );
}
