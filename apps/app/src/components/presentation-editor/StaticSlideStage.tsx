import { ImageElementView } from "./elements/ImageElementView";
import { LineArrowLayer } from "./elements/LineArrowLayer";
import { ShapeElementView } from "./elements/ShapeElementView";
import { TableElementView } from "./elements/TableElementView";
import { TextElementView } from "./elements/TextElementView";
import { VideoElementView } from "./elements/VideoElementView";
import { SlideFooter } from "./SlideFooter";
import type { LineElement, Presentation, Slide, SlideElement } from "./types/presentation";

function StaticElement({ slideId, element }: { slideId: string; element: SlideElement }) {
  if (!element.visible || element.type === "line" || element.type === "arrow" || element.type === "group") return null;
  return (
    <div
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.zIndex,
      }}
    >
      {element.type === "text" && <TextElementView element={element} />}
      {element.type === "image" && <ImageElementView element={element} />}
      {(element.type === "rect" || element.type === "circle") && <ShapeElementView element={element} />}
      {element.type === "video" && <VideoElementView element={element} />}
      {element.type === "table" && <TableElementView slideId={slideId} element={element} readOnly />}
    </div>
  );
}

export function StaticSlideStage({
  presentation,
  slide,
  slideNumber,
  scale = 1,
}: {
  presentation: Presentation;
  slide: Slide;
  slideNumber: number;
  scale?: number;
}) {
  const lines = slide.elements.filter((element): element is LineElement => element.type === "line" || element.type === "arrow");
  return (
    <div
      style={{
        position: "relative",
        width: presentation.width,
        height: presentation.height,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        background: slide.background?.value ?? presentation.theme?.backgroundColor ?? "#fff",
        color: presentation.theme?.textColor ?? "#24202d",
        fontFamily: presentation.theme?.fontFamily ?? "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {slide.elements.map((element) => <StaticElement key={element.id} slideId={slide.id} element={element} />)}
      <LineArrowLayer lines={lines} width={presentation.width} height={presentation.height} />
      <SlideFooter footer={presentation.footer} slideNumber={slideNumber} isTitleSlide={slideNumber === 1} />
    </div>
  );
}
