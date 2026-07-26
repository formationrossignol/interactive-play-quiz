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
  Grid3X3,
  Image as ImageIcon,
  Italic,
  LayoutTemplate,
  Minus,
  MousePointer2,
  Palette,
  PanelBottom,
  Ruler,
  Square,
  Table2,
  Type,
  Underline as UnderlineIcon,
  Ungroup,
  Video as VideoIcon,
  WandSparkles,
} from "lucide-react";
import { useDocStore } from "./store/useDocStore";
import { useEditorUIStore, type EditorTool } from "./store/useEditorUIStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, distributeHorizontal, distributeVertical } from "./utils/geometry";
import type { SlideElement } from "./types/presentation";
import { SlideLayoutPicker } from "./layouts/SlideLayoutPicker";
import {
  PRESENTATION_FONT_OPTIONS,
  PRESENTATION_TEMPLATES,
  PRESENTATION_TEXT_COLORS,
} from "./templates/presentationTemplates";

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
  const showGrid = useEditorUIStore((s) => s.showGrid);
  const showRulers = useEditorUIStore((s) => s.showRulers);
  const presentation = useDocStore((s) => s.presentation);

  const [shapesOpen, setShapesOpen] = useState(false);
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [lastShape, setLastShape] = useState<EditorTool>("rect");
  const shapesRef = useRef<HTMLDivElement | null>(null);
  const layoutsRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!shapesOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) setShapesOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [shapesOpen]);

  useEffect(() => {
    if (!layoutsOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (layoutsRef.current && !layoutsRef.current.contains(e.target as Node)) setLayoutsOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [layoutsOpen]);

  useEffect(() => {
    if (!footerOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (footerRef.current && !footerRef.current.contains(e.target as Node)) setFooterOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [footerOpen]);

  useEffect(() => {
    if (!themeOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setThemeOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [themeOpen]);

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
    <div style={{ position: "relative", zIndex: 50, display: "flex", alignItems: "center", gap: 2, padding: "6px 12px", borderBottom: "var(--ap-border-w) solid var(--ap-line)", background: "var(--ap-card)", flexWrap: "wrap" }}>
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
      <ToolButton active={activeTool === "table"} label="Dessiner un tableau" onClick={() => setActiveTool("table")}>
        <Table2 size={18} />
      </ToolButton>
      <Separator />
      <div ref={layoutsRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={layoutsOpen}
          onClick={() => setLayoutsOpen((open) => !open)}
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ height: 34, padding: "0 10px" }}
        >
          <LayoutTemplate size={17} aria-hidden="true" />
          Mise en page
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {layoutsOpen && (
          <SlideLayoutPicker
            value={slide?.layoutId}
            onSelect={(layoutId) => {
              useHistoryStore.getState().commit();
              useDocStore.getState().applySlideLayout(slideId, layoutId);
              useEditorUIStore.getState().select([]);
              setLayoutsOpen(false);
            }}
          />
        )}
      </div>
      <Separator />
      <ToolButton
        active={showGrid}
        label={showGrid ? "Masquer la grille" : "Afficher la grille"}
        onClick={() => useEditorUIStore.getState().toggleGrid()}
      >
        <Grid3X3 size={18} />
      </ToolButton>
      <ToolButton
        active={showRulers}
        label={showRulers ? "Masquer les règles" : "Afficher les règles"}
        onClick={() => useEditorUIStore.getState().toggleRulers()}
      >
        <Ruler size={18} />
      </ToolButton>
      <div ref={themeRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={themeOpen}
          onClick={() => setThemeOpen((open) => !open)}
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ height: 34, padding: "0 10px" }}
        >
          <Palette size={17} aria-hidden="true" />
          Style & template
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {themeOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: 370,
              padding: 16,
              zIndex: 60,
              background: "var(--ap-card)",
              border: "var(--ap-border-w) solid var(--ap-line)",
              borderRadius: "var(--ap-r-md)",
              boxShadow: "var(--ap-shadow-card)",
            }}
          >
            <strong style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11, fontSize: 14 }}>
              <WandSparkles size={16} color="var(--ap-brand)" />
              Templates de présentation
            </strong>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {PRESENTATION_TEMPLATES.map((template) => {
                const active = presentation?.theme?.templateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      useHistoryStore.getState().commit();
                      useDocStore.getState().applyTemplate(template.id);
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "32px 1fr",
                      alignItems: "center",
                      gap: 9,
                      padding: 9,
                      textAlign: "left",
                      border: `2px solid ${active ? "var(--ap-brand)" : "var(--ap-line)"}`,
                      borderRadius: 12,
                      background: "var(--ap-card)",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: template.theme.backgroundColor,
                        border: `7px solid ${template.theme.accentColor}`,
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <b style={{ display: "block", fontSize: 12.5 }}>{template.label}</b>
                      <small style={{ display: "block", color: "var(--ap-muted)", lineHeight: 1.25 }}>{template.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <label style={{ display: "grid", gap: 6, marginBottom: 12, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}>
              Police de la présentation
              <select
                value={presentation?.theme?.fontFamily ?? PRESENTATION_FONT_OPTIONS[0].value}
                onChange={(event) => {
                  useHistoryStore.getState().commit();
                  useDocStore.getState().updateTheme({ fontFamily: event.target.value, templateId: "personnalise" });
                }}
                style={{ height: 38, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-paper)", color: "var(--ap-ink)", padding: "0 9px", fontFamily: "inherit" }}
              >
                {PRESENTATION_FONT_OPTIONS.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
              </select>
            </label>
            <div>
              <span style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}>Couleur du texte</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PRESENTATION_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Couleur ${color}`}
                    title={color}
                    onClick={() => {
                      useHistoryStore.getState().commit();
                      useDocStore.getState().updateTheme({ textColor: color, templateId: "personnalise" });
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: color,
                      border: presentation?.theme?.textColor === color ? "3px solid var(--ap-brand)" : "2px solid var(--ap-line)",
                      boxShadow: color === "#ffffff" ? "inset 0 0 0 1px #aaa" : "none",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div ref={footerRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-expanded={footerOpen}
          onClick={() => setFooterOpen((open) => !open)}
          className="ap-btn ap-btn--ghost ap-btn--sm"
          style={{ height: 34, padding: "0 10px" }}
        >
          <PanelBottom size={17} aria-hidden="true" />
          Pied de page
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {footerOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: 310,
              padding: 16,
              zIndex: 20,
              background: "var(--ap-card)",
              border: "var(--ap-border-w) solid var(--ap-line)",
              borderRadius: "var(--ap-r-md)",
              boxShadow: "var(--ap-shadow-card)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 12, fontSize: 14 }}>Numéro et pied de page</strong>
            <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={presentation?.footer?.showSlideNumber ?? false}
                onChange={(event) => {
                  useHistoryStore.getState().commit();
                  useDocStore.getState().updateFooter({ showSlideNumber: event.target.checked });
                }}
              />
              Afficher le numéro de diapositive
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={presentation?.footer?.skipTitleSlide ?? false}
                onChange={(event) => {
                  useHistoryStore.getState().commit();
                  useDocStore.getState().updateFooter({ skipTitleSlide: event.target.checked });
                }}
              />
              Ne pas afficher sur la première diapo
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}>
              Texte du pied de page
              <input
                type="text"
                value={presentation?.footer?.text ?? ""}
                placeholder="Nom du cours, date, établissement…"
                onFocus={() => useHistoryStore.getState().commit()}
                onChange={(event) => useDocStore.getState().updateFooter({ text: event.target.value })}
                style={{ width: "100%", height: 38, padding: "0 10px", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-paper)", color: "var(--ap-ink)", fontFamily: "inherit", fontSize: 13 }}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}>
                Alignement du pied
                <select
                  value={presentation?.footer?.alignment ?? "left"}
                  onChange={(event) => {
                    useHistoryStore.getState().commit();
                    useDocStore.getState().updateFooter({ alignment: event.target.value as "left" | "center" | "right" });
                  }}
                  style={{ height: 36, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-paper)", padding: "0 8px" }}
                >
                  <option value="left">Gauche</option>
                  <option value="center">Centre</option>
                  <option value="right">Droite</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--ap-muted)" }}>
                Numéro de diapo
                <select
                  value={presentation?.footer?.slideNumberPosition ?? "right"}
                  onChange={(event) => {
                    useHistoryStore.getState().commit();
                    useDocStore.getState().updateFooter({ slideNumberPosition: event.target.value as "left" | "center" | "right" });
                  }}
                  style={{ height: 36, border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", background: "var(--ap-paper)", padding: "0 8px" }}
                >
                  <option value="left">Gauche</option>
                  <option value="center">Centre</option>
                  <option value="right">Droite</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

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
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, display: "flex", gap: 2, padding: 4, background: "var(--ap-card)", border: "var(--ap-border-w) solid var(--ap-line)", borderRadius: "var(--ap-r-sm)", boxShadow: "0 4px 12px rgba(0,0,0,.12)", zIndex: 60 }}>
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
