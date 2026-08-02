const TRANSLATED_PATHS = new Set(["/", "/contact", "/enterprise", "/security"]);

export function isEnglishPath(pathname: string) {
  return pathname === "/en" || pathname.startsWith("/en/");
}

export function languageCounterpart(pathname: string) {
  if (isEnglishPath(pathname)) {
    const frenchPath = pathname.slice(3) || "/";
    return TRANSLATED_PATHS.has(frenchPath) ? frenchPath : "/";
  }

  return TRANSLATED_PATHS.has(pathname) ? `/en${pathname === "/" ? "" : pathname}` : "/en";
}
