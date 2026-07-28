import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect, useRef } from "react";
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
 *  enter — see CanvasElement). History must be committed BEFORE a burst of
 *  typing mutates the store, not after — every other mutation site in this
 *  editor (PropertiesPanel, SlideNavigator, useElementDrag) does
 *  commit-then-mutate; this one used to mutate immediately in onUpdate and
 *  only commit on a 500ms pause / blur, so the pushed snapshot already
 *  matched the post-edit text and Ctrl+Z right after typing was a no-op. */
export function TextElementEditing({ slideId, element, onDone }: TextElementEditingProps) {
  // true = the next keystroke starts a new "gesture": commit the pre-edit
  // snapshot before that keystroke's mutation lands. Starts true so the very
  // first keystroke captures the state from before editing began at all.
  const pendingCommitRef = useRef(true);

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: element.richText,
    autofocus: "end",
    onUpdate: ({ editor: e }) => {
      if (pendingCommitRef.current) {
        useHistoryStore.getState().commit();
        pendingCommitRef.current = false;
      }
      useDocStore.getState().updateElement(slideId, element.id, { richText: e.getJSON() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout>;
    // After 500ms of no typing, the current burst is considered over — the
    // next keystroke (if any) starts a fresh gesture and gets its own
    // pre-edit checkpoint.
    const armNextGestureOnPause = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { pendingCommitRef.current = true; }, 500);
    };
    editor.on("update", armNextGestureOnPause);
    return () => { clearTimeout(timer); editor.off("update", armNextGestureOnPause); };
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
      onBlur={() => onDone()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
