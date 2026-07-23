// src/components/presentation-editor/EditorToolbar.tsx
import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowUpRight,
  Bold,
  ChevronDown,
  Circle,
  Group,
  Image as ImageIcon,
  Italic,
  Minus,
  MousePointer2,
  Square,
  Type,
  Underline as UnderlineIcon,
  Ungroup,
  Video as VideoIcon,
} from "lucide-react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore, type EditorTool } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, distributeHorizontal, distributeVertical } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";

const FONT_FAMILIES = [
  { label: "Défaut", value: "" },
  { label: "Sora", value: "'Sora Variable', 'Sora', sans-serif" },
  { label: "Manrope", value: "'Manrope', sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

const SHAPE_TOOLS: { id: EditorTool; label: string; Icon: typeof Square }[] = [
  { id: "rect", label: "Rectangle", Icon: Square },
  { id: "circle", label: "Cercle", Icon: Circle },
  { id: "line", label: "Ligne", Icon: Minus },
  { id: "arrow", label: "Flèche", Icon: ArrowUpRight },
];

function ToolButton({
  active, label, onClick, children,
}: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "var(--ap-r-sm)",
        cursor: "pointer",
        background: active ? "var(--ap-brand)" : "transparent",
        color: active ? "#fff" : "var(--ap-ink)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span style={{ width: 1, height: 22, background: "var(--ap-line)", margin: "0 4px", flexShrink: 0 }} />;
}

/** Shown only while a text element is being edited (double-click to enter —
 *  see CanvasElement / TextElementEditing). Drives the live Tiptap instance
 *  registered in useEditorUIStore, matching Google Slides' contextual text
 *  toolbar rather than a floating bubble menu. */
function TextFormatToolbar() {
  const editor = useEditorUIStore((s) => s.activeTextEditor);
  useEditorUIStore((s) => s.textEditorTick); // re-render on selection/mark changes

  if (!editor) return null;

  return (
    <>
      <Separator />
      <select
        aria-label="Police"
        value={editor.getAttributes("textStyle").fontFamily ?? ""}
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        style={{ height: 34, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", fontSize: 13, color: "var(--ap-ink)", background: "var(--ap-card)", padding: "0 6px", flexShrink: 0 }}
      >
        {FONT_FAMILIES.map(({ label, value }) => (
          <option key={label} value={value}>{label}</option>
        ))}
      </select>

      <ToolButton active={editor.isActive("bold")} label="Gras" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </ToolButton>
      <ToolButton active={editor.isActive("italic")} label="Italique" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </ToolButton>
      <ToolButton active={editor.isActive("underline")} label="Souligné" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={16} />
      </ToolButton>

      <input
        type="color"
        aria-label="Couleur du texte"
        title="Couleur du texte"
        value={editor.getAttributes("textStyle").color ?? "#000000"}
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        style={{ width: 28, height: 28, border: "none", borderRadius: "var(--ap-r-sm)", cursor: "pointer", flexShrink: 0, background: "transparent" }}
      />

      <ToolButton active={editor.isActive({ textAlign: "left" })} label="Aligner le texte à gauche" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={16} />
      </ToolButton>
      <ToolButton active={editor.isActive({ textAlign: "center" })} label="Centrer le texte" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={16} />
      </ToolButton>
      <ToolButton active={editor.isActive({ textAlign: "right" })} label="Aligner le texte à droite" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={16} />
      </ToolButton>
      <ToolButton active={editor.isActive({ textAlign: "justify" })} label="Justifier le texte" onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify size={16} />
      </ToolButton>
    </>
  );
}

export function EditorToolbar({ slideId }: { slideId: string }) {
  const activeTool = useEditorUIStore((s) => s.activeTool);
  const setActiveTool = useEditorUIStore((s) => s.setActiveTool);
  const selectedIds = useEditorUIStore((s) => s.selectedIds);
  const presentation = useDocStore((s) => s.presentation);

  const [shapesOpen, setShapesOpen] = useState(false);
  const [lastShape, setLastShape] = useState<EditorTool>("rect");
  const shapesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shapesOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) setShapesOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [shapesOpen]);

  const slide = presentation?.slides.find((s) => s.id === slideId);
  const selected = slide ? slide.elements.filter((el) => selectedIds.has(el.id)) : [];
  const isShapeToolActive = SHAPE_TOOLS.some((t) => t.id === activeTool);
  const ActiveShapeIcon = SHAPE_TOOLS.find((t) => t.id === lastShape)?.Icon ?? Square;

  function applyAlign(fn: (els: SlideElement[]) => SlideElement[]) {
    if (selected.length < 2) return;
    useHistoryStore.getState().commit();
    const updated = fn(selected);
    useDocStore.getState().updateElements(slideId, updated.map((el) => ({ id: el.id, patch: el })));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 12px", borderBottom: "var(--ap-border-w) solid var(--ap-line)", flexWrap: "wrap" }}>
      <ToolButton active={activeTool === "select"} label="Sélection" onClick={() => setActiveTool("select")}>
        <MousePointer2 size={18} />
      </ToolButton>
      <ToolButton active={activeTool === "text"} label="Texte" onClick={() => setActiveTool("text")}>
        <Type size={18} />
      </ToolButton>
      <ToolButton active={activeTool === "image"} label="Image" onClick={() => setActiveTool("image")}>
        <ImageIcon size={18} />
      </ToolButton>
      <ToolButton active={activeTool === "video"} label="Vidéo" onClick={() => setActiveTool("video")}>
        <VideoIcon size={18} />
      </ToolButton>

      <div ref={shapesRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <ToolButton active={isShapeToolActive} label="Formes" onClick={() => setActiveTool(lastShape)}>
          <ActiveShapeIcon size={18} />
        </ToolButton>
        <button
          type="button"
          aria-label="Choisir une forme"
          aria-expanded={shapesOpen}
          onClick={() => setShapesOpen((v) => !v)}
          style={{ width: 16, height: 34, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", color: "var(--ap-muted)" }}
        >
          <ChevronDown size={12} />
        </button>
        {shapesOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, display: "flex", gap: 2, padding: 4, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 10 }}>
            {SHAPE_TOOLS.map(({ id, label, Icon }) => (
              <ToolButton
                key={id}
                active={activeTool === id}
                label={label}
                onClick={() => { setActiveTool(id); setLastShape(id); setShapesOpen(false); }}
              >
                <Icon size={18} />
              </ToolButton>
            ))}
          </div>
        )}
      </div>

      <TextFormatToolbar />

      {selected.length >= 2 && (
        <>
          <Separator />
          <ToolButton active={false} label="Aligner à gauche" onClick={() => applyAlign(alignLeft)}><AlignHorizontalJustifyStart size={18} /></ToolButton>
          <ToolButton active={false} label="Centrer horizontalement" onClick={() => applyAlign(alignCenterH)}><AlignHorizontalJustifyCenter size={18} /></ToolButton>
          <ToolButton active={false} label="Aligner à droite" onClick={() => applyAlign(alignRight)}><AlignHorizontalJustifyEnd size={18} /></ToolButton>
          <ToolButton active={false} label="Aligner en haut" onClick={() => applyAlign(alignTop)}><AlignVerticalJustifyStart size={18} /></ToolButton>
          <ToolButton active={false} label="Centrer verticalement" onClick={() => applyAlign(alignMiddleV)}><AlignVerticalJustifyCenter size={18} /></ToolButton>
          <ToolButton active={false} label="Aligner en bas" onClick={() => applyAlign(alignBottom)}><AlignVerticalJustifyEnd size={18} /></ToolButton>
          {selected.length >= 3 && (
            <>
              <ToolButton active={false} label="Distribuer horizontalement" onClick={() => applyAlign(distributeHorizontal)}><AlignHorizontalDistributeCenter size={18} /></ToolButton>
              <ToolButton active={false} label="Distribuer verticalement" onClick={() => applyAlign(distributeVertical)}><AlignVerticalDistributeCenter size={18} /></ToolButton>
            </>
          )}
          <ToolButton
            active={false}
            label="Grouper"
            onClick={() => {
              useHistoryStore.getState().commit();
              useDocStore.getState().groupElements(slideId, [...selectedIds]);
            }}
          >
            <Group size={18} />
          </ToolButton>
        </>
      )}
      {selected.length === 1 && selected[0].type === "group" && (
        <>
          <Separator />
          <ToolButton
            active={false}
            label="Dégrouper"
            onClick={() => {
              useHistoryStore.getState().commit();
              useDocStore.getState().ungroupElements(slideId, selected[0].id);
            }}
          >
            <Ungroup size={18} />
          </ToolButton>
        </>
      )}
    </div>
  );
}
