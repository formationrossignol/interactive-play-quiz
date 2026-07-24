import { useEffect, useState } from "react";
import { Rocket, PenLine, ShieldCheck, Mail, FileText, Users, Link2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";
import { useIsAdmin } from "@/lib/pages/useIsAdmin";
import {
  useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases,
  useModerationReviews, useModerationIdeas, useModerationReports, useSubscribers,
} from "@/lib/pages/adminHooks";
import { ContentTab } from "./ContentTab";
import { ModerationTab } from "./ModerationTab";
import { SubscribersTab } from "./SubscribersTab";
import { SettingsTab } from "./SettingsTab";
import "./admin.css";

type Section = "content" | "moderation" | "subscribers" | "settings";

const Admin = () => {
  const { isAdmin, isLoading } = useIsAdmin();
  const [section, setSection] = useState<Section>("content");
  useSEO({ title: "Administration", description: "Gestion du contenu et modération.", path: "/admin" });

  // KPI sources (react-query dedupes with the tab components' own queries).
  const roadmap = useAdminRoadmap();
  const guides = useAdminGuides();
  const faq = useAdminFaq();
  const releases = useAdminReleases();
  const reviews = useModerationReviews();
  const ideas = useModerationIdeas();
  const reports = useModerationReports();
  const subs = useSubscribers();

  // / now lives in apps/marketing — full navigation (not react-router
  // <Navigate>) so the domain-level rewrite reaches it.
  useEffect(() => {
    if (!isLoading && !isAdmin) window.location.href = "/";
  }, [isLoading, isAdmin]);

  if (isLoading || !isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main className="adm" style={{ flex: 1 }}>
          <div className="adm-loading"><span className="adm-spinner" /></div>
        </main>
        <Footer />
      </div>
    );
  }

  const allContent = [
    ...(roadmap.data ?? []), ...(guides.data ?? []),
    ...(faq.data ?? []), ...(releases.data ?? []),
  ];
  const published = allContent.filter((r) => (r as { status?: string }).status === "published").length;
  const drafts = allContent.length - published;
  const pendingMod =
    (reviews.list.data?.length ?? 0) + (ideas.list.data?.length ?? 0) +
    (reports.list.data ?? []).filter((r) => r.status !== "resolved").length;
  const subCount = subs.data?.length ?? 0;

  const nav: { key: Section; icon: React.ElementType; label: string; count: number; alert?: boolean }[] = [
    { key: "content", icon: FileText, label: "Contenu", count: allContent.length },
    { key: "moderation", icon: ShieldCheck, label: "Modération", count: pendingMod, alert: pendingMod > 0 },
    { key: "subscribers", icon: Users, label: "Abonnés", count: subCount },
    { key: "settings", icon: Link2, label: "Réglages", count: 0 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Header />
      <main className="adm" style={{ flex: 1 }}>
        <div className="wrap">
          <div className="adm-top">
            <div>
              <span className="adm-eyebrow">Console · en ligne</span>
              <h1>Administration</h1>
            </div>
          </div>

          <div className="adm-kpi">
            <div className="adm-stat acc-brand">
              <div className="chip"><Rocket /></div>
              <div className="num">{published}</div>
              <div className="lbl">Contenus publiés</div>
            </div>
            <div className="adm-stat acc-flash">
              <div className="chip"><PenLine /></div>
              <div className="num">{drafts}</div>
              <div className="lbl">Brouillons</div>
            </div>
            <div className="adm-stat acc-quiz">
              <div className="chip"><ShieldCheck /></div>
              <div className="num">{pendingMod}</div>
              <div className="lbl">En modération</div>
            </div>
            <div className="adm-stat acc-pres">
              <div className="chip"><Mail /></div>
              <div className="num">{subCount}</div>
              <div className="lbl">Abonnés changelog</div>
            </div>
          </div>

          <div className="adm-shell">
            <nav className="adm-rail">
              <div className="adm-rail-label">Sections</div>
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                <button
                  key={n.key}
                  className={`adm-navitem${section === n.key ? " on" : ""}`}
                  onClick={() => setSection(n.key)}
                  aria-current={section === n.key ? "page" : undefined}
                >
                  <span className="ico"><Icon /></span>
                  {n.label}
                  {n.key !== "settings" && (
                    <span className={`count${n.alert && section !== n.key ? " alert" : ""}`}>{n.count}</span>
                  )}
                </button>
                );
              })}
            </nav>

            <div>
              {section === "content" && <ContentTab />}
              {section === "moderation" && <ModerationTab />}
              {section === "subscribers" && <SubscribersTab />}
              {section === "settings" && <SettingsTab />}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
