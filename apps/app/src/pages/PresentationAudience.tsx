import { useEffect, useState } from "react";
import { MonitorUp } from "lucide-react";
import { StaticSlideStage } from "@/components/presentation-editor/StaticSlideStage";
import type { Presentation } from "@/components/presentation-editor/types/presentation";

const MESSAGE_TYPE = "brivia-presenter-state";
const READY_TYPE = "brivia-audience-ready";

export default function PresentationAudience() {
  const [state, setState] = useState<{ presentation: Presentation; index: number } | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== MESSAGE_TYPE) return;
      setState({ presentation: event.data.presentation as Presentation, index: Number(event.data.index) || 0 });
    };
    window.addEventListener("message", receive);
    window.opener?.postMessage({ type: READY_TYPE }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (!state) return;
    const fit = () => setScale(Math.min(window.innerWidth / state.presentation.width, window.innerHeight / state.presentation.height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [state]);

  if (!state) {
    return (
      <div className="product-presenter-wait" role="status" aria-live="polite">
        <span><MonitorUp aria-hidden="true" /></span>
        <strong>Connexion au mode présentateur</strong>
        <p>La diapositive s’affichera dès que le présentateur sera prêt.</p>
      </div>
    );
  }
  const slides = state.presentation.slides.filter((slide) => !slide.hidden).sort((a, b) => a.order - b.order);
  const slide = slides[Math.min(state.index, slides.length - 1)];
  if (!slide) return null;
  const slideNumber = state.presentation.slides.findIndex((item) => item.id === slide.id) + 1;

  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", overflow: "hidden", background: "#09090b" }}>
      <div style={{ width: state.presentation.width * scale, height: state.presentation.height * scale }}>
        <StaticSlideStage presentation={state.presentation} slide={slide} slideNumber={slideNumber} scale={scale} />
      </div>
    </div>
  );
}
