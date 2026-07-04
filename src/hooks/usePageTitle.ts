import { useEffect } from "react";

const APP_NAME = "QuizMaster";

export function usePageTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : `${APP_NAME} — Quiz et sondages interactifs en temps réel`;
    return () => {
      document.title = `${APP_NAME} — Quiz et sondages interactifs en temps réel`;
    };
  }, [pageTitle]);
}
