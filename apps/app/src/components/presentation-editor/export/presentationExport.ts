import type { JSONContent } from "@tiptap/react";
import type { Presentation, Slide, TableElement, TextElement } from "../types/presentation";

export type PresentationExportFormat = "pptx" | "odp" | "pdf" | "txt" | "jpg" | "png" | "svg" | "json";

const xmlEscape = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const safeFileName = (value: string) => value.trim().replace(/[\\/:*?"<>|]+/g, "-") || "presentation";

function textFromJson(node?: JSONContent): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(textFromJson).join(node.type === "paragraph" || node.type === "heading" ? "\n" : "");
}

function backgroundSvg(slide: Slide, width: number, height: number, fallbackColor = "#ffffff") {
  const background = slide.background;
  if (!background) return `<rect width="${width}" height="${height}" fill="${xmlEscape(fallbackColor)}"/>`;
  if (background.type === "image") {
    return `<rect width="${width}" height="${height}" fill="#ffffff"/><image href="${xmlEscape(background.value)}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  if (background.type === "gradient") return `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  return `<rect width="${width}" height="${height}" fill="${xmlEscape(background.value)}"/>`;
}

function wrapText(value: string, maxChars: number) {
  const result: string[] = [];
  for (const originalLine of value.split("\n")) {
    const words = originalLine.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        result.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    result.push(line);
  }
  return result.filter((line, index, all) => line || index < all.length - 1);
}

function textElementSvg(element: TextElement, presentation: Presentation) {
  const text = textFromJson(element.richText).trim();
  const heading = element.richText.content?.some((node) => node.type === "heading");
  const fontSize = heading ? 42 : 24;
  const lines = wrapText(text, Math.max(8, Math.floor(element.width / (fontSize * .56))));
  return `<g transform="translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})" opacity="${element.opacity}">
    <text x="0" y="${fontSize}" fill="${xmlEscape(presentation.theme?.textColor ?? "#24202d")}" font-family="${xmlEscape(presentation.theme?.fontFamily ?? "Arial, sans-serif")}" font-size="${fontSize}" font-weight="${heading ? 700 : 400}">
      ${lines.map((line, index) => `<tspan x="0" dy="${index === 0 ? 0 : fontSize * 1.22}">${xmlEscape(line)}</tspan>`).join("")}
    </text>
  </g>`;
}

function tableSvg(element: TableElement, presentation: Presentation) {
  const cellWidth = element.width / element.columns;
  const cellHeight = element.height / element.rows;
  const cells: string[] = [];
  for (let row = 0; row < element.rows; row += 1) {
    for (let column = 0; column < element.columns; column += 1) {
      const index = row * element.columns + column;
      const x = element.x + column * cellWidth;
      const y = element.y + row * cellHeight;
      const fill = element.headerRow && row === 0 ? element.headerFill : element.cellFill;
      cells.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${xmlEscape(fill)}" stroke="${xmlEscape(element.borderColor)}" stroke-width="${element.borderWidth}"/>`);
      cells.push(`<text x="${x + 10}" y="${y + Math.min(cellHeight - 8, 26)}" fill="${xmlEscape(element.textColor)}" font-family="${xmlEscape(presentation.theme?.fontFamily ?? "Arial, sans-serif")}" font-size="16" font-weight="${element.headerRow && row === 0 ? 700 : 400}">${xmlEscape(element.cells[index] ?? "")}</text>`);
    }
  }
  return `<g opacity="${element.opacity}">${cells.join("")}</g>`;
}

export function serializeSlideToSvg(presentation: Presentation, slide: Slide, slideNumber: number): string {
  const elements = slide.elements.slice().sort((a, b) => a.zIndex - b.zIndex).map((element) => {
    if (!element.visible || element.type === "group" || element.type === "video") return "";
    if (element.type === "text") return textElementSvg(element, presentation);
    if (element.type === "image") {
      return `<image href="${xmlEscape(element.src)}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" opacity="${element.opacity}" preserveAspectRatio="${element.fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"}" transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})"/>`;
    }
    if (element.type === "rect") {
      return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${xmlEscape(element.fill)}" stroke="${xmlEscape(element.stroke ?? "none")}" stroke-width="${element.strokeWidth ?? 0}" opacity="${element.opacity}" transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})"/>`;
    }
    if (element.type === "circle") {
      return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${xmlEscape(element.fill)}" stroke="${xmlEscape(element.stroke ?? "none")}" stroke-width="${element.strokeWidth ?? 0}" opacity="${element.opacity}" transform="rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})"/>`;
    }
    if (element.type === "line" || element.type === "arrow") {
      const [start, end] = element.points;
      return `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${xmlEscape(element.stroke)}" stroke-width="${element.strokeWidth}"${element.type === "arrow" ? ' marker-end="url(#arrow)"' : ""}/>`;
    }
    if (element.type === "table") return tableSvg(element, presentation);
    return "";
  }).join("");
  const footer = presentation.footer;
  const showFooter = footer && !(footer.skipTitleSlide && slideNumber === 1);
  const footerAlignment = footer?.alignment ?? "left";
  const footerX = footerAlignment === "left" ? 34 : footerAlignment === "center" ? presentation.width / 2 : presentation.width - 34;
  const footerAnchor = footerAlignment === "left" ? "start" : footerAlignment === "center" ? "middle" : "end";
  const numberPosition = footer?.slideNumberPosition ?? "right";
  const numberX = numberPosition === "left" ? 34 : numberPosition === "center" ? presentation.width / 2 : presentation.width - 34;
  const numberAnchor = numberPosition === "left" ? "start" : numberPosition === "center" ? "middle" : "end";
  const exportFont = presentation.theme?.fontFamily ?? "Arial, sans-serif";
  const exportColor = presentation.theme?.textColor ?? "#555866";
  const footerSvg = showFooter
    ? `<text x="${footerX}" y="${presentation.height - 24}" text-anchor="${footerAnchor}" fill="${xmlEscape(exportColor)}" opacity=".72" font-family="${xmlEscape(exportFont)}" font-size="14">${xmlEscape(footer.text)}</text>${footer.showSlideNumber ? `<text x="${numberX}" y="${presentation.height - 24}" text-anchor="${numberAnchor}" fill="${xmlEscape(exportColor)}" opacity=".72" font-family="${xmlEscape(exportFont)}" font-size="14">${slideNumber}</text>` : ""}`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${presentation.width}" height="${presentation.height}" viewBox="0 0 ${presentation.width} ${presentation.height}">
    <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#24202d"/></marker></defs>
    ${backgroundSvg(slide, presentation.width, presentation.height, presentation.theme?.backgroundColor)}
    ${elements}
    ${footerSvg}
  </svg>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function svgToDataUrl(svg: string, mime: "image/png" | "image/jpeg", width: number, height: number) {
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de préparer l’image de la diapositive."));
      image.src = source;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Votre navigateur ne peut pas exporter cette diapositive.");
    context.scale(2, 2);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(mime, mime === "image/jpeg" ? .92 : undefined);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function base64Bytes(dataUrl: string) {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function renderSlides(presentation: Presentation, mime: "image/png" | "image/jpeg" = "image/png") {
  const slides = presentation.slides.slice().sort((a, b) => a.order - b.order);
  return Promise.all(slides.map((slide, index) => svgToDataUrl(
    serializeSlideToSvg(presentation, slide, index + 1),
    mime,
    presentation.width,
    presentation.height,
  )));
}

async function exportPdf(presentation: Presentation) {
  const [{ jsPDF }, images] = await Promise.all([import("jspdf"), renderSlides(presentation, "image/jpeg")]);
  const pdf = new jsPDF({ orientation: presentation.width >= presentation.height ? "landscape" : "portrait", unit: "px", format: [presentation.width, presentation.height], hotfixes: ["px_scaling"] });
  images.forEach((image, index) => {
    if (index > 0) pdf.addPage([presentation.width, presentation.height], presentation.width >= presentation.height ? "landscape" : "portrait");
    pdf.addImage(image, "JPEG", 0, 0, presentation.width, presentation.height);
  });
  pdf.save(`${safeFileName(presentation.title)}.pdf`);
}

function pptxContentTypes(count: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${Array.from({ length: count }, (_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}
  </Types>`;
}

async function exportPptx(presentation: Presentation) {
  const [{ default: JSZip }, images] = await Promise.all([import("jszip"), renderSlides(presentation)]);
  const zip = new JSZip();
  const slideWidth = 12192000;
  const slideHeight = Math.round(slideWidth * presentation.height / presentation.width);
  zip.file("[Content_Types].xml", pptxContentTypes(images.length));
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${images.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="${slideWidth}" cy="${slideHeight}"/><p:notesSz cx="${slideHeight}" cy="${slideWidth}"/></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${images.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}</Relationships>`);
  zip.file("ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file("ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  zip.file("ppt/theme/theme1.xml", `<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Brivia"><a:themeElements><a:clrScheme name="Brivia"><a:dk1><a:srgbClr val="24202D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="24202D"/></a:dk2><a:lt2><a:srgbClr val="F7F5FA"/></a:lt2>${["6C63FF","FF6B6B","50B77B","F2B705","5C8DEF","EF71A1"].map((color, index) => `<a:accent${index + 1}><a:srgbClr val="${color}"/></a:accent${index + 1}>`).join("")}<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="Brivia"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Brivia"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`);
  images.forEach((image, index) => {
    const slideNumber = index + 1;
    zip.file(`ppt/media/image${slideNumber}.png`, base64Bytes(image));
    zip.file(`ppt/slides/slide${slideNumber}.xml`, `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Diapositive ${slideNumber}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${slideWidth}" cy="${slideHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slideNumber}.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`);
  });
  downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `${safeFileName(presentation.title)}.pptx`);
}

async function exportOdp(presentation: Presentation) {
  const [{ default: JSZip }, images] = await Promise.all([import("jszip"), renderSlides(presentation)]);
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.presentation", { compression: "STORE" });
  images.forEach((image, index) => zip.file(`Pictures/slide-${index + 1}.png`, base64Bytes(image)));
  const widthInches = 13.333;
  const heightInches = widthInches * presentation.height / presentation.width;
  zip.file("content.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2"><office:body><office:presentation>${images.map((_, index) => `<draw:page draw:name="Diapositive ${index + 1}" draw:master-page-name="Default"><draw:frame svg:x="0in" svg:y="0in" svg:width="${widthInches}in" svg:height="${heightInches}in"><draw:image xlink:href="Pictures/slide-${index + 1}.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></draw:page>`).join("")}</office:presentation></office:body></office:document-content>`);
  zip.file("styles.xml", `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2"><office:master-styles><style:master-page style:name="Default"/></office:master-styles></office:document-styles>`);
  zip.file("META-INF/manifest.xml", `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.presentation"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>${images.map((_, index) => `<manifest:file-entry manifest:full-path="Pictures/slide-${index + 1}.png" manifest:media-type="image/png"/>`).join("")}</manifest:manifest>`);
  downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `${safeFileName(presentation.title)}.odp`);
}

export async function exportPresentation(presentation: Presentation, activeSlideId: string, format: PresentationExportFormat) {
  const slides = presentation.slides.slice().sort((a, b) => a.order - b.order);
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeSlideId));
  const activeSlide = slides[activeIndex];
  const baseName = safeFileName(presentation.title);
  if (format === "json") {
    downloadBlob(new Blob([JSON.stringify(presentation, null, 2)], { type: "application/json" }), `${baseName}.json`);
    return;
  }
  if (format === "txt") {
    const text = slides.map((slide, index) => {
      const values = slide.elements.filter((element): element is TextElement => element.type === "text").map((element) => textFromJson(element.richText).trim()).filter(Boolean);
      return `Diapositive ${index + 1}\n${values.join("\n")}`;
    }).join("\n\n");
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${baseName}.txt`);
    return;
  }
  if (format === "svg") {
    downloadBlob(new Blob([serializeSlideToSvg(presentation, activeSlide, activeIndex + 1)], { type: "image/svg+xml;charset=utf-8" }), `${baseName}-slide-${activeIndex + 1}.svg`);
    return;
  }
  if (format === "png" || format === "jpg") {
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const dataUrl = await svgToDataUrl(serializeSlideToSvg(presentation, activeSlide, activeIndex + 1), mime, presentation.width, presentation.height);
    downloadBlob(new Blob([base64Bytes(dataUrl)], { type: mime }), `${baseName}-slide-${activeIndex + 1}.${format}`);
    return;
  }
  if (format === "pdf") return exportPdf(presentation);
  if (format === "pptx") return exportPptx(presentation);
  return exportOdp(presentation);
}
