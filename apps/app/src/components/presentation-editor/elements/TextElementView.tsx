import { generateHTML } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import type { TextElement } from "../types/presentation";

export const TIPTAP_EXTENSIONS = [
  StarterKit,
  Link,
  Underline,
  TextAlign.configure({ types: ["paragraph", "heading"] }),
  TextStyle,
  Color,
  FontFamily,
];

export function TextElementView({ element }: { element: TextElement }) {
  // richText can arrive from an imported .json presentation file with no
  // schema validation (see importPresentationFromFile) — ProseMirror throws
  // on a malformed doc shape, and there's no app-wide ErrorBoundary, so an
  // uncaught throw here white-screens the whole editor. Degrade to empty
  // content instead of crashing.
  let html: string;
  try {
    html = generateHTML(element.richText, TIPTAP_EXTENSIONS);
  } catch {
    html = "";
  }
  return (
    <div
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
