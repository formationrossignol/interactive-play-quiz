import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractGoogleSlidesId, parsePptxBuffer } from "../presentationImport";

describe("extractGoogleSlidesId", () => {
  it("extracts the id from edit and presentation URLs", () => {
    expect(extractGoogleSlidesId("https://docs.google.com/presentation/d/abc_DEF-12345678901234567890/edit"))
      .toBe("abc_DEF-12345678901234567890");
  });

  it("rejects unrelated URLs", () => {
    expect(extractGoogleSlidesId("https://example.com/presentation")).toBeNull();
  });
});

describe("parsePptxBuffer", () => {
  it("turns positioned PowerPoint text into an editable slide element", async () => {
    const zip = new JSZip();
    zip.file("ppt/presentation.xml", `
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:sldSz cx="12192000" cy="6858000"/>
      </p:presentation>
    `);
    zip.file("ppt/slides/slide1.xml", `
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree><p:sp>
          <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
          <p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="9144000" cy="1200000"/></a:xfrm></p:spPr>
          <p:txBody><a:p><a:r><a:t>Vision 2027</a:t></a:r></a:p></p:txBody>
        </p:sp></p:spTree></p:cSld>
      </p:sld>
    `);
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const progress: { current?: number; total?: number }[] = [];
    const presentation = await parsePptxBuffer(buffer, "Roadmap", (_message, current, total) => progress.push({ current, total }));

    expect(presentation.title).toBe("Roadmap");
    expect(presentation.format).toBe("16:9");
    expect(presentation.slides).toHaveLength(1);
    expect(presentation.slides[0].elements[0]).toMatchObject({
      type: "text",
      x: 96,
      y: 96,
    });
    expect(JSON.stringify(presentation.slides[0].elements[0])).toContain("Vision 2027");
    expect(progress.at(-1)).toEqual({ current: 1, total: 1 });
  });
});
