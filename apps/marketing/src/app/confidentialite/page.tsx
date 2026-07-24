import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { fetchStaticPage } from "@/lib/repo";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";

async function getPage() {
  const data = await fetchStaticPage("confidentialite");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.confidentialite, data);
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.title, description: page.subtitle };
}

export default async function ConfidentialitePage() {
  const page = await getPage();
  return <LegalPageLayout page={page} />;
}
