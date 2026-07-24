import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GuidesGrid } from "@/components/GuidesGrid";
import { fetchGuides } from "@/lib/repo";
import "./guides.css";

export const metadata: Metadata = {
  title: "Guides & tutoriels",
  description: "Des guides courts et concrets pour animer des quiz, sondages et examens en salle — écrits par des formateurs.",
};

export default async function GuidesPage() {
  const guides = await fetchGuides();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Guides &amp; tutoriels</span>
            <h1>Devenez redoutable en salle.</h1>
            <p className="lead">Des guides courts et concrets, écrits par des formateurs — pas par le marketing.</p>
          </div>

          <div className="pathcard">
            <div className="pemo">🚀</div>
            <div>
              <h3>Parcours : votre première session en 30 minutes</h3>
              <p>4 étapes guidées, de la création du compte au débrief analytics. Reprenez où vous en étiez.</p>
              <div className="pathsteps">
                <span className="done">✓ 1. Créer son premier quiz</span>
                <span className="done">✓ 2. Paramétrer le jeu</span>
                <span>3. Animer la session</span>
                <span>4. Lire les analytics</span>
              </div>
            </div>
            <a className="btn btn--quiz" href="/builder-start?type=quiz">
              Reprendre — étape 3
            </a>
          </div>

          <GuidesGrid guides={guides} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
