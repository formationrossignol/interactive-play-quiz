import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReportForm } from "@/components/ReportForm";
import "@/styles/roadmap-pages.css";

export const metadata: Metadata = {
  title: "Signaler un problème",
  description: "Un souci avec Brivia ? Décrivez ce qui s'est passé — type, gravité, contexte technique — et suivez la résolution de vos tickets.",
};

export default function ReportPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Support</span>
            <h1>Un problème ? Réglons ça.</h1>
            <p className="lead">Décrivez ce qui s&apos;est passé — plus c&apos;est précis, plus vite on corrige.</p>
          </div>
          <ReportForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
