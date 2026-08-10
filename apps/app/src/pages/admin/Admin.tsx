import { useEffect, useState } from "react";
import { Rocket, PenLine, ShieldCheck, Mail } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";
import { useIsAdmin } from "@/lib/pages/useIsAdmin";
import {
  useAdminRoadmap, useAdminGuides, useAdminFaq, useAdminReleases,
  useModerationReviews, useModerationIdeas, useModerationReports, useSubscribers, useAdminUsers,
} from "@/lib/pages/adminHooks";
import { ContentTab } from "./ContentTab";
import { ModerationTab } from "./ModerationTab";
import { SubscribersTab } from "./SubscribersTab";
import { UsersTab } from "./UsersTab";
import { RevenueTab } from "./RevenueTab";
import { SettingsTab } from "./SettingsTab";
import { AdminSidebarGroup, type AdminSection } from "./AdminSidebarGroup";
import { PageSkeleton } from "@/components/ui/skeletons";
import "./admin.css";

type Section = AdminSection;

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
  const users = useAdminUsers();

  // / now lives in apps/marketing, using full navigation (not react-router
  // <Navigate>) so the domain-level rewrite reaches it.
  useEffect(() => {
    if (!isLoading && !isAdmin) window.location.href = "/";
  }, [isLoading, isAdmin]);

  if (isLoading || !isAdmin) {
    return (
      <AppLayout>
        <main className="adm">
          <PageSkeleton />
        </main>
      </AppLayout>
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
  const userCount = users.data?.length ?? 0;

  const nav: { key: Section; icon: string; label: string; count: number; alert?: boolean }[] = [
    { key: "content", icon: "receipt_long", label: "Contenu", count: allContent.length },
    { key: "moderation", icon: "shield", label: "Modération", count: pendingMod, alert: pendingMod > 0 },
    { key: "subscribers", icon: "mark_email_unread", label: "Abonnés", count: subCount },
    { key: "users", icon: "groups", label: "Comptes", count: userCount },
    { key: "revenue", icon: "credit_card", label: "Revenus", count: 0 },
    { key: "settings", icon: "settings", label: "Réglages", count: 0 },
  ];

  return (
    <AppLayout subtitle="Administration" extraSection={<AdminSidebarGroup section={section} setSection={setSection} nav={nav} />}>
      <main className="adm">
        <div className="wrap">
          <div className="adm-top">
            <div>
              <h1>Administration</h1>
              <p>Pilotez les contenus, la modération et les paramètres commerciaux de Brivia.</p>
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

          <div>
            {section === "content" && <ContentTab />}
            {section === "moderation" && <ModerationTab />}
            {section === "subscribers" && <SubscribersTab />}
            {section === "users" && <UsersTab />}
            {section === "revenue" && <RevenueTab />}
            {section === "settings" && <SettingsTab />}
          </div>
        </div>
      </main>
    </AppLayout>
  );
};

export default Admin;
