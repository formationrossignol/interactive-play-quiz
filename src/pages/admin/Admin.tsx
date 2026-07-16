import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSEO } from "@/hooks/useSEO";
import { useIsAdmin } from "@/lib/pages/useIsAdmin";
import { ContentTab } from "./ContentTab";
import { ModerationTab } from "./ModerationTab";
import { SubscribersTab } from "./SubscribersTab";

const Admin = () => {
  const { isAdmin, isLoading } = useIsAdmin();
  useSEO({ title: "Administration", description: "Gestion du contenu et modération.", path: "/admin" });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main className="lq" style={{ flex: 1, display: "grid", placeItems: "center" }}>Chargement…</main>
        <Footer />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="lq" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="page-hero">
            <span className="eyebrow">Administration</span>
            <h1>Console de gestion</h1>
          </div>
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Contenu</TabsTrigger>
              <TabsTrigger value="moderation">Modération</TabsTrigger>
              <TabsTrigger value="subscribers">Abonnés</TabsTrigger>
            </TabsList>
            <TabsContent value="content"><ContentTab /></TabsContent>
            <TabsContent value="moderation"><ModerationTab /></TabsContent>
            <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
