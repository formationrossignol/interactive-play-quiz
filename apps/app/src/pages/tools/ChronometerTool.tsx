import { Timer } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Chronometer } from "@/components/tools/Chronometer";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { useSEO } from "@/hooks/useSEO";

const ChronometerTool = () => {
  useSEO({
    title: "Chronomètre",
    description: "Un chronomètre simple avec tours, à utiliser en classe.",
    path: "/tools/chronometre",
  });

  return (
    <AppLayout subtitle="Chronomètre">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <ToolHeader
          icon={Timer}
          title="Chronomètre"
          description="Démarrez, mettez en pause, enregistrez des tours."
          accent="var(--ap-poll)"
        />
        <Chronometer />
      </div>
    </AppLayout>
  );
};

export default ChronometerTool;
