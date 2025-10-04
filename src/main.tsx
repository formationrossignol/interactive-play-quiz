import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import "./index.css";
import { getCurrentUser } from "./lib/auth";

// Apply theme on load
const applyTheme = () => {
  const user = getCurrentUser();
  const theme = user?.theme || 'light';
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

applyTheme();

createRoot(document.getElementById("root")!).render(<App />);
