import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brivia",
    short_name: "Brivia",
    description: "Participation, apprentissage et évaluation dans un même espace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f8",
    theme_color: "#5047c8",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
