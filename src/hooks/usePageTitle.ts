import { useSEO } from "@/hooks/useSEO";

export function usePageTitle(pageTitle?: string) {
  useSEO({ title: pageTitle });
}
