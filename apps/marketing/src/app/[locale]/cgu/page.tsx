import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPageLayout } from "@/components/LegalPageLayout";
import { fetchStaticPage } from "@/lib/repo";
import { STATIC_PAGE_DEFAULTS, mergeStaticPage } from "@/lib/staticPageDefaults";

async function getPage() {
  const data = await fetchStaticPage("cgu");
  return mergeStaticPage(STATIC_PAGE_DEFAULTS.cgu, data);
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.title, description: page.subtitle };
}

export function generateStaticParams() {
  return [{ locale: "fr" }];
}

type Props = { params: Promise<{ locale: string }> };

export default async function CGUPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "fr") notFound();

  const page = await getPage();
  return <LegalPageLayout page={page} />;
}
