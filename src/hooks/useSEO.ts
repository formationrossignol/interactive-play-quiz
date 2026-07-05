import { useEffect } from "react";
import {
  SITE_URL,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  buildTitle,
} from "@/lib/seo";

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  noindex?: boolean;
}

function setMeta(selector: string, value: string, attr = "content") {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({ title, description, image, path, noindex = false }: SEOOptions = {}) {
  useEffect(() => {
    const fullTitle = buildTitle(title);
    const desc = description || DEFAULT_DESCRIPTION;
    const img = image || DEFAULT_OG_IMAGE;
    const url = path ? `${SITE_URL}${path}` : SITE_URL + "/";

    document.title = fullTitle;

    setMeta('meta[name="description"]', desc);
    setMeta('meta[name="robots"]', noindex ? "noindex, nofollow" : "index, follow");

    setMeta('meta[property="og:title"]', fullTitle);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[property="og:image"]', img);
    setMeta('meta[property="og:url"]', url);

    setMeta('meta[name="twitter:title"]', fullTitle);
    setMeta('meta[name="twitter:description"]', desc);
    setMeta('meta[name="twitter:image"]', img);

    setLink("canonical", url);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[name="robots"]', "index, follow");
      setMeta('meta[property="og:title"]', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:image"]', DEFAULT_OG_IMAGE);
      setMeta('meta[property="og:url"]', SITE_URL + "/");
      setMeta('meta[name="twitter:title"]', DEFAULT_TITLE);
      setMeta('meta[name="twitter:description"]', DEFAULT_DESCRIPTION);
      setMeta('meta[name="twitter:image"]', DEFAULT_OG_IMAGE);
      setLink("canonical", SITE_URL + "/");
    };
  }, [title, description, image, path, noindex]);
}
