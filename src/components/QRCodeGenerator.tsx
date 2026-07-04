import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Download, Share2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  gameCode: string;
  joinUrl: string;
  /** Render only the QR canvas — no card wrapper, title, code text, or action buttons */
  compact?: boolean;
  /** Canvas size in px when compact=true (default 108) */
  compactSize?: number;
}

export const QRCodeGenerator = ({ gameCode, joinUrl, compact = false, compactSize = 108 }: QRCodeGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: compact ? compactSize : 220,
        margin: 2,
        color: { dark: '#241b3a', light: '#ffffff' },
      });
    }
  }, [joinUrl, compact, compactSize]);

  const downloadQRCode = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `quiz-${gameCode}-qr.png`;
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast({ title: "Lien copié !", duration: 2000 });
    } catch {
      toast({ title: "Échec de la copie", variant: "destructive", duration: 2000 });
    }
  };

  const shareQuiz = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Rejoignez mon quiz !',
          text: `Code : ${gameCode}`,
          url: joinUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') copyJoinUrl();
      }
    } else {
      copyJoinUrl();
    }
  };

  if (compact) {
    return (
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          borderRadius: 'var(--ap-r-sm)',
          background: '#fff',
        }}
      />
    );
  }

  return (
    <div className="ap-card" style={{ textAlign: 'center', boxShadow: 'var(--ap-shadow-card)' }}>
      <h3 style={{
        fontFamily: 'var(--ap-font-display)',
        fontSize: '1.15rem',
        fontWeight: 700,
        color: 'var(--ap-ink)',
        marginBottom: 16,
      }}>
        Rejoindre le quiz
      </h3>

      <div style={{ marginBottom: 16 }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            margin: '0 auto',
            borderRadius: 'var(--ap-r-md)',
            border: '3px solid var(--ap-line)',
            background: '#fff',
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: 'var(--ap-font-display)',
          fontSize: '2.4rem',
          fontWeight: 700,
          color: 'var(--ap-brand)',
          letterSpacing: '0.12em',
          lineHeight: 1.1,
        }}>
          {gameCode}
        </div>
        <p style={{ color: 'var(--ap-muted)', fontSize: 13, fontWeight: 700, marginTop: 4 }}>
          Scannez le QR code ou utilisez ce code
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyJoinUrl} className="ap-btn ap-btn--sm ap-btn--ghost" style={{ flex: 1 }}>
            <Copy className="w-4 h-4" />
            Copier
          </button>
          <button onClick={shareQuiz} className="ap-btn ap-btn--sm ap-btn--ghost" style={{ flex: 1 }}>
            <Share2 className="w-4 h-4" />
            Partager
          </button>
        </div>
        <button onClick={downloadQRCode} className="ap-btn ap-btn--sm ap-btn--ghost" style={{ width: '100%' }}>
          <Download className="w-4 h-4" />
          Télécharger le QR
        </button>
      </div>
    </div>
  );
};
