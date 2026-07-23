import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import { TIPTAP_EXTENSIONS } from "./TextElementView";
import { useDocStore } from "../store/useDocStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { useEditorUIStore } from "../store/useEditorUIStore";
import type { TextElement } from "../types/presentation";

interface TextElementEditingProps {
  slideId: string;
  element: TextElement;
  onDone: () => void;
}

/** Mounted only for the element currently being edited (double-click to
 *  enter — see CanvasElement). Commits history on a typing pause (~500ms)
 *  and again on blur, per the spec's "one gesture = one entry" rule. */
export function TextElementEditing({ slideId, element, onDone }: TextElementEditingProps) {
  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: element.richText,
    autofocus: "end",
    onUpdate: ({ editor: e }) => {
      useDocStore.getState().updateElement(slideId, element.id, { richText: e.getJSON() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    const commitOnPause = () => {
      clearTimeout(timer);
      timer = setTimeout(() => useHistoryStore.getState().commit(), 500);
    };
    editor.on("update", commitOnPause);
    return () => { clearTimeout(timer); editor.off("update", commitOnPause); };
  }, [editor]);

  // Expose the live instance to the toolbar (see EditorToolbar / useEditorUIStore)
  // and bump a tick on every selection/mark change so button active-states
  // (bold, alignment…) stay in sync without the toolbar polling the editor.
  useEffect(() => {
    if (!editor) return;
    const { setActiveTextEditor, bumpTextEditorTick } = useEditorUIStore.getState();
    setActiveTextEditor(editor);
    bumpTextEditorTick();
    editor.on("selectionUpdate", bumpTextEditorTick);
    editor.on("transaction", bumpTextEditorTick);
    return () => {
      editor.off("selectionUpdate", bumpTextEditorTick);
      editor.off("transaction", bumpTextEditorTick);
      if (useEditorUIStore.getState().activeTextEditor === editor) setActiveTextEditor(null);
    };
  }, [editor]);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      onBlur={() => { useHistoryStore.getState().commit(); onDone(); }}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
