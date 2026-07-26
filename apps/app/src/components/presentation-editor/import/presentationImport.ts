import type {
  ImageElement,
  Presentation,
  ShapeElement,
  Slide,
  SlideBackground,
  SlideElement,
  TextElement,
} from "../types/presentation";

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const EMU_PER_INCH = 914400;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

type ImportProgress = (message: string, current?: number, total?: number) => void;

function safeTitle(name: string) {
  return name.replace(/\.(pptx|pdf)$/i, "").trim() || "Présentation importée";
}

function richText(lines: string[], heading = false): TextElement["richText"] {
  const clean = lines.map((line) => line.trim()).filter(Boolean);
  return {
    type: "doc",
    content: (clean.length ? clean : [""]).map((text) => ({
      type: heading ? "heading" : "paragraph",
      attrs: heading ? { level: 1 } : undefined,
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

function baseElement(id: string, zIndex: number) {
  return {
    id,
    rotation: 0,
    zIndex,
    opacity: 1,
    locked: false,
    visible: true,
  };
}

function numericSuffix(path: string) {
  return Number(path.match(/(\d+)(?=\.xml$)/)?.[1] ?? 0);
}

function normalizeZipPath(path: string) {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

function hexColor(node: Element): string | undefined {
  const color = node.getElementsByTagNameNS("*", "srgbClr")[0]?.getAttribute("val");
  return color && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : undefined;
}

function parseGeometry(node: Element, scaleX: number, scaleY: number) {
  const transform = node.getElementsByTagNameNS("*", "xfrm")[0];
  const off = transform?.getElementsByTagNameNS("*", "off")[0];
  const ext = transform?.getElementsByTagNameNS("*", "ext")[0];
  if (!off || !ext) return null;
  const x = Number(off.getAttribute("x"));
  const y = Number(off.getAttribute("y"));
  const width = Number(ext.getAttribute("cx"));
  const height = Number(ext.getAttribute("cy"));
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return {
    x: Math.round(x * scaleX),
    y: Math.round(y * scaleY),
    width: Math.max(1, Math.round(width * scaleX)),
    height: Math.max(1, Math.round(height * scaleY)),
  };
}

function mimeFromPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

function uint8ToDataUrl(bytes: Uint8Array, mime: string) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function extractGoogleSlidesId(value: string): string | null {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (fromUrl) return fromUrl;
  return /^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : null;
}

export async function importGoogleSlidesPresentation(
  url: string,
  onProgress?: ImportProgress,
): Promise<Presentation> {
  const id = extractGoogleSlidesId(url);
  if (!id) throw new Error("Le lien Google Slides n’est pas valide.");
  onProgress?.("Téléchargement depuis Google Slides…");
  let response: Response;
  try {
    response = await fetch(`https://docs.google.com/presentation/d/${id}/export/pptx`);
  } catch {
    throw new Error("Google a bloqué le téléchargement. Rendez le lien accessible ou téléchargez le fichier en PPTX/PDF.");
  }
  if (!response.ok) {
    throw new Error("Cette présentation n’est pas accessible. Vérifiez le partage du lien Google Slides.");
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMPORT_BYTES) throw new Error("Présentation trop volumineuse (max 50 Mo).");
  return parsePptxBuffer(buffer, "Google Slides", onProgress);
}

export async function importPresentationFile(
  file: File,
  onProgress?: ImportProgress,
): Promise<Presentation> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Fichier trop volumineux (max 50 Mo).");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pptx") return parsePptxBuffer(await file.arrayBuffer(), safeTitle(file.name), onProgress);
  if (ext === "pdf") return parsePdfBuffer(await file.arrayBuffer(), safeTitle(file.name), onProgress);
  throw new Error("Format non pris en charge. Choisissez un fichier PPTX ou PDF.");
}

export async function parsePptxBuffer(
  data: ArrayBuffer,
  title = "Présentation importée",
  onProgress?: ImportProgress,
): Promise<Presentation> {
  onProgress?.("Lecture du fichier PowerPoint…");
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(data);
  const parser = new DOMParser();
  const coreXml = await zip.file("docProps/core.xml")?.async("string");
  const coreDoc = coreXml ? parser.parseFromString(coreXml, "application/xml") : null;
  const importedTitle = coreDoc?.getElementsByTagNameNS("*", "title")[0]?.textContent?.trim() || title;
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  const presentationDoc = presentationXml ? parser.parseFromString(presentationXml, "application/xml") : null;
  const size = presentationDoc?.getElementsByTagNameNS("*", "sldSz")[0];
  const sourceWidth = Number(size?.getAttribute("cx")) || (13.333 * EMU_PER_INCH);
  const sourceHeight = Number(size?.getAttribute("cy")) || (7.5 * EMU_PER_INCH);
  const ratio = sourceWidth / sourceHeight;
  const width = DEFAULT_WIDTH;
  const height = Math.round(width / ratio);
  const scaleX = width / sourceWidth;
  const scaleY = height / sourceHeight;

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => numericSuffix(a) - numericSuffix(b));
  if (slidePaths.length === 0) throw new Error("Aucune diapositive trouvée dans ce fichier PPTX.");

  const slides: Slide[] = [];
  for (let index = 0; index < slidePaths.length; index += 1) {
    const path = slidePaths[index];
    onProgress?.(`Conversion de la diapositive ${index + 1}…`, index, slidePaths.length);
    const xml = await zip.file(path)!.async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    const relPath = path.replace("/slides/", "/slides/_rels/") + ".rels";
    const relXml = await zip.file(relPath)?.async("string");
    const relationships = new Map<string, string>();
    if (relXml) {
      const relDoc = parser.parseFromString(relXml, "application/xml");
      Array.from(relDoc.getElementsByTagNameNS("*", "Relationship")).forEach((rel) => {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) relationships.set(id, normalizeZipPath(`ppt/slides/${target}`));
      });
    }

    const elements: SlideElement[] = [];
    const orderedNodes = Array.from(doc.getElementsByTagName("*"))
      .filter((node) => node.localName === "sp" || node.localName === "pic");
    const shapeNodes = Array.from(doc.getElementsByTagNameNS("*", "sp"));
    for (const shape of shapeNodes) {
      const geometry = parseGeometry(shape, scaleX, scaleY);
      if (!geometry) continue;
      const paragraphs = Array.from(shape.getElementsByTagNameNS("*", "p"))
        .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS("*", "t")).map((node) => node.textContent ?? "").join(""))
        .filter(Boolean);
      const zIndex = orderedNodes.indexOf(shape) + 1;
      if (paragraphs.length) {
        const isTitle = shape.getElementsByTagNameNS("*", "ph")[0]?.getAttribute("type") === "title"
          || shape.getElementsByTagNameNS("*", "ph")[0]?.getAttribute("type") === "ctrTitle";
        elements.push({
          ...baseElement(`pptx-${index}-text-${zIndex}`, zIndex),
          type: "text",
          ...geometry,
          richText: richText(paragraphs, isTitle),
        } satisfies TextElement);
      } else {
        const preset = shape.getElementsByTagNameNS("*", "prstGeom")[0]?.getAttribute("prst");
        const fill = hexColor(shape);
        if (!fill) continue;
        elements.push({
          ...baseElement(`pptx-${index}-shape-${zIndex}`, zIndex),
          type: preset === "ellipse" ? "circle" : "rect",
          ...geometry,
          fill,
        } satisfies ShapeElement);
      }
    }

    const pictureNodes = Array.from(doc.getElementsByTagNameNS("*", "pic"));
    for (const picture of pictureNodes) {
      const geometry = parseGeometry(picture, scaleX, scaleY);
      const blip = picture.getElementsByTagNameNS("*", "blip")[0];
      const relationId = blip?.getAttribute("r:embed")
        ?? blip?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
      const mediaPath = relationId ? relationships.get(relationId) : undefined;
      const media = mediaPath ? zip.file(mediaPath) : null;
      if (!geometry || !media || !mediaPath) continue;
      const bytes = await media.async("uint8array");
      const zIndex = orderedNodes.indexOf(picture) + 1;
      elements.push({
        ...baseElement(`pptx-${index}-image-${zIndex}`, zIndex),
        type: "image",
        ...geometry,
        src: uint8ToDataUrl(bytes, mimeFromPath(mediaPath)),
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "transparent",
        fit: "contain",
      } satisfies ImageElement);
    }

    const bgNode = doc.getElementsByTagNameNS("*", "bg")[0];
    const bgColor = bgNode ? hexColor(bgNode) : undefined;
    const background: SlideBackground | undefined = bgColor ? { type: "color", value: bgColor } : undefined;
    if (elements.length === 0) {
      elements.push({
        ...baseElement(`pptx-${index}-fallback`, 1),
        type: "text",
        x: 90,
        y: 80,
        width: width - 180,
        height: 120,
        richText: richText([`Diapositive ${index + 1}`], true),
      } satisfies TextElement);
    }
    slides.push({
      id: `pptx-slide-${Date.now()}-${index}`,
      order: index,
      hidden: false,
      background,
      elements,
    });
    onProgress?.(`Diapositive ${index + 1} importée`, index + 1, slidePaths.length);
  }

  return {
    id: `import-${Date.now()}`,
    title: importedTitle,
    format: Math.abs(ratio - (16 / 9)) < .03 ? "16:9" : Math.abs(ratio - (4 / 3)) < .03 ? "4:3" : "custom",
    width,
    height,
    slides,
  };
}

