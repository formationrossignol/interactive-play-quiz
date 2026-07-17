import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import "./index.css";
import { getCurrentUser } from "./lib/auth";
import { applySiteTheme, normalizeSiteTheme } from "./lib/siteTheme";

// Apply theme (light/dark mode + site skin) on load
const applyTheme = () => {
  const user = getCurrentUser();
  const theme = user?.theme || 'light';

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  applySiteTheme(normalizeSiteTheme(user?.siteTheme));
};

applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
