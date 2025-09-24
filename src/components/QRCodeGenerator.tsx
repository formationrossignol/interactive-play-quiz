import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QRCodeGeneratorProps {
  gameCode: string;
  joinUrl: string;
}

export const QRCodeGenerator = ({ gameCode, joinUrl }: QRCodeGeneratorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
    }
  }, [joinUrl]);

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
      toast({
        title: "Copied!",
        description: "Join URL copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const shareQuiz = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my quiz!',
          text: `Use code ${gameCode} to join the quiz`,
          url: joinUrl,
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      copyJoinUrl();
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-white/20">
      <CardContent className="p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-4">Join the Quiz</h3>
        
        <div className="mb-6">
          <canvas 
            ref={canvasRef} 
            className="mx-auto border-4 border-white rounded-lg bg-white"
          />
        </div>

        <div className="mb-6">
          <div className="text-4xl font-mono text-white mb-2 tracking-wider font-bold">
            {gameCode}
          </div>
          <p className="text-white/60 text-sm">Scan QR code or use this code</p>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button variant="quiz" size="sm" onClick={copyJoinUrl} className="flex-1">
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
            <Button variant="quiz" size="sm" onClick={shareQuiz} className="flex-1">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={downloadQRCode} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download QR Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};