async function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Impossible de convertir une page PDF."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Impossible de lire l’image générée."));
      reader.readAsDataURL(blob);
    }, "image/jpeg", .88);
  });
}

export async function parsePdfBuffer(
  data: ArrayBuffer,
  title = "Présentation importée",
  onProgress?: ImportProgress,
): Promise<Presentation> {
  onProgress?.("Lecture du PDF…");
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  if (pdf.numPages === 0) throw new Error("Ce PDF ne contient aucune page.");

  const slides: Slide[] = [];
  let presentationWidth = DEFAULT_WIDTH;
  let presentationHeight = DEFAULT_HEIGHT;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(`Rendu de la page ${pageNumber}…`, pageNumber - 1, pdf.numPages);
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = Math.min(1600, Math.max(1000, baseViewport.width * 1.6));
    const viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
    if (pageNumber === 1) {
      presentationWidth = DEFAULT_WIDTH;
      presentationHeight = Math.round(DEFAULT_WIDTH * (viewport.height / viewport.width));
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Votre navigateur ne peut pas rendre ce PDF.");
    await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
    const src = await canvasToJpeg(canvas);
    slides.push({
      id: `pdf-slide-${Date.now()}-${pageNumber}`,
      order: pageNumber - 1,
      hidden: false,
      background: { type: "color", value: "#ffffff" },
      elements: [{
        ...baseElement(`pdf-page-${pageNumber}`, 1),
        type: "image",
        x: 0,
        y: 0,
        width: presentationWidth,
        height: presentationHeight,
        src,
        borderRadius: 0,
        borderWidth: 0,
        borderColor: "transparent",
        fit: "contain",
      } satisfies ImageElement],
    });
    onProgress?.(`Diapositive ${pageNumber} importée`, pageNumber, pdf.numPages);
    page.cleanup();
  }
  await loadingTask.destroy();

  const ratio = presentationWidth / presentationHeight;
  return {
    id: `import-${Date.now()}`,
    title,
    format: Math.abs(ratio - (16 / 9)) < .03 ? "16:9" : Math.abs(ratio - (4 / 3)) < .03 ? "4:3" : "custom",
    width: presentationWidth,
    height: presentationHeight,
    slides,
  };
}
