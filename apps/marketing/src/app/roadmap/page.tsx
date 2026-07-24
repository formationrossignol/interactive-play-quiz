import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RoadmapBoard } from "@/components/RoadmapBoard";
import { fetchRoadmap } from "@/lib/repo";
import "@/styles/roadmap-pages.css";

export const metadata: Metadata = {
  title: "Roadmap publique",
  description: "Votez pour les prochaines fonctionnalités de Brivia. Les idées les plus votées passent en développement — et vous êtes prévenu quand elles sortent.",
};

export default async function RoadmapPage() {
  const baseView = await fetchRoadmap();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <RoadmapBoard baseView={baseView} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
