import { useEffect, useReducer } from "react";

/**
 * Subscribe to language changes dispatched by setLanguage().
 * Call at the top of any component that renders t() — forces re-render
 * when the user switches language, without a page reload.
 */
export function useLanguage() {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener("ap:langchange", rerender);
    return () => window.removeEventListener("ap:langchange", rerender);
  }, []);
}
