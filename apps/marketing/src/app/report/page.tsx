import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReportForm } from "@/components/ReportForm";
import "@/styles/roadmap-pages.css";

export const metadata: Metadata = {
  title: "Signaler un problème",
  description: "Un souci avec Brivia ? Décrivez le type, la gravité et le contexte technique, puis suivez la résolution de vos tickets.",
};

export default function ReportPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <h1>Un problème ? Réglons ça.</h1>
            <p className="lead">Décrivez précisément ce qui s&apos;est passé pour nous aider à corriger plus vite.</p>
          </div>
          <ReportForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
