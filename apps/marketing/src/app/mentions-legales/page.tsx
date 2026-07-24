import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { fetchStaticPage } from "@/lib/repo";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";

async function getPage() {
  const data = await fetchStaticPage("mentions-legales");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS["mentions-legales"], data);
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.title, description: page.subtitle };
}

export default async function MentionsLegalesPage() {
  const page = await getPage();
  return <LegalPageLayout page={page} />;
}
