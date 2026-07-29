import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activeStrokeRef = useRef<Point[] | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2.4 * window.devicePixelRatio;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#172033";

    strokesRef.current.forEach((stroke) => {
      if (stroke.length === 0) return;
      context.beginPath();
      stroke.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (stroke.length === 1) {
        const point = stroke[0];
        context.lineTo(point.x * canvas.width + 0.1, point.y * canvas.height + 0.1);
      }
      context.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(1, Math.round(rect.height * window.devicePixelRatio));
      draw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const stroke = [pointFromEvent(event)];
    strokesRef.current.push(stroke);
    activeStrokeRef.current = stroke;
    setHasInk(true);
    draw();
  };

  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current.push(pointFromEvent(event));
    draw();
  };

  const finishStroke = () => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current = null;
    onChange(canvasRef.current?.toDataURL("image/png") ?? null);
  };

  const clear = () => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setHasInk(false);
    onChange(null);
    draw();
  };

  return (
    <div>
      <div
        style={{
          border: "var(--ap-border-w) solid var(--ap-line)",
          borderRadius: "var(--ap-r-md)",
          background: "var(--ap-paper-2)",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Zone de signature manuscrite"
          role="img"
          className="block h-36 w-full touch-none cursor-crosshair"
          onPointerDown={startStroke}
          onPointerMove={continueStroke}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
        <div
          className="flex items-center justify-between gap-3"
          style={{ borderTop: "var(--ap-border-w) solid var(--ap-line)", padding: "7px 10px" }}
        >
          <span className="ap-muted" style={{ fontSize: 11 }}>
            Signez avec votre souris, votre doigt ou votre stylet
          </span>
          <button
            type="button"
            className="ap-btn ap-btn--ghost ap-btn--sm"
            disabled={!hasInk}
            onClick={clear}
          >
            <Eraser className="h-4 w-4" />
            Effacer
          </button>
        </div>
      </div>
    </div>
  );
}
