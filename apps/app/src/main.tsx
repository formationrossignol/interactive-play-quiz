import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import "./index.css";
import { getCurrentUser } from "./lib/auth";
import { applySiteTheme, normalizeSiteTheme } from "./lib/siteTheme";
import { applyDensity, normalizeDensity } from "./lib/density";
import { initMonitoring } from "./lib/monitoring";

initMonitoring();

// Apply theme (light/dark mode + site skin + density) on load
const applyTheme = () => {
  const user = getCurrentUser();
  const theme = user?.theme || 'light';

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  applySiteTheme(normalizeSiteTheme(user?.siteTheme));
  applyDensity(normalizeDensity(user?.density));
};

applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
