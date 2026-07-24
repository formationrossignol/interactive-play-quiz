import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChangelogView } from "@/components/ChangelogView";
import { fetchChangelog } from "@/lib/repo";
import "@/styles/roadmap-pages.css";

export const metadata: Metadata = {
  title: "Nouveautés produit",
  description: "Toutes les nouveautés, améliorations et corrections de Brivia, mois par mois — et d'où elles viennent.",
};

export default async function ChangelogPage() {
  const releases = await fetchChangelog();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Nouveautés produit</span>
            <h1>Brivia s&apos;améliore chaque mois.</h1>
            <p className="lead">Toutes les nouveautés, améliorations et corrections — et d&apos;où elles viennent.</p>
          </div>
          <ChangelogView releases={releases} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
